const DEFAULT_DOWNLOAD_BASE = "https://ct-mcp-download.suherman.net/downloads";

function resolveDownloadBase() {
  return (
    process.env.PUBLIC_DOWNLOAD_BASE_URL?.trim() || DEFAULT_DOWNLOAD_BASE
  ).replace(/\/$/, "");
}

function basename(objectPath) {
  if (!objectPath) return null;
  const parts = objectPath.split("/");
  return parts[parts.length - 1] || null;
}

function vsixFileName(version) {
  if (version.gcs?.vsixFileName) return version.gcs.vsixFileName;
  const fromPath = basename(version.gcs?.objectPath);
  if (fromPath) return fromPath;
  if (version.publicDownloadUrl) {
    try {
      const parts = new URL(version.publicDownloadUrl).pathname.split("/");
      const last = parts[parts.length - 1];
      if (last?.endsWith(".vsix")) return last;
    } catch {
      /* ignore */
    }
  }
  if (version.version && version.pluginId) {
    return `${version.pluginId}-${version.version}.vsix`;
  }
  return "latest.vsix";
}

function latestFileName(version) {
  const fromPath = basename(version.gcs?.latestObjectPath);
  if (fromPath) return fromPath;
  return "latest.vsix";
}

function withPublicDownloadUrls(version) {
  if (!version || typeof version !== "object") return version;
  const base = resolveDownloadBase();
  return {
    ...version,
    publicDownloadUrl: `${base}/${vsixFileName(version)}`,
    publicLatestDownloadUrl: `${base}/${latestFileName(version)}`,
  };
}

module.exports = {
  withPublicDownloadUrls,
};
