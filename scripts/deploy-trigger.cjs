#!/usr/bin/env node
/**
 * Fire-and-forget deploy trigger — returns immediately (safe for git hooks).
 *
 * Usage:
 *   node scripts/deploy-trigger.cjs --repo ct-mcp-website
 */

const path = require("node:path");
const { spawn, spawnSync } = require("node:child_process");
const { REPO_ROOT, getDeployTarget } = require("./deploy-config.cjs");
const { updateState, getRepoState, readState } = require("./deploy-store.cjs");

const RUNNER = path.join(REPO_ROOT, "scripts/deploy-runner.cjs");

function parseArgs(argv) {
  let repo = null;
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--repo" && argv[i + 1]) repo = argv[++i];
    else if (argv[i] === "-h" || argv[i] === "--help") {
      console.log("Usage: node scripts/deploy-trigger.cjs --repo ct-mcp-website");
      process.exit(0);
    }
  }
  if (!repo) {
    console.error("error: --repo is required");
    process.exit(1);
  }
  return { repo };
}

function gitHead() {
  const result = spawnSync("git", ["rev-parse", "HEAD"], {
    cwd: REPO_ROOT,
    encoding: "utf8",
  });
  return result.status === 0 ? result.stdout.trim() : null;
}

function gitBranch() {
  const result = spawnSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], {
    cwd: REPO_ROOT,
    encoding: "utf8",
  });
  return result.status === 0 ? result.stdout.trim() || "main" : "main";
}

function isBusy(repo) {
  const state = readState();
  const rs = state.repos[repo];
  return rs?.status === "in_progress" || rs?.status === "queued";
}

function spawnBackgroundDeploy(repo, sha, branch) {
  const child = spawn(
    process.execPath,
    [RUNNER, "--repo", repo, "--sha", sha, "--background"],
    {
      cwd: REPO_ROOT,
      detached: true,
      stdio: "ignore",
      env: process.env,
    },
  );
  child.unref();
  return child.pid;
}

function main() {
  const { repo } = parseArgs(process.argv.slice(2));
  const target = getDeployTarget(repo);

  if (!target?.npmScript) {
    process.exit(0);
  }

  const sha = gitHead();
  const branch = target.branch || gitBranch();
  if (!sha) {
    process.exit(0);
  }

  if (isBusy(repo)) {
    updateState((state) => {
      const rs = getRepoState(state, repo);
      rs.headSha = sha;
      rs.branch = branch;
      return state;
    });
    process.exit(0);
  }

  updateState((state) => {
    const rs = getRepoState(state, repo);
    rs.headSha = sha;
    rs.branch = branch;
    rs.status = "queued";
    return state;
  });

  spawnBackgroundDeploy(repo, sha, branch);
}

main();
