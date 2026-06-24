/**
 * Build structured release notes from git history since the previous semver tag.
 * Curated notes in releases/notes/{version}.json override auto-generation.
 */
const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const { assertSemver, parseSemver } = require("./semver.cjs");
const { readReleaseNotes } = require("./read-release-notes.cjs");
const {
  isNoiseCommit,
  toUserFacingNote,
  categorizeUserNote,
  uniqueItems,
  buildSummary,
} = require("./release-note-copy.cjs");

const root = path.join(__dirname, "..");
const shell = process.platform === "win32";

function runGit(args) {
  const r = spawnSync("git", args, {
    cwd: root,
    encoding: "utf8",
    shell,
  });
  if (r.status !== 0) return "";
  return (r.stdout || "").trim();
}

function getPreviousTag(currentVersion) {
  const output = runGit(["tag", "--list", "v*", "--sort=-v:refname"]);
  const tags = output.split("\n").map((tag) => tag.trim()).filter(Boolean);
  for (const tag of tags) {
    const tagVersion = tag.replace(/^v/, "");
    if (tagVersion !== currentVersion) return tag;
  }
  return null;
}

function findBumpCommitForVersion(version) {
  const patterns = [
    `Bump package version to ${version}`,
    `Bump version to ${version}`,
    `bump to ${version}`,
    `bump version to ${version}`,
  ];
  for (const pattern of patterns) {
    const hash = runGit(["log", "-1", "--format=%H", "--grep", pattern, "-i"]);
    if (hash) return hash;
  }
  return null;
}

function resolvePreviousVersion(currentVersion) {
  const parsed = parseSemver(currentVersion);
  if (!parsed || parsed.patch === 0) return null;
  return `${parsed.major}.${parsed.minor}.${parsed.patch - 1}`;
}

function resolveSinceCommitForVersion(version, explicitSinceCommit) {
  if (explicitSinceCommit) return explicitSinceCommit;
  const previousVersion = resolvePreviousVersion(version);
  if (previousVersion) {
    const bumpCommit = findBumpCommitForVersion(previousVersion);
    if (bumpCommit) return bumpCommit;
  }
  return null;
}

function getCommitRange(previousTag, sinceCommit) {
  if (sinceCommit) return `${sinceCommit}..HEAD`;
  if (previousTag) return `${previousTag}..HEAD`;
  const firstCommit = runGit(["rev-list", "--max-parents=0", "HEAD"]);
  return firstCommit ? `${firstCommit}..HEAD` : "HEAD";
}

function getCommits(range) {
  const output = runGit(["log", range, "--pretty=format:%H|%s|%an"]);
  if (!output) return [];
  return output.split("\n").filter(Boolean).map((line) => {
    const [hash, subject, author] = line.split("|");
    return { hash, subject: subject || "", author: author || "" };
  });
}

function categorizeCommit(subject) {
  const text = subject.trim();
  const breaking = /!:|BREAKING CHANGE/i.test(text);
  const conventional = text.match(/^(\w+)(?:\([^)]+\))?!?:\s*(.+)$/);

  if (!conventional) {
    return { category: "changed", summary: text, breaking: false };
  }

  const type = conventional[1].toLowerCase();
  const summary = conventional[2].trim();
  const isBreaking = breaking || text.includes("!");

  if (isBreaking) {
    return { category: "breaking", summary, breaking: true };
  }

  switch (type) {
    case "feat":
      return { category: "introduced", summary, breaking: false };
    case "fix":
      return { category: "fixed", summary, breaking: false };
    case "perf":
    case "refactor":
      return { category: "changed", summary, breaking: false };
    case "docs":
    case "chore":
    case "build":
    case "ci":
    case "style":
    case "test":
      return { category: "updated", summary, breaking: false };
    case "remove":
    case "removed":
      return { category: "removed", summary, breaking: false };
    default:
      return { category: "changed", summary: text, breaking: false };
  }
}

function suggestBumpLevel(commits) {
  let bump = "patch";
  for (const commit of commits) {
    const { category, breaking } = categorizeCommit(commit.subject);
    if (breaking || category === "breaking") return "major";
    if (category === "introduced" && bump !== "major") bump = "minor";
  }
  return bump;
}

function buildReleaseNotesFromCommits(commits) {
  const releaseNotes = {
    introduced: [],
    changed: [],
    updated: [],
    fixed: [],
    removed: [],
    breaking: [],
  };

  for (const commit of commits) {
    if (isNoiseCommit(commit.subject)) continue;
    const note = toUserFacingNote(commit.subject);
    const category = categorizeUserNote(note, commit.subject);
    releaseNotes[category].push(note);
  }

  for (const key of Object.keys(releaseNotes)) {
    releaseNotes[key] = uniqueItems(releaseNotes[key]);
  }

  return releaseNotes;
}

