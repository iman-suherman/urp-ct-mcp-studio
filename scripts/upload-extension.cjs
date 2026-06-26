/**
 * Upload the packaged VSIX extension to Google Cloud Storage,
 * generate semver release notes, and register the version in Firestore.
 * Run: npm run login first.
 */
const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const { resolveGcpProjectId } = require("./gcp-config.cjs");
const { applyGcpEnv } = require("./apply-gcp-env.cjs");
const { ensureBucket, uploadObject } = require("./gcs-storage.cjs");
const { assertSemver } = require("./semver.cjs");
const { generateReleaseNotes, writeReleaseArtifacts } = require("./generate-release-notes.cjs");
const { registerPluginVersion } = require("./register-version.cjs");
const { assertVsixPackageVersion, readVsixPackageVersion } = require("./vsix-version.cjs");

const root = path.join(__dirname, "..");
const shell = process.platform === "win32";

let gcpEnv = process.env;

function fail(message) {
  console.error(`upload: ${message}`);
  process.exit(1);
}

function ensureGcpEnv() {
  gcpEnv = applyGcpEnv(root);
  return gcpEnv;
}

function run(command, args) {
  const r = spawnSync(command, args, {
    stdio: "inherit",
    cwd: root,
    shell,
    env: gcpEnv,
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

function resolveReleasesDir() {
  return path.join(root, "releases");
}

function readPackageJson() {
  return JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
}

function ensurePackageJsonVersion(version) {
  const pkg = readPackageJson();
  if (pkg.version !== version) {
    fail(
      `package.json is v${pkg.version} but release target is v${version}. Run npm run release so the version is bumped before packaging.`
    );
  }
}

function resolveVsixPath(version) {
  const packageJson = readPackageJson();
  const vsixName = `${packageJson.name}-${version}.vsix`;
  const vsixPath = path.join(resolveReleasesDir(), vsixName);

  if (fs.existsSync(vsixPath)) {
    try {
      const embedded = readVsixPackageVersion(vsixPath);
      if (embedded === version) {
        console.log(`upload: reusing ${vsixName} (embedded v${embedded})`);
        return vsixPath;
      }
      console.warn(
        `upload: stale ${vsixName} (embedded v${embedded}, expected v${version}) — rebuilding…`
      );
      fs.unlinkSync(vsixPath);
    } catch (err) {
      console.warn(`upload: unreadable ${vsixName} (${err.message}) — rebuilding…`);
      fs.unlinkSync(vsixPath);
    }
  }

  ensurePackageJsonVersion(version);
  console.log(`upload: packaging ${vsixName}…`);
  run("npm", ["run", "package"]);
  if (!fs.existsSync(vsixPath)) {
    fail(`expected VSIX at ${vsixPath} after packaging`);
  }
  assertVsixPackageVersion(vsixPath, version);
  console.log(`upload: verified ${vsixName} embeds v${version}`);
  return vsixPath;
}

async function uploadExtension(options = {}) {
  ensureGcpEnv();

  const projectId = resolveGcpProjectId(root);
  if (!projectId) {
    fail("GCP_PROJECT_ID is not set. Run: npm run login");
  }

  const packageJson = readPackageJson();
  const version = options.version || packageJson.version;
  assertSemver(version, "package.json version");
  if (options.version && packageJson.version !== options.version) {
    fail(
      `package.json is v${packageJson.version} but upload target is v${options.version}. Run npm run release instead of upload alone.`
    );
  }

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
  const vsixPath = resolveVsixPath(version);
  const vsixName = path.basename(vsixPath);
  const objectPath = prefix ? `${prefix}/${vsixName}` : vsixName;
  const latestObjectPath = prefix ? `${prefix}/latest.vsix` : "latest.vsix";
  const releaseNotesObjectPath = prefix
    ? `${prefix}/release-${version}.json`
    : `release-${version}.json`;
  const releaseNotesMarkdownPath = prefix
    ? `${prefix}/release-${version}.md`
    : `release-${version}.md`;

  await ensureBucket(bucket, projectId, resolveLocation());

  await uploadObject(bucket, vsixPath, objectPath, { projectId });
  await uploadObject(bucket, vsixPath, latestObjectPath, { projectId });
  await uploadObject(bucket, artifacts.jsonPath, releaseNotesObjectPath, { projectId });
  await uploadObject(bucket, artifacts.mdPath, releaseNotesMarkdownPath, { projectId });

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
