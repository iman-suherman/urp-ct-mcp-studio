/**
 * Shared helpers for async Commerce MCP Studio VSIX release workers.
 */
const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const { loadDotenv } = require("./load-dotenv.cjs");
const { resolveGcpProjectId } = require("./gcp-config.cjs");
const { getProjectAdcPath } = require("./gcp-lib-adc.cjs");
const { getPluginsTouchedByFiles } = require("./plugin-paths.cjs");

const root = path.join(__dirname, "..");
const DEPLOY_TARGET = "ct-mcp-extension";

function runGit(args) {
  const r = spawnSync("git", args, { cwd: root, encoding: "utf8", shell: process.platform === "win32" });
  if (r.status !== 0) return "";
  return (r.stdout || "").trim();
}

function getCommitFiles(commit = "HEAD") {
  const output = runGit(["diff-tree", "--no-commit-id", "--name-only", "-r", commit]);
  if (!output) return [];
  return output.split("\n").filter(Boolean);
}

function commitTouchesPlugin(files) {
  return getPluginsTouchedByFiles(files).length > 0;
}

function getPluginsForCommit(files) {
  return getPluginsTouchedByFiles(files);
}

function isReleaseConfigured() {
  loadDotenv(root);
  const projectId = resolveGcpProjectId(root);
  if (!projectId) return false;
  return fs.existsSync(getProjectAdcPath(root));
}

function scheduleExtensionRelease() {
  const trigger = path.join(__dirname, "deploy-trigger.cjs");
  spawnSync(process.execPath, [trigger, "--repo", DEPLOY_TARGET], {
    cwd: root,
    stdio: "inherit",
    env: process.env,
  });
}

module.exports = {
  root,
  DEPLOY_TARGET,
  runGit,
  getCommitFiles,
  commitTouchesPlugin,
  getPluginsForCommit,
  isReleaseConfigured,
  scheduleExtensionRelease,
};
