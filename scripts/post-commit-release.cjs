/**
 * Background worker invoked from the post-commit hook.
 * Releases ct-mcp plugins when the latest commit touches plugin paths only.
 */
const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const { loadDotenv } = require("./load-dotenv.cjs");
const { resolveGcpProjectId } = require("./gcp-config.cjs");
const { getProjectAdcPath } = require("./gcp-lib-adc.cjs");
const { getPluginsTouchedByFiles } = require("./plugin-paths.cjs");

const root = path.join(__dirname, "..");
const logPrefix = "post-commit-release";
const shell = process.platform === "win32";

function runGit(args) {
  const r = spawnSync("git", args, { cwd: root, encoding: "utf8", shell });
  if (r.status !== 0) return "";
  return (r.stdout || "").trim();
}

function getCommitFiles(commit = "HEAD") {
  const output = runGit(["diff-tree", "--no-commit-id", "--name-only", "-r", commit]);
  if (!output) return [];
  return output.split("\n").filter(Boolean);
}

function isReleaseConfigured() {
  loadDotenv(root);
  const projectId = resolveGcpProjectId(root);
  if (!projectId) return false;
  return fs.existsSync(getProjectAdcPath(root));
}

function acquireLock() {
  const lockPath = path.join(root, ".git/post-commit-release.lock");
  if (fs.existsSync(lockPath)) {
    const pid = Number(fs.readFileSync(lockPath, "utf8").trim());
    if (pid && !Number.isNaN(pid)) {
      try {
        process.kill(pid, 0);
        return null;
      } catch {
        // stale lock
      }
    }
  }
  fs.writeFileSync(lockPath, String(process.pid));
  return lockPath;
}

function releaseLock(lockPath) {
  if (lockPath && fs.existsSync(lockPath)) {
    fs.unlinkSync(lockPath);
  }
}

function runRelease() {
  const r = spawnSync("npm", ["run", "release"], {
    cwd: root,
    stdio: "inherit",
    env: process.env,
    shell,
  });
  if (r.status !== 0) {
    process.exit(r.status ?? 1);
  }
}

function main() {
  if (process.env.CT_MCP_POST_COMMIT_RELEASE === "0") {
    console.log(`${logPrefix}: disabled (CT_MCP_POST_COMMIT_RELEASE=0)`);
    return;
  }

  const files = getCommitFiles();
  const plugins = getPluginsTouchedByFiles(files);
  if (plugins.length === 0) {
    console.log(`${logPrefix}: skip — commit has no ct-mcp plugin file changes`);
    return;
  }

  console.log(`${logPrefix}: plugin changes detected (${plugins.join(", ")})`);

  if (!isReleaseConfigured()) {
    console.log(`${logPrefix}: skip — GCP not configured (run: npm run login)`);
    return;
  }

  const lockPath = acquireLock();
  if (!lockPath) {
    console.log(`${logPrefix}: skip — release already in progress`);
    return;
  }

  try {
    console.log(`${logPrefix}: starting release…`);
    runRelease();
    console.log(`${logPrefix}: done`);
  } finally {
    releaseLock(lockPath);
  }
}

main();
