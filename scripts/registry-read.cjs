/**
 * Read plugin release state from Firestore (used by release + upload scripts).
 */
const { Firestore, FieldValue } = require("@google-cloud/firestore");
const fs = require("fs");
const path = require("path");
const { loadDotenv } = require("./load-dotenv.cjs");
const { getProjectAdcPath } = require("./gcp-lib-adc.cjs");
const { resolveGcpProjectId } = require("./gcp-config.cjs");
const { getCollectionName, getCatalogCollection } = require("./register-version.cjs");

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

function getFirestore() {
  applyGcpEnv();
  const projectId = resolveGcpProjectId(root);
  if (!projectId) {
    throw new Error("GCP_PROJECT_ID is not set. Run: npm run login");
  }
  return { firestore: new Firestore({ projectId }), projectId };
}

async function getLatestPluginRelease(pluginId) {
  try {
    const { firestore } = getFirestore();
    const catalogRef = firestore.collection(getCatalogCollection()).doc(pluginId);
    const catalogSnap = await catalogRef.get();
    const catalog = catalogSnap.exists ? catalogSnap.data() : null;

    const versionsSnap = await firestore
      .collection(getCollectionName())
      .where("pluginId", "==", pluginId)
      .orderBy("versionSortKey", "desc")
      .limit(1)
      .get();

    const latestVersion = versionsSnap.empty ? null : versionsSnap.docs[0].data();
    const lastReleasedCommit =
      catalog?.lastReleasedCommit || latestVersion?.gitCommit || null;

    return {
      catalog,
      latestVersion,
      lastReleasedCommit,
      lastReleasedVersion: catalog?.lastReleasedVersion || latestVersion?.version || null,
      source: "firestore",
    };
  } catch (err) {
    if (err.code === 5 || /NOT_FOUND/i.test(String(err.message))) {
      return {
        catalog: null,
        latestVersion: null,
        lastReleasedCommit: null,
        lastReleasedVersion: null,
        source: "firestore-unavailable",
      };
    }
    throw err;
  }
}

async function markReleaseCheckpoint(pluginId, gitCommit, version) {
  const { firestore } = getFirestore();
  await firestore
    .collection(getCatalogCollection())
    .doc(pluginId)
    .set(
      {
        pluginId,
        lastReleasedCommit: gitCommit,
        lastReleasedVersion: version,
        lastReleaseCheckedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
}

module.exports = {
  getLatestPluginRelease,
  markReleaseCheckpoint,
};
