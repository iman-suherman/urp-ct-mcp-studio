const { withPublicDownloadUrls } = require("./download-urls");

function resolveWebsiteBase() {
  return (
    process.env.WEBSITE_BASE_URL?.trim() || "https://ct-mcp.suherman.net"
  ).replace(/\/$/, "");
}

function formatReleaseDate(publishedAt) {
  if (!publishedAt) return null;
  let date;
  if (typeof publishedAt === "string") {
    date = new Date(publishedAt);
  } else {
    const seconds = publishedAt._seconds ?? publishedAt.seconds;
    if (!seconds) return null;
    date = new Date(seconds * 1000);
  }
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function flattenReleaseNotes(notes) {
  if (!notes || typeof notes !== "object") return [];
  return [
    ...(notes.breaking ?? []).map((item) => `Breaking: ${item}`),
    ...(notes.introduced ?? []).map((item) => item),
    ...(notes.changed ?? []).map((item) => item),
    ...(notes.updated ?? []).map((item) => item),
    ...(notes.fixed ?? []).map((item) => item),
    ...(notes.removed ?? []).map((item) => item),
  ];
}

function formatLatestRelease(version, options = {}) {
  const websiteBase = options.websiteBase || resolveWebsiteBase();
  const enriched = withPublicDownloadUrls(version);
  const releaseDate = formatReleaseDate(enriched.publishedAt);
  const releaseNotesUrl = `${websiteBase}/versions?version=${encodeURIComponent(enriched.version)}`;

  return {
    pluginId: enriched.pluginId,
    version: enriched.version,
    name: enriched.displayName || "Commerce MCP Studio",
    releaseDate,
    downloadUrl: enriched.publicDownloadUrl,
    releaseNotesUrl,
    mandatory: enriched.mandatory === true,
    channel: enriched.channel || "stable",
    summary: enriched.summary || null,
    releaseNotes: flattenReleaseNotes(enriched.releaseNotes),
    releaseNotesMarkdown: enriched.releaseNotesMarkdown || null,
    releaseNotesStructured: enriched.releaseNotes || null,
    highlights: Array.isArray(enriched.highlights) ? enriched.highlights : [],
    sizeBytes: enriched.sizeBytes ?? null,
    publishedAt: enriched.publishedAt ?? null,
  };
}

module.exports = {
  formatLatestRelease,
  flattenReleaseNotes,
  formatReleaseDate,
  resolveWebsiteBase,
};
