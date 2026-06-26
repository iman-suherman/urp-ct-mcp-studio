/**
 * Smart release: skip when HEAD matches last Firestore release commit,
 * otherwise bump semver, build, package, upload, and register.
 */
const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const { loadDotenv } = require("./load-dotenv.cjs");
const { getLatestPluginRelease, markReleaseCheckpoint } = require("./registry-read.cjs");
const { bumpSemver, assertSemver } = require("./semver.cjs");
const { suggestBumpLevel, getCommits } = require("./generate-release-notes.cjs");
const { uploadExtension } = require("./upload-extension.cjs");
const { getDeployTarget } = require("./deploy-config.cjs");
const { recordDirectDeployOutcome } = require("./deploy-record-direct.cjs");

const root = path.join(__dirname, "..");
const shell = process.platform === "win32";
const packageJsonPath = path.join(root, "package.json");
const DEPLOY_REPO = "ct-mcp-extension";
const DEPLOY_NPM_SCRIPT = "deploy:extension";
const deployTarget = getDeployTarget(DEPLOY_REPO);
const deployStartedAt = new Date().toISOString();
let deployRecorded = false;

function recordDeploy(status, { exitCode = 0, error = null, activityMessage = null } = {}) {
  if (deployRecorded) return;
  deployRecorded = true;
  recordDirectDeployOutcome({
    repo: DEPLOY_REPO,
    label: deployTarget?.label,
    npmScript: DEPLOY_NPM_SCRIPT,
    status,
    startedAt: deployStartedAt,
    exitCode,
    error,
    activityMessage,
  });
}

function run(command, args) {
  const r = spawnSync(command, args, {
    stdio: "inherit",
    cwd: root,
    shell,
    env: process.env,
  });
  if (r.error) throw r.error;
  if (r.status !== 0) {
    recordDeploy("failure", {
      exitCode: r.status ?? 1,
      error: `${command} exited ${r.status ?? 1}`,
    });
    process.exit(r.status ?? 1);
  }
}

function runGit(args) {
  const r = spawnSync("git", args, {
    cwd: root,
    encoding: "utf8",
    shell,
  });
  if (r.status !== 0) return "";
  return (r.stdout || "").trim();
}

function getHeadCommit() {
  return runGit(["rev-parse", "HEAD"]);
}

function hasWorkingTreeChanges() {
  return Boolean(runGit(["status", "--porcelain"]));
}

function getCommitsSince(sinceCommit) {
  if (!sinceCommit) {
    const output = runGit(["log", "HEAD", "--pretty=format:%H|%s|%an"]);
    if (!output) return [];
    return output.split("\n").filter(Boolean).map((line) => {
      const [hash, subject, author] = line.split("|");
      return { hash, subject: subject || "", author: author || "" };
    });
  }

  const range = `${sinceCommit}..HEAD`;
  const count = runGit(["rev-list", "--count", range]);
  if (count === "0") return [];
  return getCommits(range);
}

function readPackageJson() {
  return JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
}

function writePackageVersion(version) {
  const pkg = readPackageJson();
  pkg.version = version;
  fs.writeFileSync(packageJsonPath, `${JSON.stringify(pkg, null, 2)}\n`, "utf8");
  console.log(`release: set package.json version → ${version}`);
}

function resolveNextVersion(lastReleasedVersion, commits) {
  const baseVersion = lastReleasedVersion || readPackageJson().version;
  assertSemver(baseVersion, "base version");
  const bump = suggestBumpLevel(commits);
  return { version: bumpSemver(baseVersion, bump), bump };
}

function getGitReleaseState() {
  const tag = runGit(["describe", "--tags", "--abbrev=0", "--match", "v*"]);
  if (!tag) return null;
  const version = tag.replace(/^v/, "");
  const commit = runGit(["rev-list", "-n", "1", tag]);
  if (!commit) return null;
  return { lastReleasedCommit: commit, lastReleasedVersion: version, source: "git-tag" };
}

async function main() {
  loadDotenv(root);

  const pkg = readPackageJson();
  const pluginId = pkg.name;
  const headCommit = getHeadCommit();
  if (!headCommit) {
    console.error("release: not a git repository or unable to read HEAD");
    process.exit(1);
  }

  let releaseState = await getLatestPluginRelease(pluginId);
  if (!releaseState.lastReleasedCommit) {
    const gitState = getGitReleaseState();
    if (gitState) {
      releaseState = { ...releaseState, ...gitState };
      console.log(
        `release: using ${gitState.source} checkpoint v${gitState.lastReleasedVersion} (${gitState.lastReleasedCommit.slice(0, 7)})`
      );
    }
  } else if (releaseState.source === "firestore") {
    console.log(
      `release: using firestore checkpoint v${releaseState.lastReleasedVersion} (${releaseState.lastReleasedCommit.slice(0, 7)})`
    );
  }

  const lastCommit = releaseState.lastReleasedCommit;
  const commitsSinceLast = getCommitsSince(lastCommit);
  const dirty = hasWorkingTreeChanges();

  if (lastCommit && headCommit === lastCommit && commitsSinceLast.length === 0) {
    if (dirty) {
      console.log(
        `release: skip — no new commits since last release (${lastCommit.slice(0, 7)}, v${releaseState.lastReleasedVersion || "?"}); commit changes first`
      );
    } else {
      console.log(
        `release: skip — no code changes since last release (${lastCommit.slice(0, 7)}, v${releaseState.lastReleasedVersion || "?"})`
      );
    }
    try {
      await markReleaseCheckpoint(
        pluginId,
        headCommit,
        releaseState.lastReleasedVersion || pkg.version
      );
    } catch (err) {
      console.warn(`release: could not update Firestore checkpoint (${err.message})`);
    }
    return;
  }

  let version;
  if (!releaseState.lastReleasedVersion) {
    version = pkg.version;
    assertSemver(version, "package.json version");
    console.log(`release: first release at v${version} (${headCommit.slice(0, 7)})`);
  } else {
    const next = resolveNextVersion(releaseState.lastReleasedVersion, commitsSinceLast);
    version = next.version;
    writePackageVersion(version);
    console.log(
      `release: ${commitsSinceLast.length} commit(s) since ${lastCommit?.slice(0, 7) || "?"} — ${next.bump} bump → v${version}`
    );
  }

  console.log("release: building…");
  run("npm", ["run", "build"]);
  console.log("release: packaging…");
  run("npm", ["run", "package"]);
  const { assertVsixPackageVersion } = require("./vsix-version.cjs");
  const vsixPath = path.join(root, "releases", `${pkg.name}-${version}.vsix`);
  assertVsixPackageVersion(vsixPath, version);
  console.log(`release: verified ${path.basename(vsixPath)} embeds v${version}`);

  await uploadExtension({
    version,
    sinceCommit: lastCommit,
    previousVersion: releaseState.lastReleasedVersion,
  });

  await markReleaseCheckpoint(pluginId, headCommit, version);
  console.log(`release: done — v${version} (${headCommit.slice(0, 7)})`);
  recordDeploy("success", {
    exitCode: 0,
    activityMessage: `release: done — v${version} (${headCommit.slice(0, 7)})`,
  });
}

main().catch((err) => {
  recordDeploy("failure", { exitCode: 1, error: err.message || String(err) });
  console.error(err);
  process.exit(1);
});