function buildMarkdown(version, releaseNotes, previousLabel, summary) {
  const lines = [`# Commerce MCP Studio ${version}`, ""];
  if (summary) {
    lines.push(summary, "");
  }
  if (previousLabel) {
    lines.push(`Changes since \`${previousLabel}\`.`, "");
  }

  const sections = [
    ["What's new", releaseNotes.introduced],
    ["Improvements", releaseNotes.changed],
    ["Fixes", releaseNotes.fixed],
    ["Updates", releaseNotes.updated],
    ["Removed", releaseNotes.removed],
    ["Breaking changes", releaseNotes.breaking],
  ];

  let hasSection = false;
  for (const [title, items] of sections) {
    if (!items.length) continue;
    hasSection = true;
    lines.push(`## ${title}`, "");
    for (const item of items) {
      lines.push(`- ${item}`);
    }
    lines.push("");
  }

  if (!hasSection) {
    lines.push("Maintenance and stability improvements.", "");
  }

  return lines.join("\n").trim() + "\n";
}

function generateReleaseNotes(options = {}) {
  const packageJson = require(path.join(root, "package.json"));
  const version = options.version || packageJson.version;
  const pluginId = options.pluginId || packageJson.name;
  const displayName = options.displayName || packageJson.displayName || pluginId;

  const parsed = assertSemver(version, "package.json version");
  const curated = readReleaseNotes(root, version);

  const sinceCommit =
    options.sinceCommit ??
    resolveSinceCommitForVersion(parsed.version, options.sinceCommit);
  const previousTag = sinceCommit ? null : options.previousTag ?? getPreviousTag(version);
  const previousVersion = resolvePreviousVersion(parsed.version);
  const previousLabel =
    options.previousLabel ||
    (previousVersion ? `v${previousVersion}` : sinceCommit ? sinceCommit.slice(0, 7) : previousTag);

  const range = getCommitRange(previousTag, sinceCommit);
  const commits = getCommits(range);
  const autoNotes = buildReleaseNotesFromCommits(commits);

  const releaseNotes = curated?.releaseNotes ?? autoNotes;
  const summary =
    curated?.summary ?? buildSummary(displayName, parsed.version, releaseNotes);
  const gitCommit = runGit(["rev-parse", "HEAD"]);

  const payload = {
    pluginId,
    displayName,
    publisher: packageJson.publisher || "",
    version: parsed.version,
    semver: {
      major: parsed.major,
      minor: parsed.minor,
      patch: parsed.patch,
      prerelease: parsed.prerelease,
      build: parsed.build,
    },
    previousTag,
    sinceCommit,
    previousLabel,
    gitCommit,
    gitTag: `v${parsed.version}`,
    commitCount: commits.length,
    releaseNotes,
    summary,
    highlights: curated?.highlights ?? [],
    mandatory: curated?.mandatory === true,
    curated: Boolean(curated),
    releaseNotesMarkdown:
      curated?.releaseNotesMarkdown ??
      buildMarkdown(parsed.version, releaseNotes, previousLabel, summary),
    generatedAt: new Date().toISOString(),
  };

  return payload;
}

function writeReleaseArtifacts(release, outputDir = path.join(root, "releases")) {
  fs.mkdirSync(outputDir, { recursive: true });
  const jsonPath = path.join(outputDir, `release-${release.version}.json`);
  const mdPath = path.join(outputDir, `release-${release.version}.md`);
  fs.writeFileSync(jsonPath, `${JSON.stringify(release, null, 2)}\n`, "utf8");
  fs.writeFileSync(mdPath, release.releaseNotesMarkdown, "utf8");
  return { jsonPath, mdPath };
}

if (require.main === module) {
  const versionArg = process.argv.find((arg) => /^\d+\.\d+\.\d+$/.test(arg));
  const release = generateReleaseNotes(versionArg ? { version: versionArg } : {});
  const paths = writeReleaseArtifacts(release);
  console.log("release-notes:", paths.jsonPath);
  console.log("release-notes:", paths.mdPath);
  console.log(release.summary);
}

module.exports = {
  generateReleaseNotes,
  writeReleaseArtifacts,
  categorizeCommit,
  suggestBumpLevel,
  getCommits,
  resolveSinceCommitForVersion,
  buildReleaseNotesFromCommits,
};
