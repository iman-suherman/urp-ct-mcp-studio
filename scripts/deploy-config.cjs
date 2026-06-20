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
    infraDeploy: true,
    note: "manual",
    details: ["Deploy from suherman-net-infra: npm run cloudflare:ct-mcp -- --skip-website --skip-registry"],
  },
  {
    repo: "ct-mcp-extension",
    label: "Commerce MCP Studio VSIX",
    branch: DEFAULT_BRANCH,
    npmScript: "deploy:extension",
    details: [
      "Auto on commit when plugin paths change (plugins.manifest.json)",
      "Manual: npm run deploy:retry -- --repo ct-mcp-extension",
      "Track: npm run ci (from urp-ct-mcp-studio or suherman-net-infra)",
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
