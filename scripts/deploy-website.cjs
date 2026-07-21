/**
 * Deploy the Next.js marketing website to Cloud Run via GHCR.
 */
const { spawnSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { resolveGcpProjectId } = require("./gcp-config.cjs");
const { applyGcpEnv } = require("./apply-gcp-env.cjs");
const { resolveDownloadBase } = require("./public-download-url.cjs");
const { getDeployTarget } = require("./deploy-config.cjs");
const { recordDirectDeployOutcome } = require("./deploy-record-direct.cjs");

const root = path.join(__dirname, "..");
const websiteDir = path.join(root, "website");
const shell = process.platform === "win32";
const DEPLOY_REPO = "ct-mcp-website";
const DEPLOY_NPM_SCRIPT = "deploy:website";
const deployTarget = getDeployTarget(DEPLOY_REPO);
const deployStartedAt = new Date().toISOString();

function recordDeploy(status, { exitCode = 0, error = null } = {}) {
  recordDirectDeployOutcome({
    repo: DEPLOY_REPO,
    label: deployTarget?.label,
    npmScript: DEPLOY_NPM_SCRIPT,
    status,
    startedAt: deployStartedAt,
    exitCode,
    error,
  });
}

function fail(message) {
  recordDeploy("failure", { exitCode: 1, error: message });
  console.error(`deploy:website: ${message}`);
  process.exit(1);
}

function requireGhcrDeploy() {
  const candidates = [
    process.env.SUHERMAN_NET_INFRA_ROOT?.trim(),
    path.join(os.homedir(), "src", "personal", "suherman-net-infra"),
  ].filter(Boolean);
  for (const infraRoot of candidates) {
    const helper = path.join(infraRoot, "scripts", "lib", "ghcr-cloudrun-deploy.cjs");
    if (fs.existsSync(helper)) return require(helper);
  }
  fail("suherman-net-infra not found. Set SUHERMAN_NET_INFRA_ROOT or clone to ~/src/personal/suherman-net-infra");
}

function ensureGcpEnv() {
  return applyGcpEnv(root);
}

function run(command, args, options = {}) {
  const r = spawnSync(command, args, {
    stdio: "inherit",
    cwd: options.cwd || root,
    shell,
    env: ensureGcpEnv(),
  });
  if (r.error) throw r.error;
  if (r.status !== 0) {
    recordDeploy("failure", { exitCode: r.status ?? 1, error: `${command} exited ${r.status ?? 1}` });
    process.exit(r.status ?? 1);
  }
}

function main() {
  ensureGcpEnv();

  const projectId = resolveGcpProjectId(root);
  if (!projectId) fail("GCP_PROJECT_ID is not set. Run: npm run login");

  const region = process.env.GCP_LOCATION?.trim() || "australia-southeast1";
  const serviceName = process.env.WEBSITE_SERVICE?.trim() || "ct-mcp-website";
  const registryApiUrl =
    process.env.NEXT_PUBLIC_REGISTRY_API_URL?.trim() ||
    "https://ct-mcp-registry.suherman.net";
  const downloadBase = resolveDownloadBase();

  const { buildAndPushImage } = requireGhcrDeploy();
  let image;
  try {
    image = buildAndPushImage({
      cwd: root,
      contextDir: websiteDir,
      imageName: "ct-mcp-website",
      buildArgs: {
        NEXT_PUBLIC_REGISTRY_API_URL: registryApiUrl,
        NEXT_PUBLIC_PLUGIN_ID: "ct-mcp-studio",
        NEXT_PUBLIC_DOWNLOAD_BASE_URL: downloadBase,
      },
      logPrefix: "deploy:website",
    });
  } catch (error) {
    fail(error.message || String(error));
  }

  console.log(`deploy:website: deploying ${serviceName} ← ${image} (${region})…`);
  run("gcloud", [
    "run",
    "deploy",
    serviceName,
    "--image",
    image,
    "--project",
    projectId,
    "--region",
    region,
    "--allow-unauthenticated",
    "--quiet",
  ]);

  console.log("deploy:website: done");
  recordDeploy("success", { exitCode: 0 });
}

main();
