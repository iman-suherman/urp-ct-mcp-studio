/**
 * Persistent local deployment state (logs/ — gitignored except .gitkeep).
 */
const fs = require("node:fs");
const path = require("node:path");

const { REPO_ROOT } = require("./deploy-config.cjs");

const LOGS_ROOT = path.join(REPO_ROOT, "logs");
const STATE_FILE = path.join(LOGS_ROOT, "deployments.json");

function ensureLogsRoot() {
  fs.mkdirSync(LOGS_ROOT, { recursive: true });
  const gitkeep = path.join(LOGS_ROOT, ".gitkeep");
  if (!fs.existsSync(gitkeep)) {
    fs.writeFileSync(gitkeep, "", "utf8");
  }
}

function defaultState() {
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    repos: {},
    deployments: [],
  };
}

const TERMINAL_REPO_STATUSES = new Set(["success", "failure", "cancelled"]);

function normalizeRepoStatus(rs) {
  if (rs && TERMINAL_REPO_STATUSES.has(rs.status)) {
    rs.status = "idle";
  }
}

function readState() {
  ensureLogsRoot();
  if (!fs.existsSync(STATE_FILE)) {
    return defaultState();
  }
  try {
    const data = JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
    for (const rs of Object.values(data.repos || {})) {
      normalizeRepoStatus(rs);
    }
    return {
      ...defaultState(),
      ...data,
      repos: data.repos || {},
      deployments: data.deployments || [],
    };
  } catch {
    return defaultState();
  }
}

function writeState(state) {
  ensureLogsRoot();
  const next = { ...state, updatedAt: new Date().toISOString() };
  const tmp = `${STATE_FILE}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  fs.renameSync(tmp, STATE_FILE);
  return next;
}

function updateState(mutator) {
  const state = readState();
  const next = mutator(state) || state;
  return writeState(next);
}

function repoLogDir(repo) {
  const dir = path.join(LOGS_ROOT, repo);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function makeDeploymentId(repo, sha) {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const short = (sha || "unknown").slice(0, 7);
  return `${repo}-${stamp}-${short}`;
}

function logFileForDeployment(repo, deploymentId) {
  return path.join(repoLogDir(repo), `${deploymentId}.log`);
}

function relativeLogPath(absolutePath) {
  return path.relative(REPO_ROOT, absolutePath);
}

function absoluteLogPath(relativeOrAbsolute) {
  if (path.isAbsolute(relativeOrAbsolute)) {
    return relativeOrAbsolute;
  }
  return path.join(REPO_ROOT, relativeOrAbsolute);
}

function getRepoState(state, repo) {
  if (!state.repos[repo]) {
    state.repos[repo] = {
      branch: "main",
      headSha: null,
      lastDeployedSha: null,
      status: "idle",
      currentDeploymentId: null,
      lastDeploymentId: null,
      lastError: null,
      pid: null,
    };
  }
  return state.repos[repo];
}

function findDeployment(state, id) {
  return state.deployments.find((d) => d.id === id) || null;
}

function upsertDeployment(state, deployment) {
  const idx = state.deployments.findIndex((d) => d.id === deployment.id);
  if (idx === -1) {
    state.deployments.unshift(deployment);
  } else {
    state.deployments[idx] = { ...state.deployments[idx], ...deployment };
  }
  const max = Number.parseInt(process.env.CT_MCP_DEPLOY_HISTORY_MAX || "100", 10);
  if (state.deployments.length > max) {
    state.deployments = state.deployments.slice(0, max);
  }
}

module.exports = {
  REPO_ROOT,
  LOGS_ROOT,
  STATE_FILE,
  ensureLogsRoot,
  readState,
  writeState,
  updateState,
  repoLogDir,
  makeDeploymentId,
  logFileForDeployment,
  relativeLogPath,
  absoluteLogPath,
  getRepoState,
  findDeployment,
  upsertDeployment,
};
