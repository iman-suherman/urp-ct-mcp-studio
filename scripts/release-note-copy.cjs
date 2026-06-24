/**
 * Turn git commit subjects into user-facing release note bullets.
 */

const NOISE_PATTERNS = [
  /^Bump package version to/i,
  /^Bump version to/i,
  /^Bump to \d+\.\d+\.\d+/i,
  /^Sync package-lock\.json/i,
  /^Merge branch/i,
  /^Merge pull request/i,
  /^Release v/i,
  /^chore\(release\)/i,
];

const REWRITE_RULES = [
  [/^Add sandbox mode/i, "Sandbox mode blocks connections containing \"prod\" or \"qantas\" by default"],
  [
    /^Add sandbox mode and two-step connection/i,
    "Two-step connection wizard: enter project identity before credentials",
  ],
  [
    /^Use Node GCS SDK for extension uploads/i,
    "Reliable extension publishing without gcloud Python dependency",
  ],
  [/^Add self-hosted update service/i, "Automatic update checks via the CT MCP registry"],
  [/^Add MCP Navigator panel/i, "MCP Navigator: browse Commerce MCP tools by category"],
  [/^Add semantic Navigator search/i, "Semantic search in MCP Navigator"],
  [/^Add Commerce MCP agent playbook/i, "Agent playbook for Commerce MCP chat context"],
  [/^Add project MCP init helper/i, "Init Project MCP writes .env.mcp and .cursor/mcp.json into the workspace"],
  [/^Add connection diagnostics panel/i, "Connection diagnostics panel in the Connections tab"],
  [/^Add GCS publish workflow/i, "Self-hosted VSIX distribution with registry API and website"],
  [/^Fix MCP connect timeout/i, "Faster first connect by bundling Commerce MCP with the extension"],
  [/^Fix VSIX packaging/i, "Correct VSIX packaging and extension branding"],
  [/^Auto-correction for swapped commercetools/i, "Auto-correct swapped Auth and API URLs on save"],
];

function isNoiseCommit(subject) {
  const text = String(subject || "").trim();
  if (!text) return true;
  return NOISE_PATTERNS.some((pattern) => pattern.test(text));
}

function stripConventionalPrefix(subject) {
  const text = String(subject || "").trim();
  const match = text.match(/^(\w+)(?:\([^)]+\))?!?:\s*(.+)$/);
  return match ? match[2].trim() : text;
}

function toUserFacingNote(subject) {
  const stripped = stripConventionalPrefix(subject);
  for (const [pattern, replacement] of REWRITE_RULES) {
    if (pattern.test(stripped)) return replacement;
  }

  let note = stripped
    .replace(/^Add /i, "")
    .replace(/^Fix /i, "")
    .replace(/^Update /i, "")
    .replace(/^Improve /i, "")
    .replace(/^Harden /i, "")
    .replace(/\.$/, "");

  if (/^Fix /i.test(stripped)) {
    return `Fixed ${note.charAt(0).toLowerCase()}${note.slice(1)}`;
  }
  if (/^Add /i.test(stripped)) {
    return note.charAt(0).toUpperCase() + note.slice(1);
  }

  return stripped.endsWith(".") ? stripped.slice(0, -1) : stripped;
}

function categorizeUserNote(note, originalSubject) {
  const subject = String(originalSubject || "");
  const breaking = /!:|BREAKING CHANGE/i.test(subject);
  if (breaking) return "breaking";

  const conventional = subject.match(/^(\w+)(?:\([^)]+\))?!?:\s/);
  if (conventional) {
    switch (conventional[1].toLowerCase()) {
      case "feat":
        return "introduced";
      case "fix":
        return "fixed";
      case "remove":
      case "removed":
        return "removed";
      case "perf":
      case "refactor":
        return "changed";
      default:
        break;
    }
  }

  if (/^Fix /i.test(subject)) return "fixed";
  if (/^Add /i.test(subject)) return "introduced";
  if (/^Remove /i.test(subject)) return "removed";
  return "changed";
}

function uniqueItems(items) {
  return [...new Set(items.filter(Boolean))];
}

function buildSummary(displayName, version, releaseNotes) {
  const highlights = [
    ...(releaseNotes.introduced ?? []).slice(0, 2),
    ...(releaseNotes.fixed ?? []).slice(0, 1),
    ...(releaseNotes.changed ?? []).slice(0, 1),
  ].filter(Boolean);

  if (highlights.length === 0) {
    const total = Object.values(releaseNotes).reduce(
      (count, items) => count + (Array.isArray(items) ? items.length : 0),
      0
    );
    if (total === 0) return `${displayName} ${version} maintenance release.`;
    return `${displayName} ${version} with ${total} improvement${total === 1 ? "" : "s"}.`;
  }

  const lead = highlights.slice(0, 2).join("; ");
  return `${displayName} ${version}: ${lead}.`;
}

module.exports = {
  NOISE_PATTERNS,
  isNoiseCommit,
  stripConventionalPrefix,
  toUserFacingNote,
  categorizeUserNote,
  uniqueItems,
  buildSummary,
};
