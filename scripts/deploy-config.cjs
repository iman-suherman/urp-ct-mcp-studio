/**
 * Local auto-deploy targets for ct-mcp.suherman.net.
 */
const path = require("node:path");

const REPO_ROOT = path.resolve(__dirname, "..");
const DEFAULT_BRANCH = process.env.CT_MCP_DEPLOY_BRANCH || "main";

/** @type {Array<{ repo: string; label: string; branch?: string; npmScript?: string; note?: string; details?: string[] }>} */
const DEPLOY_TARGETS = [
  {
    repo: "ct-mcp-website",
    label: "ct-mcp.suherman.net",
    branch: DEFAULT_BRANCH,
    npmScript: "deploy:website",
  },
  {
    repo: "ct-mcp-registry",
    label: "ct-mcp-registry.suherman.net",
    note: "manual",
    details: ["Deploy manually with npm run deploy:registry"],
  },
  {
    repo: "ct-mcp-download",
    label: "ct-mcp-download.suherman.net",
    note: "manual",
    details: ["Deploy from suherman-net-infra: npm run cloudflare:ct-mcp -- --skip-website --skip-registry"],
  },
  {
    repo: "ct-mcp-extension",
    label: "Commerce MCP Studio VSIX",
    note: "manual",
    details: [
      "Updated the extension to use media/ct-mcp-vscode-extension-icon.svg:",
      "  Activity bar → ct-mcp-vscode-extension-icon.svg",
      "  Sidebar view → ct-mcp-vscode-extension-icon.svg",
      "  Webview panel hero → ct-mcp-vscode-extension-icon.svg",
      "  Extensions listing → ct-mcp-vscode-extension-icon.png (256×256, generated from the SVG)",
      "vsce requires a PNG for the marketplace icon field — PNG generated from SVG for that spot only",
      "Everything else uses the SVG directly (scales cleanly in the activity bar)",
      "New files: media/ct-mcp-vscode-extension-icon.svg and media/ct-mcp-vscode-extension-icon.png",
      "Reload the extension (or reinstall the VSIX) to see the new icon",
      "Release: npm run release",
    ],
  },
];

function getDeployTarget(repo) {
  return DEPLOY_TARGETS.find((t) => t.repo === repo) || null;
}

function deployableTargets() {
  return DEPLOY_TARGETS.filter((t) => t.npmScript);
}

module.exports = {
  REPO_ROOT,
  DEFAULT_BRANCH,
  DEPLOY_TARGETS,
  getDeployTarget,
  deployableTargets,
};
