/**
 * Register a plugin version in Firestore after GCS upload.
 */
const { Firestore, FieldValue } = require("@google-cloud/firestore");
const path = require("path");
const { loadDotenv } = require("./load-dotenv.cjs");
const { getProjectAdcPath } = require("./gcp-lib-adc.cjs");
const { resolveGcpProjectId } = require("./gcp-config.cjs");
const { versionSortKey, versionDocId } = require("./semver.cjs");
const fs = require("fs");

const root = path.join(__dirname, "..");

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

function getCollectionName() {
  return process.env.FIRESTORE_PLUGIN_COLLECTION?.trim() || "mcp_plugin_versions";
}

function getCatalogCollection() {
  return process.env.FIRESTORE_PLUGIN_CATALOG?.trim() || "mcp_plugin_catalog";
}

async function registerPluginVersion({
  release,
  bucket,
  objectPath,
  latestObjectPath,
  releaseNotesObjectPath,
  sizeBytes,
  publishedBy,
}) {
  applyGcpEnv();

  const projectId = resolveGcpProjectId(root);
  if (!projectId) {
    throw new Error("GCP_PROJECT_ID is not set. Run: npm run login");
  }

  const firestore = new Firestore({ projectId });
  const collection = getCollectionName();
  const docId = versionDocId(release.pluginId, release.version);
  const sortKey = versionSortKey(release.semver);

  const record = {
    pluginId: release.pluginId,
    displayName: release.displayName,
    publisher: release.publisher,
    version: release.version,
    semver: release.semver,
    versionSortKey: sortKey,
    summary: release.summary,
    releaseNotes: release.releaseNotes,
    releaseNotesMarkdown: release.releaseNotesMarkdown,
    gcs: {
      bucket,
      objectPath,
      latestObjectPath,
      releaseNotesObjectPath,
      vsixFileName: path.basename(objectPath),
    },
    downloadUrl: `gs://${bucket}/${objectPath}`,
    publicDownloadUrl: `https://storage.googleapis.com/${bucket}/${objectPath}`,
    latestDownloadUrl: `gs://${bucket}/${latestObjectPath}`,
    publicLatestDownloadUrl: `https://storage.googleapis.com/${bucket}/${latestObjectPath}`,
    releaseNotesUrl: releaseNotesObjectPath
      ? `gs://${bucket}/${releaseNotesObjectPath}`
      : null,
    sizeBytes: sizeBytes || null,
    gitCommit: release.gitCommit || null,
    gitTag: release.gitTag || null,
    previousTag: release.previousTag || null,
    commitCount: release.commitCount || 0,
    publishedBy: publishedBy || null,
    publishedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };

  await firestore.collection(collection).doc(docId).set(record, { merge: true });

  await firestore
    .collection(getCatalogCollection())
    .doc(release.pluginId)
    .set(
      {
        pluginId: release.pluginId,
        displayName: release.displayName,
        publisher: release.publisher,
        latestVersion: release.version,
        latestVersionSortKey: sortKey,
        lastReleasedCommit: release.gitCommit || null,
        lastReleasedVersion: release.version,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

  return { projectId, collection, docId, record };
}

if (require.main === module) {
  const releasePath = process.argv[2];
  if (!releasePath) {
    console.error("Usage: node scripts/register-version.cjs <release-json-path>");
    process.exit(1);
  }

  const release = JSON.parse(fs.readFileSync(releasePath, "utf8"));
  registerPluginVersion({
    release,
    bucket: process.env.GCS_EXTENSION_BUCKET,
    objectPath: process.env.REGISTER_OBJECT_PATH,
    latestObjectPath: process.env.REGISTER_LATEST_OBJECT_PATH,
    releaseNotesObjectPath: process.env.REGISTER_RELEASE_NOTES_OBJECT_PATH,
    sizeBytes: Number(process.env.REGISTER_SIZE_BYTES || 0) || null,
    publishedBy: process.env.GCP_USER_EMAIL || null,
  })
    .then((result) => {
      console.log(
        `register: wrote ${result.collection}/${result.docId} in project ${result.projectId}`
      );
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = { registerPluginVersion, getCollectionName, getCatalogCollection };
