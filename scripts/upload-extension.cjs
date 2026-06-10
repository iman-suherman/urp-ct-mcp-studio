/**
 * Upload the packaged VSIX extension to Google Cloud Storage,
 * generate semver release notes, and register the version in Firestore.
 * Run: npm run login first.
 */
const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const { resolveGcpProjectId } = require("./gcp-config.cjs");
const { getProjectAdcPath } = require("./gcp-lib-adc.cjs");
const { loadDotenv } = require("./load-dotenv.cjs");
const { assertSemver } = require("./semver.cjs");
const { generateReleaseNotes, writeReleaseArtifacts } = require("./generate-release-notes.cjs");
const { registerPluginVersion } = require("./register-version.cjs");

const root = path.join(__dirname, "..");
const shell = process.platform === "win32";

function fail(message) {
  console.error(`upload: ${message}`);
  process.exit(1);
}

function applyGcpEnv() {
  loadDotenv(root);

  const projectAdc = getProjectAdcPath(root);
  if (fs.existsSync(projectAdc)) {
    process.env.GOOGLE_APPLICATION_CREDENTIALS = projectAdc;
    return;
  }

  const configured = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!configured) return;

  const resolved = path.isAbsolute(configured)
    ? configured
    : path.join(root, configured);
  if (fs.existsSync(resolved)) {
    process.env.GOOGLE_APPLICATION_CREDENTIALS = resolved;
  }
}

function run(command, args) {
  const r = spawnSync(command, args, {
    stdio: "inherit",
    cwd: root,
    shell,
    env: process.env,
    encoding: "utf8",
  });

  if (r.error) throw r.error;
  if (r.status !== 0) process.exit(r.status ?? 1);
  return r;
}

function resolveBucket(projectId) {
  const configured = process.env.GCS_EXTENSION_BUCKET?.trim();
  if (configured) return configured;
  return `${projectId}-ct-mcp-studio`;
}

function resolveLocation() {
  return process.env.GCS_LOCATION?.trim() || "australia-southeast1";
}

function resolvePrefix() {
  const prefix = process.env.GCS_EXTENSION_PREFIX?.trim() || "extensions";
  return prefix.replace(/^\/+|\/+$/g, "");
}

function resolveVsixPath(packageJson, version) {
  const vsixName = `${packageJson.name}-${version}.vsix`;
  const vsixPath = path.join(root, vsixName);
  if (fs.existsSync(vsixPath)) return vsixPath;

  console.log("upload: VSIX not found — running npm run package…");
  run("npm", ["run", "package"]);
  if (!fs.existsSync(vsixPath)) {
    fail(`expected VSIX at ${vsixPath} after packaging`);
  }
  return vsixPath;
}

function bucketExists(bucket, projectId) {
  const r = spawnSync(
    "gcloud",
    [
      "storage",
      "buckets",
      "describe",
      `gs://${bucket}`,
      "--project",
      projectId,
      "--format=value(name)",
    ],
    { cwd: root, shell, env: process.env, encoding: "utf8" }
  );
  return r.status === 0;
}

function ensureBucket(bucket, projectId, location) {
  if (bucketExists(bucket, projectId)) {
    console.log(`upload: using bucket gs://${bucket}`);
    return;
  }

  console.log(`upload: creating bucket gs://${bucket} (${location})…`);
  run("gcloud", [
    "storage",
    "buckets",
    "create",
    `gs://${bucket}`,
    "--project",
    projectId,
    "--location",
    location,
    "--uniform-bucket-level-access",
  ]);
  console.log(`upload: created bucket gs://${bucket}`);
}

async function uploadExtension(options = {}) {
  applyGcpEnv();

  const projectId = resolveGcpProjectId(root);
  if (!projectId) {
    fail("GCP_PROJECT_ID is not set. Run: npm run login");
  }

  const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
  const version = options.version || packageJson.version;
  assertSemver(version, "package.json version");

  const previousLabel = options.previousVersion
    ? `v${options.previousVersion}`
    : options.sinceCommit?.slice(0, 7);

  const release = generateReleaseNotes({
    version,
    sinceCommit: options.sinceCommit || null,
    previousLabel,
  });
  const artifacts = writeReleaseArtifacts(release);
  console.log(`upload: release notes → ${artifacts.jsonPath}`);
  console.log(`upload: ${release.summary}`);

  const bucket = resolveBucket(projectId);
  const prefix = resolvePrefix();
  const vsixPath = resolveVsixPath(packageJson, version);
  const vsixName = path.basename(vsixPath);
  const objectPath = prefix ? `${prefix}/${vsixName}` : vsixName;
  const latestObjectPath = prefix ? `${prefix}/latest.vsix` : "latest.vsix";
  const releaseNotesObjectPath = prefix
    ? `${prefix}/release-${version}.json`
    : `release-${version}.json`;
  const releaseNotesMarkdownPath = prefix
    ? `${prefix}/release-${version}.md`
    : `release-${version}.md`;

  ensureBucket(bucket, projectId, resolveLocation());

  console.log(`upload: uploading ${vsixName} → gs://${bucket}/${objectPath}`);
  run("gcloud", ["storage", "cp", vsixPath, `gs://${bucket}/${objectPath}`, "--project", projectId]);

  console.log(`upload: uploading latest copy → gs://${bucket}/${latestObjectPath}`);
  run("gcloud", [
    "storage",
    "cp",
    vsixPath,
    `gs://${bucket}/${latestObjectPath}`,
    "--project",
    projectId,
  ]);

  console.log(`upload: uploading release notes → gs://${bucket}/${releaseNotesObjectPath}`);
  run("gcloud", [
    "storage",
    "cp",
    artifacts.jsonPath,
    `gs://${bucket}/${releaseNotesObjectPath}`,
    "--project",
    projectId,
  ]);

  run("gcloud", [
    "storage",
    "cp",
    artifacts.mdPath,
    `gs://${bucket}/${releaseNotesMarkdownPath}`,
    "--project",
    projectId,
  ]);

  const sizeBytes = fs.statSync(vsixPath).size;
  const registration = await registerPluginVersion({
    release,
    bucket,
    objectPath,
    latestObjectPath,
    releaseNotesObjectPath,
    sizeBytes,
    publishedBy: process.env.GCP_USER_EMAIL || null,
  });

  console.log("upload: done");
  console.log(`upload: gs://${bucket}/${objectPath}`);
  console.log(`upload: gs://${bucket}/${latestObjectPath}`);
  console.log(`upload: gs://${bucket}/${releaseNotesObjectPath}`);
  console.log(
    `upload: firestore ${registration.collection}/${registration.docId} (${registration.projectId})`
  );

  return registration;
}

async function main() {
  await uploadExtension();
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { uploadExtension };
