/**
 * GCS helpers using @google-cloud/storage (avoids gcloud storage cp Python issues).
 */
const path = require("path");
const { Storage } = require("@google-cloud/storage");
const { applyGcpEnv } = require("./apply-gcp-env.cjs");
const { resolveGcpProjectId } = require("./gcp-config.cjs");

const root = path.join(__dirname, "..");

function contentTypeFor(filePath) {
  if (filePath.endsWith(".vsix")) return "application/octet-stream";
  if (filePath.endsWith(".json")) return "application/json";
  if (filePath.endsWith(".md")) return "text/markdown";
  return "application/octet-stream";
}

function createStorage(projectId) {
  applyGcpEnv(root);
  const resolvedProjectId = projectId || resolveGcpProjectId(root);
  if (!resolvedProjectId) {
    throw new Error("GCP_PROJECT_ID is not set. Run: npm run login");
  }
  return { storage: new Storage({ projectId: resolvedProjectId }), projectId: resolvedProjectId };
}

async function ensureBucket(bucketName, projectId, location) {
  const { storage } = createStorage(projectId);
  const bucket = storage.bucket(bucketName);
  const [exists] = await bucket.exists();
  if (exists) {
    console.log(`upload: using bucket gs://${bucketName}`);
    return bucket;
  }

  console.log(`upload: creating bucket gs://${bucketName} (${location})…`);
  await storage.createBucket(bucketName, {
    location,
    uniformBucketLevelAccess: true,
  });
  console.log(`upload: created bucket gs://${bucketName}`);
  return storage.bucket(bucketName);
}

async function uploadObject(bucketName, localPath, objectPath, options = {}) {
  const { storage } = createStorage(options.projectId);
  const bucket = storage.bucket(bucketName);
  const fileName = path.basename(localPath);

  console.log(`upload: uploading ${fileName} → gs://${bucketName}/${objectPath}`);
  await bucket.upload(localPath, {
    destination: objectPath,
    metadata: {
      contentType: contentTypeFor(localPath),
    },
  });
}

module.exports = {
  ensureBucket,
  uploadObject,
};
