/**
 * Paths that belong to ct-mcp VS Code plugins (not website, registry API, etc.).
 * Extend plugins.manifest.json when adding new plugins.
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const manifestPath = path.join(root, "plugins.manifest.json");

const DEFAULT_MANIFEST = {
  plugins: [
    {
      pluginId: "ct-mcp-studio",
      watchPaths: [
        "src/",
        "media/",
        "package.json",
        "package-lock.json",
        "tsconfig.json",
        "ct-mcp-studio.json",
        ".vscodeignore",
      ],
    },
  ],
};

function loadPluginManifest() {
  if (!fs.existsSync(manifestPath)) return DEFAULT_MANIFEST;
  return JSON.parse(fs.readFileSync(manifestPath, "utf8"));
}

function normalizePath(file) {
  return file.replace(/\\/g, "/");
}

function matchesWatchPath(file, watchPath) {
  if (watchPath.endsWith("/")) {
    return file.startsWith(watchPath) || file === watchPath.slice(0, -1);
  }
  return file === watchPath;
}

function isPluginPath(file, manifest = loadPluginManifest()) {
  const normalized = normalizePath(file);
  for (const plugin of manifest.plugins) {
    for (const watchPath of plugin.watchPaths) {
      if (matchesWatchPath(normalized, watchPath)) {
        return plugin.pluginId;
      }
    }
  }
  return null;
}

function getPluginsTouchedByFiles(files, manifest = loadPluginManifest()) {
  const touched = new Set();
  for (const file of files) {
    const pluginId = isPluginPath(file, manifest);
    if (pluginId) touched.add(pluginId);
  }
  return [...touched];
}

module.exports = {
  loadPluginManifest,
  isPluginPath,
  getPluginsTouchedByFiles,
};
