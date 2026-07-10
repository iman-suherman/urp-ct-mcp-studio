/**
 * Cloud Secret Manager (CSM) helpers for CT MCP Studio.
 */
const path = require("path");
const { createCsmSecrets } = require("./csm-repo-env.cjs");

const repoRoot = path.join(__dirname, "..");

const MANAGED_SECRETS = [
  "GCP_USER_EMAIL",
  "GCP_PROJECT_ID",
  "GCS_EXTENSION_BUCKET",
];

const MANAGED_FILE_SECRETS = [];

const csm = createCsmSecrets(repoRoot, {
  managedSecrets: MANAGED_SECRETS,
  managedFileSecrets: MANAGED_FILE_SECRETS,
});

module.exports = {
  MANAGED_SECRETS,
  MANAGED_FILE_SECRETS,
  ...csm,
};
