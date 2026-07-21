/**
 * Deploy the registry API to Cloud Run and ensure Firestore indexes exist.
 */
const { spawnSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { resolveGcpProjectId } = require("./gcp-config.cjs");
const { applyGcpEnv } = require("./apply-gcp-env.cjs");

const root = path.join(__dirname, "..");
const serviceDir = path.join(root, "services", "registry-api");
const shell = process.platform === "win32";

function fail(message) {
  console.error(`deploy:registry: ${message}`);
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
  if (r.status !== 0) process.exit(r.status ?? 1);
}

function main() {
  ensureGcpEnv();

  const projectId = resolveGcpProjectId(root);
  if (!projectId) fail("GCP_PROJECT_ID is not set. Run: npm run login");

  const region = process.env.GCP_LOCATION?.trim() || "australia-southeast1";
  const serviceName = process.env.REGISTRY_API_SERVICE?.trim() || "ct-mcp-registry-api";
  const collection = process.env.FIRESTORE_PLUGIN_COLLECTION?.trim() || "mcp_plugin_versions";
  const catalog = process.env.FIRESTORE_PLUGIN_CATALOG?.trim() || "mcp_plugin_catalog";
  const downloadBase =
    process.env.PUBLIC_DOWNLOAD_BASE_URL?.trim() ||
    "https://ct-mcp-download.suherman.net/downloads";
  const websiteBase =
    process.env.WEBSITE_BASE_URL?.trim() || "https://ct-mcp.suherman.net";
  const defaultPluginId =
    process.env.DEFAULT_PLUGIN_ID?.trim() || "ct-mcp-studio";

  const indexesPath = path.join(root, "firestore", "indexes.json");
  if (fs.existsSync(indexesPath)) {
    console.log("deploy:registry: ensuring Firestore composite index…");
    const indexResult = spawnSync(
      "gcloud",
      [
        "firestore",
        "indexes",
        "composite",
        "create",
        "--collection-group",
        collection,
        "--query-scope",
        "COLLECTION",
        "--field-config",
        "field-path=pluginId,order=ASCENDING",
        "--field-config",
        "field-path=versionSortKey,order=DESCENDING",
        "--project",
        projectId,
        "--database=(default)",
        "--quiet",
      ],
      { cwd: root, shell, env: process.env, encoding: "utf8" }
    );
    if (indexResult.status === 0) {
      console.log("deploy:registry: Firestore index created or already exists");
    } else {
      console.warn(
        "deploy:registry: Firestore index step skipped — create manually from firestore/indexes.json if queries fail"
      );
    }
  }

  const { buildAndPushImage } = requireGhcrDeploy();
  let image;
  try {
    image = buildAndPushImage({
      cwd: root,
      contextDir: serviceDir,
      imageName: "ct-mcp-registry-api",
      logPrefix: "deploy:registry",
    });
  } catch (error) {
    fail(error.message || String(error));
  }

  console.log(`deploy:registry: deploying ${serviceName} ← ${image} (${region})…`);
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
    "--set-env-vars",
    `GCP_PROJECT_ID=${projectId},FIRESTORE_PLUGIN_COLLECTION=${collection},FIRESTORE_PLUGIN_CATALOG=${catalog},PUBLIC_DOWNLOAD_BASE_URL=${downloadBase},WEBSITE_BASE_URL=${websiteBase},DEFAULT_PLUGIN_ID=${defaultPluginId}`,
  ]);

  console.log("deploy:registry: done");
}

main();
