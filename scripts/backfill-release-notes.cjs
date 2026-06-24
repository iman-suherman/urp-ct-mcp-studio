/**
 * Regenerate release note artifacts from curated releases/notes/{version}.json files.
 * Optionally merge updated notes into Firestore without re-uploading VSIX files.
 *
 * Usage:
 *   node scripts/backfill-release-notes.cjs
 *   node scripts/backfill-release-notes.cjs --register
 *   node scripts/backfill-release-notes.cjs 0.1.22
 */
const { Firestore } = require("@google-cloud/firestore");
const fs = require("fs");
const path = require("path");
const { loadDotenv } = require("./load-dotenv.cjs");
const { getProjectAdcPath } = require("./gcp-lib-adc.cjs");
const { resolveGcpProjectId } = require("./gcp-config.cjs");
const { getCollectionName } = require("./register-version.cjs");
const { versionDocId } = require("./semver.cjs");
const {
  generateReleaseNotes,
  writeReleaseArtifacts,
} = require("./generate-release-notes.cjs");
const { listCuratedVersions } = require("./read-release-notes.cjs");

const root = path.join(__dirname, "..");

function applyGcpEnv() {
  loadDotenv(root);
  const projectAdc = getProjectAdcPath(root);
  if (projectAdc && fs.existsSync(projectAdc)) {
    process.env.GOOGLE_APPLICATION_CREDENTIALS = projectAdc;
  }
}

async function mergeReleaseNotesInFirestore(release) {
  applyGcpEnv();
  const projectId = resolveGcpProjectId(root);
  if (!projectId) {
    throw new Error("GCP_PROJECT_ID is not set. Run: npm run login");
  }

  const firestore = new Firestore({ projectId });
  const collection = getCollectionName();
  const docId = versionDocId(release.pluginId, release.version);
  const docRef = firestore.collection(collection).doc(docId);
  const snap = await docRef.get();
  if (!snap.exists) {
    console.warn(`backfill: skip Firestore ${docId} — document not found`);
    return false;
  }

  await docRef.set(
    {
      summary: release.summary,
      releaseNotes: release.releaseNotes,
      releaseNotesMarkdown: release.releaseNotesMarkdown,
      highlights: release.highlights ?? [],
      mandatory: release.mandatory === true,
      updatedAt: new Date(),
    },
    { merge: true }
  );

  console.log(`backfill: updated Firestore ${collection}/${docId}`);
  return true;
}

async function uploadNotesToGcs(release, paths) {
  const { uploadObject } = require("./gcs-storage.cjs");
  const projectId = resolveGcpProjectId(root);
  const bucket =
    process.env.GCS_EXTENSION_BUCKET?.trim() || `${projectId}-ct-mcp-studio`;
  const prefix = (process.env.GCS_EXTENSION_PREFIX?.trim() || "extensions").replace(
    /^\/+|\/+$/g,
    ""
  );
  const jsonObject = prefix
    ? `${prefix}/release-${release.version}.json`
    : `release-${release.version}.json`;
  const mdObject = prefix
    ? `${prefix}/release-${release.version}.md`
    : `release-${release.version}.md`;

  await uploadObject(bucket, paths.jsonPath, jsonObject, { projectId });
  await uploadObject(bucket, paths.mdPath, mdObject, { projectId });
  console.log(`backfill: uploaded notes for v${release.version} to gs://${bucket}`);
}

async function main() {
  const args = process.argv.slice(2);
  const register = args.includes("--register");
  const upload = args.includes("--upload");
  const versions = args.filter((arg) => /^\d+\.\d+\.\d+$/.test(arg));
  const targets = versions.length ? versions : listCuratedVersions(root);

  if (!targets.length) {
    console.error("backfill: no curated notes found in releases/notes/");
    process.exit(1);
  }

  console.log(`backfill: regenerating ${targets.length} release note set(s)…`);

  for (const version of targets) {
    const release = generateReleaseNotes({ version });
    const paths = writeReleaseArtifacts(release);
    console.log(`backfill: wrote ${paths.jsonPath}`);

    if (upload) {
      await uploadNotesToGcs(release, paths);
    }
    if (register) {
      await mergeReleaseNotesInFirestore(release);
    }
  }

  console.log("backfill: done");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
