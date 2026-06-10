/**
 * Background worker invoked from the post-commit hook.
 * Deploys the marketing website to Cloud Run when the latest commit touches website/.
 */
const { spawn, spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const { loadDotenv } = require("./load-dotenv.cjs");
const { resolveGcpProjectId } = require("./gcp-config.cjs");
const { getProjectAdcPath } = require("./gcp-lib-adc.cjs");

const root = path.join(__dirname, "..");
const logPrefix = "post-commit-website";
const shell = process.platform === "win32";
const websitePrefix = "website/";

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

function commitTouchesWebsite(files) {
  return files.some((file) => file === "website" || file.startsWith(websitePrefix));
}

function isDeployConfigured() {
  loadDotenv(root);
  const projectId = resolveGcpProjectId(root);
  if (!projectId) return false;
  return fs.existsSync(getProjectAdcPath(root));
}

function acquireLock() {
  const lockPath = path.join(root, ".git/post-commit-website.lock");
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

function runDeployDetached(lockPath) {
  const deployLog = path.join(root, ".git/post-commit-website-deploy.log");

  if (process.platform === "win32") {
    const r = spawnSync("npm", ["run", "deploy:website"], {
      cwd: root,
      stdio: "inherit",
      env: process.env,
      shell,
    });
    releaseLock(lockPath);
    if (r.status !== 0) {
      process.exit(r.status ?? 1);
    }
    return;
  }

  const cmd = `npm run deploy:website >> "${deployLog}" 2>&1; rm -f "${lockPath}"`;
  const child = spawn(cmd, [], {
    cwd: root,
    detached: true,
    stdio: "ignore",
    shell: true,
    env: process.env,
  });
  child.unref();
  console.log(`${logPrefix}: deploy started in background (pid ${child.pid})`);
  console.log(`${logPrefix}: deploy log: ${deployLog}`);
}

function main() {
  if (process.env.CT_MCP_POST_COMMIT_WEBSITE === "0") {
    console.log(`${logPrefix}: disabled (CT_MCP_POST_COMMIT_WEBSITE=0)`);
    return;
  }

  const files = getCommitFiles();
  if (!commitTouchesWebsite(files)) {
    console.log(`${logPrefix}: skip — commit has no website/ changes`);
    return;
  }

  console.log(`${logPrefix}: website changes detected`);

  if (!isDeployConfigured()) {
    console.log(`${logPrefix}: skip — GCP not configured (run: npm run login)`);
    return;
  }

  const lockPath = acquireLock();
  if (!lockPath) {
    console.log(`${logPrefix}: skip — website deploy already in progress`);
    return;
  }

  try {
    console.log(`${logPrefix}: scheduling deploy:website…`);
    runDeployDetached(lockPath);
    console.log(`${logPrefix}: done`);
  } catch (err) {
    releaseLock(lockPath);
    throw err;
  }
}

main();
