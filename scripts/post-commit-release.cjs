/**
 * Background worker invoked from the post-commit hook.
 * Schedules a tracked VSIX release when the latest commit touches plugin paths.
 */
const {
  getCommitFiles,
  commitTouchesPlugin,
  getPluginsForCommit,
  isReleaseConfigured,
  scheduleExtensionRelease,
} = require("./extension-release-worker.cjs");

const logPrefix = "post-commit-release";

function main() {
  if (process.env.CT_MCP_POST_COMMIT_RELEASE === "0") {
    console.log(`${logPrefix}: disabled (CT_MCP_POST_COMMIT_RELEASE=0)`);
    return;
  }

  const files = getCommitFiles();
  if (!commitTouchesPlugin(files)) {
    console.log(`${logPrefix}: skip — commit has no ct-mcp plugin file changes`);
    return;
  }

  const plugins = getPluginsForCommit(files);
  console.log(`${logPrefix}: plugin changes detected (${plugins.join(", ")})`);

  if (!isReleaseConfigured()) {
    console.log(`${logPrefix}: skip — GCP not configured (run: npm run login)`);
    return;
  }

  console.log(`${logPrefix}: scheduling ct-mcp-extension release…`);
  scheduleExtensionRelease();
  console.log(`${logPrefix}: done — track with npm run ci`);
}

main();
