/**
 * Build public VSIX download URLs via the Cloudflare GCS proxy (private bucket).
 */
const path = require("path");

const DEFAULT_DOWNLOAD_BASE = "https://ct-mcp-download.suherman.net/downloads";

function resolveDownloadBase(env = process.env) {
  return (
    env.PUBLIC_DOWNLOAD_BASE_URL?.trim() ||
    env.NEXT_PUBLIC_DOWNLOAD_BASE_URL?.trim() ||
    DEFAULT_DOWNLOAD_BASE
  ).replace(/\/$/, "");
}

function vsixFileName(objectPath, version, pluginId) {
  if (objectPath) return path.basename(objectPath);
  if (version && pluginId) return `${pluginId}-${version}.vsix`;
  return "latest.vsix";
}

function publicDownloadUrl({ base, objectPath, version, pluginId }) {
  const root = (base || resolveDownloadBase()).replace(/\/$/, "");
  return `${root}/${vsixFileName(objectPath, version, pluginId)}`;
}

function publicLatestDownloadUrl({ base, latestObjectPath }) {
  const root = (base || resolveDownloadBase()).replace(/\/$/, "");
  const fileName = latestObjectPath ? path.basename(latestObjectPath) : "latest.vsix";
  return `${root}/${fileName}`;
}

module.exports = {
  DEFAULT_DOWNLOAD_BASE,
  resolveDownloadBase,
  vsixFileName,
  publicDownloadUrl,
  publicLatestDownloadUrl,
};
