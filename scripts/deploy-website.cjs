/**
 * Deploy the Next.js marketing website to Cloud Run.
 */
const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const { resolveGcpProjectId } = require("./gcp-config.cjs");
const { getProjectAdcPath } = require("./gcp-lib-adc.cjs");
const { loadDotenv } = require("./load-dotenv.cjs");

const root = path.join(__dirname, "..");
const websiteDir = path.join(root, "website");
const shell = process.platform === "win32";

function fail(message) {
  console.error(`deploy:website: ${message}`);
  process.exit(1);
}

function applyGcpEnv() {
  loadDotenv(root);
  const projectAdc = getProjectAdcPath(root);
  if (fs.existsSync(projectAdc)) {
    process.env.GOOGLE_APPLICATION_CREDENTIALS = projectAdc;
  }
}

function run(command, args, options = {}) {
  const r = spawnSync(command, args, {
    stdio: "inherit",
    cwd: options.cwd || root,
    shell,
    env: process.env,
  });
  if (r.error) throw r.error;
  if (r.status !== 0) process.exit(r.status ?? 1);
}

function main() {
  applyGcpEnv();

  const projectId = resolveGcpProjectId(root);
  if (!projectId) fail("GCP_PROJECT_ID is not set. Run: npm run login");

  const region = process.env.GCP_LOCATION?.trim() || "australia-southeast1";
  const serviceName = process.env.WEBSITE_SERVICE?.trim() || "ct-mcp-website";
  const registryApiUrl =
    process.env.NEXT_PUBLIC_REGISTRY_API_URL?.trim() ||
    "https://ct-mcp-registry.suherman.net";
  const downloadBase =
    process.env.NEXT_PUBLIC_DOWNLOAD_BASE_URL?.trim() ||
    (process.env.GCS_EXTENSION_BUCKET
      ? `https://storage.googleapis.com/${process.env.GCS_EXTENSION_BUCKET}/extensions`
      : `https://storage.googleapis.com/${projectId}-ct-mcp-studio/extensions`);

  console.log(`deploy:website: deploying ${serviceName} to Cloud Run (${region})…`);
  run("gcloud", [
    "run",
    "deploy",
    serviceName,
    "--source",
    websiteDir,
    "--project",
    projectId,
    "--region",
    region,
    "--allow-unauthenticated",
    "--quiet",
    "--set-build-env-vars",
    `NEXT_PUBLIC_REGISTRY_API_URL=${registryApiUrl},NEXT_PUBLIC_PLUGIN_ID=ct-mcp-studio,NEXT_PUBLIC_DOWNLOAD_BASE_URL=${downloadBase}`,
  ]);

  console.log("deploy:website: done");
}

main();
