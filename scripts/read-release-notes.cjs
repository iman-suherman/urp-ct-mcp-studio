/**
 * Read curated release notes (Sparkle-style structured notes for VS Code extension).
 * Curated files live in releases/notes/{version}.json and override auto-generation.
 */
const fs = require("fs");
const path = require("path");

const NOTES_DIR = "notes";

function notesDir(root) {
  return path.join(root, "releases", NOTES_DIR);
}

function notesPath(root, version) {
  return path.join(notesDir(root), `${version}.json`);
}

function hasCuratedNotes(root, version) {
  return fs.existsSync(notesPath(root, version));
}

function listCuratedVersions(root) {
  const dir = notesDir(root);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((name) => name.endsWith(".json"))
    .map((name) => name.replace(/\.json$/, ""))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

function emptyReleaseNotes() {
  return {
    introduced: [],
    changed: [],
    updated: [],
    fixed: [],
    removed: [],
    breaking: [],
  };
}

function normalizeReleaseNotes(input) {
  const base = emptyReleaseNotes();
  if (!input || typeof input !== "object") return base;

  if (input.releaseNotes && typeof input.releaseNotes === "object") {
    for (const key of Object.keys(base)) {
      base[key] = toLines(input.releaseNotes[key]);
    }
    return base;
  }

  for (const key of Object.keys(base)) {
    base[key] = toLines(input[key]);
  }
  return base;
}

function toLines(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(String).map((line) => line.trim()).filter(Boolean);
  return String(value)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function readReleaseNotes(root, version) {
  const file = notesPath(root, version);
  if (!fs.existsSync(file)) return null;

  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  if (data.version && data.version !== version) {
    throw new Error(`Curated notes version mismatch: expected ${version}, got ${data.version}`);
  }

  const releaseNotes = normalizeReleaseNotes(data);
  const highlights = toLines(data.highlights);

  return {
    version,
    summary: data.summary || null,
    releaseNotes,
    highlights,
    mandatory: data.mandatory === true,
    releaseNotesMarkdown: data.releaseNotesMarkdown || null,
  };
}

module.exports = {
  notesDir,
  notesPath,
  hasCuratedNotes,
  listCuratedVersions,
  readReleaseNotes,
  normalizeReleaseNotes,
  emptyReleaseNotes,
  toLines,
};
