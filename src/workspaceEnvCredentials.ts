import * as fs from "fs";
import * as path from "path";

export const DEFAULT_AUTH_URL =
  "https://auth.australia-southeast1.gcp.commercetools.com";
export const DEFAULT_API_URL =
  "https://api.australia-southeast1.gcp.commercetools.com";

export const DEFAULT_AUSTRALIA_AUTH_URL = DEFAULT_AUTH_URL;
export const DEFAULT_AUSTRALIA_API_URL = DEFAULT_API_URL;

const ENV_SUFFIX_KEY_PATTERN =
  /^(?:CT_MCP|COMMERCETOOLS|CTP|CTOOLS|COMM_TOOLS)_(?:ADMIN_)?(?:CLIENT_ID|CLIENT_SECRET|PROJECT_KEY|AUTH_URL|API_URL)_([A-Z][A-Z0-9]*)$/;

const AUTH_URL_KEYS = [
  "CT_MCP_AUTH_URL",
  "COMMERCETOOLS_AUTH_URL",
  "CTP_AUTH_URL",
  "CTOOLS_AUTH_HOST",
  "AUTH_URL",
] as const;

const API_URL_KEYS = [
  "CT_MCP_API_URL",
  "COMMERCETOOLS_API_URL",
  "CTP_API_URL",
  "CTOOLS_API_HOST",
  "API_URL",
] as const;

const PROJECT_KEY_KEYS = [
  "CT_MCP_PROJECT_KEY",
  "COMMERCETOOLS_PROJECT_KEY",
  "CTP_PROJECT_KEY",
  "CTOOLS_PROJECT_KEY",
  "COMM_TOOLS_PROJECT_KEY",
  "PROJECT_KEY",
] as const;

function normalizeCommercetoolsUrls(
  authUrl: string,
  apiUrl: string
): { authUrl: string; apiUrl: string } {
  const trimmedAuth = authUrl.trim();
  const trimmedApi = apiUrl.trim();
  const authLooksLikeApi = /^https:\/\/api\./i.test(trimmedAuth);
  const apiLooksLikeAuth = /^https:\/\/auth\./i.test(trimmedApi);

  if (authLooksLikeApi && apiLooksLikeAuth) {
    return { authUrl: trimmedApi, apiUrl: trimmedAuth };
  }

  return { authUrl: trimmedAuth, apiUrl: trimmedApi };
}

export const WORKSPACE_ENV_SELECTED_KEY = "ctMcp.selectedWorkspaceEnvFile";
export const WORKSPACE_ENV_SUFFIX_KEY = "ctMcp.selectedWorkspaceEnvSuffix";
export const WORKSPACE_MANUAL_PROJECT_KEYS = "ctMcp.manualProjectKeysBySuffix";

export interface CommercetoolsHostingRegion {
  id: string;
  cloud: "gcp" | "aws";
  region: string;
  label: string;
  authUrl: string;
  apiUrl: string;
}

export const COMMERCETOOLS_HOSTING_REGIONS: CommercetoolsHostingRegion[] = [
  {
    id: "gcp.australia-southeast1",
    cloud: "gcp",
    region: "australia-southeast1",
    label: "Australia (GCP, Sydney)",
    authUrl: DEFAULT_AUSTRALIA_AUTH_URL,
    apiUrl: DEFAULT_AUSTRALIA_API_URL,
  },
  {
    id: "gcp.europe-west1",
    cloud: "gcp",
    region: "europe-west1",
    label: "Europe (GCP, Belgium)",
    authUrl: "https://auth.europe-west1.gcp.commercetools.com",
    apiUrl: "https://api.europe-west1.gcp.commercetools.com",
  },
  {
    id: "gcp.us-central1",
    cloud: "gcp",
    region: "us-central1",
    label: "North America (GCP, Iowa)",
    authUrl: "https://auth.us-central1.gcp.commercetools.com",
    apiUrl: "https://api.us-central1.gcp.commercetools.com",
  },
  {
    id: "aws.eu-central-1",
    cloud: "aws",
    region: "eu-central-1",
    label: "Europe (AWS, Frankfurt)",
    authUrl: "https://auth.eu-central-1.aws.commercetools.com",
    apiUrl: "https://api.eu-central-1.aws.commercetools.com",
  },
  {
    id: "aws.us-east-2",
    cloud: "aws",
    region: "us-east-2",
    label: "North America (AWS, Ohio)",
    authUrl: "https://auth.us-east-2.aws.commercetools.com",
    apiUrl: "https://api.us-east-2.aws.commercetools.com",
  },
];

export const ENV_MCP_FILE = ".env.mcp";

export const DEFAULT_HOSTING_REGION = COMMERCETOOLS_HOSTING_REGIONS[0];

export interface WorkspaceCredentials {
  workspaceFolder: string;
  source: string;
  name: string;
  projectKey: string;
  clientId: string;
  clientSecret: string;
  authUrl: string;
  apiUrl: string;
  isAdmin: boolean;
  envSuffix?: string;
  hasExplicitAuthUrl: boolean;
  hasExplicitApiUrl: boolean;
}

export interface WorkspaceEnvProbe {
  envFileName: string;
  detectedEnvSuffixes: string[];
  selectedEnvSuffix?: string;
  hasExplicitAuthUrl: boolean;
  hasExplicitApiUrl: boolean;
  missingAuthApiUrls: boolean;
  hasEnvMcpFile: boolean;
  selectedHostingRegionId: string;
  selectedHostingCloud: CommercetoolsHostingRegion["cloud"];
  hasClientCredentials: boolean;
  hasProjectKeyInEnv: boolean;
  missingProjectKey: boolean;
  manualProjectKey?: string;
  clientId?: string;
  isAdminClient?: boolean;
  credentials?: WorkspaceCredentials;
}

const TEMPLATE_ENV_FILES = new Set([
  ".env.example",
  ".env.example.local",
  ".env-sample",
  ".env.sample",
]);

const ENV_FILE_PRIORITY = [
  ".env.mcp",
  ".env.local",
  ".env",
  ".env.dev",
  ".env.sit",
  ".env.stg",
  ".env.prd",
  ".env.test",
];

function stripQuotes(value: string): string {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

export function parseEnvFile(filePath: string): Record<string, string> {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  const out: Record<string, string> = {};
  for (const line of fs.readFileSync(filePath, "utf-8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const eq = trimmed.indexOf("=");
    if (eq === -1) {
      continue;
    }
    const key = trimmed.slice(0, eq).trim();
    if (!key) {
      continue;
    }
    const value = stripQuotes(trimmed.slice(eq + 1));
    if (value) {
      out[key] = value;
    }
  }
  return out;
}

function isPlaceholder(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return true;
  }
  if (/^x+$/i.test(normalized) && normalized.length >= 4) {
    return true;
  }
  return (
    normalized.includes("your-") ||
    normalized.includes("placeholder") ||
    normalized === "changeme" ||
    normalized === "my-secret-value" ||
    normalized.startsWith("your-client-")
  );
}

function withEnvSuffix(key: string, envSuffix?: string): string {
  return envSuffix ? `${key}_${envSuffix}` : key;
}

function firstDefined(env: Record<string, string>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = env[key]?.trim();
    if (value && !isPlaceholder(value)) {
      return value;
    }
  }
  return undefined;
}

function firstDefinedWithSuffix(
  env: Record<string, string>,
  keys: string[],
  envSuffix?: string
): string | undefined {
  if (envSuffix) {
    const suffixed = keys.map((key) => withEnvSuffix(key, envSuffix));
    const fromSuffix = firstDefined(env, suffixed);
    if (fromSuffix) {
      return fromSuffix;
    }
  }
  return firstDefined(env, keys);
}

export function envSuffixFromSource(source: string): string | undefined {
  const base = path.basename(source);
  if (base === ".env" || base === ".env.local" || base === ".env.mcp") {
    return undefined;
  }
  const part = base.replace(/^\.env\.?/, "");
  return part ? part.toUpperCase() : undefined;
}

export function detectEnvSuffixesFromKeys(env: Record<string, string>): string[] {
  const counts = new Map<string, number>();
  for (const key of Object.keys(env)) {
    const match = key.match(ENV_SUFFIX_KEY_PATTERN);
    if (match) {
      const suffix = match[1];
      counts.set(suffix, (counts.get(suffix) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .map(([suffix]) => suffix);
}

export function detectEnvSuffixesInWorkspace(workspaceRoot: string, envFileName = ".env"): string[] {
  const env = loadEnvForSource(workspaceRoot, envFileName);
  const fromFile = envSuffixFromSource(envFileName);
  const detected = detectEnvSuffixesFromKeys(env);
  if (fromFile && !detected.includes(fromFile)) {
    return [fromFile, ...detected];
  }
  return detected;
}

export function getSelectedWorkspaceEnvSuffix(
  context: import("vscode").ExtensionContext,
  workspaceRoot: string,
  envFileName: string
): string | undefined {
  const fromFile = envSuffixFromSource(envFileName);
  if (fromFile) {
    return fromFile;
  }

  const detected = detectEnvSuffixesInWorkspace(workspaceRoot, envFileName);
  if (!detected.length) {
    return undefined;
  }

  const saved = context.workspaceState.get<string>(WORKSPACE_ENV_SUFFIX_KEY);
  if (saved && detected.includes(saved)) {
    return saved;
  }

  return detected[0];
}

export async function setSelectedWorkspaceEnvSuffix(
  context: import("vscode").ExtensionContext,
  envSuffix: string
): Promise<void> {
  await context.workspaceState.update(WORKSPACE_ENV_SUFFIX_KEY, envSuffix.toUpperCase());
}

function manualProjectKeyStorageKey(envSuffix?: string): string {
  return envSuffix?.trim().toUpperCase() || "__default__";
}

export function getManualProjectKey(
  context: import("vscode").ExtensionContext,
  envSuffix?: string
): string | undefined {
  const map = context.workspaceState.get<Record<string, string>>(WORKSPACE_MANUAL_PROJECT_KEYS) ?? {};
  const saved = map[manualProjectKeyStorageKey(envSuffix)]?.trim();
  return saved || undefined;
}

export async function setManualProjectKey(
  context: import("vscode").ExtensionContext,
  projectKey: string,
  envSuffix?: string
): Promise<void> {
  const map = {
    ...(context.workspaceState.get<Record<string, string>>(WORKSPACE_MANUAL_PROJECT_KEYS) ?? {}),
  };
  const normalized = projectKey.trim();
  const storageKey = manualProjectKeyStorageKey(envSuffix);
  if (normalized) {
    map[storageKey] = normalized;
  } else {
    delete map[storageKey];
  }
  await context.workspaceState.update(WORKSPACE_MANUAL_PROJECT_KEYS, map);
}

export function buildCommercetoolsRegionUrls(
  cloud: CommercetoolsHostingRegion["cloud"],
  region: string
): { authUrl: string; apiUrl: string } {
  const known = COMMERCETOOLS_HOSTING_REGIONS.find(
    (entry) => entry.cloud === cloud && entry.region === region
  );
  if (known) {
    return { authUrl: known.authUrl, apiUrl: known.apiUrl };
  }
  return {
    authUrl: `https://auth.${region}.${cloud}.commercetools.com`,
    apiUrl: `https://api.${region}.${cloud}.commercetools.com`,
  };
}

export function buildEnvMcpUrlUpdates(authUrl: string, apiUrl: string): Record<string, string> {
  const urls = normalizeCommercetoolsUrls(authUrl, apiUrl);
  return {
    CT_MCP_AUTH_URL: urls.authUrl,
    CT_MCP_API_URL: urls.apiUrl,
    CTP_AUTH_URL: urls.authUrl,
    CTP_API_URL: urls.apiUrl,
    COMMERCETOOLS_AUTH_URL: urls.authUrl,
    COMMERCETOOLS_API_URL: urls.apiUrl,
  };
}

function upsertEnvFileKeys(filePath: string, updates: Record<string, string>): void {
  const lines: string[] = fs.existsSync(filePath)
    ? fs.readFileSync(filePath, "utf-8").split("\n")
    : [];
  const touched = new Set<string>();
  const nextLines = lines.map((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      return line;
    }
    const eq = trimmed.indexOf("=");
    if (eq === -1) {
      return line;
    }
    const key = trimmed.slice(0, eq).trim();
    if (!(key in updates)) {
      return line;
    }
    touched.add(key);
    return `${key}=${updates[key]}`;
  });

  for (const [key, value] of Object.entries(updates)) {
    if (!touched.has(key)) {
      if (nextLines.length > 0 && nextLines[nextLines.length - 1] !== "") {
        nextLines.push("");
      }
      nextLines.push(`${key}=${value}`);
    }
  }

  const body = nextLines.join("\n");
  fs.writeFileSync(filePath, body.endsWith("\n") ? body : `${body}\n`, "utf-8");
}

export function createOrUpdateEnvMcpUrls(
  workspaceRoot: string,
  hostingRegion: CommercetoolsHostingRegion
): { fileName: string; created: boolean; filePath: string } {
  const fileName = ENV_MCP_FILE;
  const filePath = path.join(workspaceRoot, fileName);
  const created = !fs.existsSync(filePath);
  if (created) {
    const header = [
      "# Commerce MCP environment — generated by Commerce MCP Studio",
      "# Auth/API URLs for commercetools HTTP API",
      `# Region: ${hostingRegion.label}`,
      "",
    ].join("\n");
    fs.writeFileSync(
      filePath,
      `${header}${Object.entries(buildEnvMcpUrlUpdates(hostingRegion.authUrl, hostingRegion.apiUrl))
        .map(([key, value]) => `${key}=${value}`)
        .join("\n")}\n`,
      "utf-8"
    );
    return { fileName, created: true, filePath };
  }

  upsertEnvFileKeys(filePath, buildEnvMcpUrlUpdates(hostingRegion.authUrl, hostingRegion.apiUrl));
  return { fileName, created: false, filePath };
}

export function probeWorkspaceEnv(
  workspaceRoot: string,
  envFileName: string,
  options: {
    workspaceFolder?: string;
    envSuffix?: string;
    manualProjectKey?: string;
  } = {}
): WorkspaceEnvProbe {
  const env = loadEnvForSource(workspaceRoot, envFileName);
  const detectedEnvSuffixes = detectEnvSuffixesInWorkspace(workspaceRoot, envFileName);
  const selectedEnvSuffix =
    options.envSuffix ??
    (envSuffixFromSource(envFileName) ?? detectedEnvSuffixes[0]);

  const explicitAuthUrl = firstDefinedWithSuffix(env, [...AUTH_URL_KEYS], selectedEnvSuffix);
  const explicitApiUrl = firstDefinedWithSuffix(env, [...API_URL_KEYS], selectedEnvSuffix);
  const hostingRegion = resolveHostingRegionFromWorkspace(workspaceRoot);
  const client = resolveClientCredentials(env, selectedEnvSuffix);
  const projectKeyFromEnv = firstDefinedWithSuffix(env, [...PROJECT_KEY_KEYS], selectedEnvSuffix);
  const manualProjectKey = options.manualProjectKey?.trim();
  const credentials = resolveCredentialsFromEnv(env, {
    workspaceFolder: options.workspaceFolder,
    source: envFileName,
    envSuffix: selectedEnvSuffix,
    manualProjectKey,
  });

  return {
    envFileName,
    detectedEnvSuffixes,
    selectedEnvSuffix,
    hasExplicitAuthUrl: Boolean(explicitAuthUrl),
    hasExplicitApiUrl: Boolean(explicitApiUrl),
    missingAuthApiUrls: !explicitAuthUrl || !explicitApiUrl,
    hasEnvMcpFile: hasEnvMcpFile(workspaceRoot),
    selectedHostingRegionId: hostingRegion.id,
    selectedHostingCloud: hostingRegion.cloud,
    hasClientCredentials: Boolean(client),
    hasProjectKeyInEnv: Boolean(projectKeyFromEnv),
    missingProjectKey: Boolean(client) && !projectKeyFromEnv && !manualProjectKey,
    manualProjectKey,
    clientId: client?.clientId,
    isAdminClient: client?.isAdmin,
    credentials,
  };
}

export function detectHostingRegionFromAuthUrl(
  authUrl: string | undefined
): CommercetoolsHostingRegion | undefined {
  if (!authUrl?.trim()) {
    return undefined;
  }
  const match = authUrl.trim().match(/^https:\/\/auth\.([^.]+)\.(gcp|aws)\.commercetools\.com/i);
  if (!match) {
    return undefined;
  }
  const region = match[1];
  const cloud = match[2].toLowerCase() as CommercetoolsHostingRegion["cloud"];
  return COMMERCETOOLS_HOSTING_REGIONS.find(
    (entry) => entry.region === region && entry.cloud === cloud
  );
}

export function hasEnvMcpFile(workspaceRoot: string): boolean {
  return fs.existsSync(path.join(workspaceRoot, ENV_MCP_FILE));
}

export function resolveHostingRegionFromWorkspace(
  workspaceRoot: string
): CommercetoolsHostingRegion {
  const mcpEnv = parseEnvFile(path.join(workspaceRoot, ENV_MCP_FILE));
  const authUrl = firstDefined(mcpEnv, [...AUTH_URL_KEYS]);
  return detectHostingRegionFromAuthUrl(authUrl) ?? DEFAULT_HOSTING_REGION;
}

export function listCredentialEnvFileNames(workspaceRoot: string): string[] {
  return listWorkspaceEnvFileNames(workspaceRoot).filter((name) => name !== ENV_MCP_FILE);
}

export function createDefaultEnvMcp(
  workspaceRoot: string
): { fileName: string; created: boolean; filePath: string } {
  return createOrUpdateEnvMcpUrls(workspaceRoot, DEFAULT_HOSTING_REGION);
}

function resolveClientCredentials(
  env: Record<string, string>,
  envSuffix?: string
): { clientId: string; clientSecret: string; isAdmin: boolean } | undefined {
  const adminClientId = firstDefinedWithSuffix(
    env,
    ["CT_MCP_ADMIN_CLIENT_ID", "COMM_TOOLS_ADMIN_CLIENT_ID", "COMMERCETOOLS_ADMIN_CLIENT_ID"],
    envSuffix
  );
  const adminClientSecret = firstDefinedWithSuffix(
    env,
    [
      "CT_MCP_ADMIN_CLIENT_SECRET",
      "COMM_TOOLS_ADMIN_CLIENT_SECRET",
      "COMMERCETOOLS_ADMIN_CLIENT_SECRET",
    ],
    envSuffix
  );
  if (adminClientId && adminClientSecret) {
    return { clientId: adminClientId, clientSecret: adminClientSecret, isAdmin: true };
  }

  const clientId = firstDefinedWithSuffix(
    env,
    [
      "CT_MCP_CLIENT_ID",
      "COMMERCETOOLS_CLIENT_ID",
      "CTP_CLIENT_ID",
      "COMM_TOOLS_CLIENT_ID",
      "CLIENT_ID",
    ],
    envSuffix
  );
  const clientSecret = firstDefinedWithSuffix(
    env,
    [
      "CT_MCP_CLIENT_SECRET",
      "COMMERCETOOLS_CLIENT_SECRET",
      "CTP_CLIENT_SECRET",
      "COMM_TOOLS_CLIENT_SECRET",
      "CLIENT_SECRET",
    ],
    envSuffix
  );
  if (!clientId || !clientSecret) {
    return undefined;
  }

  const isAdminFlag = firstDefined(env, ["CT_MCP_IS_ADMIN"]);
  const isAdmin = isAdminFlag ? isAdminFlag.toLowerCase() === "true" : false;
  return { clientId, clientSecret, isAdmin };
}

export function connectionNameFromEnvFile(envFile: string): string {
  if (envFile === ".env") {
    return "Workspace";
  }
  const suffix = envFile.replace(/^\.env\.?/, "");
  return suffix ? `Workspace ${suffix.toUpperCase()}` : "Workspace";
}

function resolveEnvSuffix(
  env: Record<string, string>,
  options: { source?: string; envSuffix?: string }
): string | undefined {
  if (options.envSuffix) {
    return options.envSuffix;
  }
  const fromSource = options.source ? envSuffixFromSource(options.source) : undefined;
  if (fromSource) {
    return fromSource;
  }
  const detected = detectEnvSuffixesFromKeys(env);
  return detected[0];
}

function loadEnvForSource(workspaceRoot: string, envFileName: string): Record<string, string> {
  const env: Record<string, string> = {};
  const layerFiles: string[] = [];

  if (fs.existsSync(path.join(workspaceRoot, ".env"))) {
    layerFiles.push(".env");
  }

  if (envFileName !== ".env" && envFileName !== ENV_MCP_FILE) {
    layerFiles.push(envFileName);
  }

  if (fs.existsSync(path.join(workspaceRoot, ENV_MCP_FILE))) {
    layerFiles.push(ENV_MCP_FILE);
  } else if (envFileName === ENV_MCP_FILE) {
    layerFiles.push(ENV_MCP_FILE);
  }

  const seen = new Set<string>();
  for (const file of layerFiles) {
    if (seen.has(file)) {
      continue;
    }
    seen.add(file);
    Object.assign(env, parseEnvFile(path.join(workspaceRoot, file)));
  }

  return env;
}

export function resolveCredentialsFromEnv(
  env: Record<string, string>,
  options: {
    workspaceFolder?: string;
    source?: string;
    envSuffix?: string;
    manualProjectKey?: string;
  } = {}
): WorkspaceCredentials | undefined {
  const envSuffix = resolveEnvSuffix(env, options);
  const projectKeyFromEnv = firstDefinedWithSuffix(env, [...PROJECT_KEY_KEYS], envSuffix);
  const projectKey = projectKeyFromEnv ?? options.manualProjectKey?.trim();
  const client = resolveClientCredentials(env, envSuffix);
  if (!client || !projectKey) {
    return undefined;
  }

  const explicitAuthUrl = firstDefinedWithSuffix(env, [...AUTH_URL_KEYS], envSuffix);
  const explicitApiUrl = firstDefinedWithSuffix(env, [...API_URL_KEYS], envSuffix);
  const authUrl = explicitAuthUrl ?? DEFAULT_AUTH_URL;
  const apiUrl = explicitApiUrl ?? DEFAULT_API_URL;
  const urls = normalizeCommercetoolsUrls(authUrl, apiUrl);

  const name =
    firstDefined(env, ["CT_MCP_CONNECTION_NAME"]) ??
    (options.source ? connectionNameFromEnvFile(options.source) : undefined) ??
    (envSuffix ? `Workspace ${envSuffix}` : undefined) ??
    options.workspaceFolder ??
    projectKey;

  return {
    workspaceFolder: options.workspaceFolder ?? "",
    source: options.source ?? "workspace .env",
    name,
    projectKey,
    clientId: client.clientId,
    clientSecret: client.clientSecret,
    authUrl: urls.authUrl,
    apiUrl: urls.apiUrl,
    isAdmin: client.isAdmin,
    envSuffix,
    hasExplicitAuthUrl: Boolean(explicitAuthUrl),
    hasExplicitApiUrl: Boolean(explicitApiUrl),
  };
}

function listWorkspaceEnvFiles(workspaceRoot: string): string[] {
  if (!fs.existsSync(workspaceRoot)) {
    return [];
  }

  const discovered = fs
    .readdirSync(workspaceRoot)
    .filter((entry) => entry.startsWith(".env") && !TEMPLATE_ENV_FILES.has(entry))
    .map((entry) => path.join(workspaceRoot, entry));

  const ordered: string[] = [];
  for (const relative of ENV_FILE_PRIORITY) {
    const match = discovered.find((filePath) => path.basename(filePath) === relative);
    if (match) {
      ordered.push(match);
    }
  }

  for (const filePath of discovered.sort()) {
    if (!ordered.includes(filePath)) {
      ordered.push(filePath);
    }
  }

  return ordered;
}

function mergeEnvFiles(filePaths: string[]): { env: Record<string, string>; sources: string[] } {
  const env: Record<string, string> = {};
  const sources: string[] = [];

  // Load lower-priority files first so higher-priority entries win (see ENV_FILE_PRIORITY).
  for (const filePath of [...filePaths].reverse()) {
    const parsed = parseEnvFile(filePath);
    if (Object.keys(parsed).length === 0) {
      continue;
    }
    sources.unshift(path.basename(filePath));
    Object.assign(env, parsed);
  }

  return { env, sources };
}

export function listWorkspaceEnvFileNames(workspaceRoot: string): string[] {
  return listWorkspaceEnvFiles(workspaceRoot).map((filePath) => path.basename(filePath));
}

export function listCredentialEnvFileNamesForActiveWorkspace(): string[] {
  // Lazy import keeps this module testable outside VS Code.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const vscode = require("vscode") as typeof import("vscode");
  const folders = vscode.workspace.workspaceFolders;
  if (!folders?.length) {
    return [];
  }

  for (const folder of folders) {
    const names = listCredentialEnvFileNames(folder.uri.fsPath);
    if (names.length > 0) {
      return names;
    }
  }

  return [];
}

export function getSelectedWorkspaceEnvFile(
  context: import("vscode").ExtensionContext,
  workspaceRoot: string
): string | undefined {
  const files = listCredentialEnvFileNames(workspaceRoot);
  if (!files.length) {
    return hasEnvMcpFile(workspaceRoot) ? ".env" : undefined;
  }

  const saved = context.workspaceState.get<string>(WORKSPACE_ENV_SELECTED_KEY);
  if (saved && files.includes(saved)) {
    return saved;
  }

  if (files.includes(".env")) {
    return ".env";
  }

  return files[0];
}

export async function setSelectedWorkspaceEnvFile(
  context: import("vscode").ExtensionContext,
  envFile: string
): Promise<void> {
  await context.workspaceState.update(WORKSPACE_ENV_SELECTED_KEY, envFile);
}

export function findWorkspaceCredentialsFromFile(
  workspaceRoot: string,
  envFileName: string,
  workspaceFolderName?: string,
  envSuffix?: string,
  manualProjectKey?: string
): WorkspaceCredentials | undefined {
  const filePath = path.join(workspaceRoot, envFileName);
  if (!fs.existsSync(filePath)) {
    return undefined;
  }

  const env = loadEnvForSource(workspaceRoot, envFileName);
  if (Object.keys(env).length === 0) {
    return undefined;
  }

  return resolveCredentialsFromEnv(env, {
    workspaceFolder: workspaceFolderName,
    source: envFileName,
    envSuffix: envSuffix ?? envSuffixFromSource(envFileName),
    manualProjectKey,
  });
}

export function findWorkspaceCredentials(
  workspaceRoot: string,
  workspaceFolderName?: string,
  envFileName?: string,
  envSuffix?: string,
  manualProjectKey?: string
): WorkspaceCredentials | undefined {
  if (envFileName) {
    return findWorkspaceCredentialsFromFile(
      workspaceRoot,
      envFileName,
      workspaceFolderName,
      envSuffix,
      manualProjectKey
    );
  }

  const envFiles = listWorkspaceEnvFiles(workspaceRoot);
  if (envFiles.length === 0) {
    return undefined;
  }

  const merged = mergeEnvFiles(envFiles);
  if (Object.keys(merged.env).length === 0) {
    return undefined;
  }

  return resolveCredentialsFromEnv(merged.env, {
    workspaceFolder: workspaceFolderName,
    source: merged.sources.join(" + "),
    envSuffix,
    manualProjectKey,
  });
}

export function findActiveWorkspaceEnvProbe(
  context?: import("vscode").ExtensionContext
): WorkspaceEnvProbe | undefined {
  // Lazy import keeps this module testable outside VS Code.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const vscode = require("vscode") as typeof import("vscode");
  const folders = vscode.workspace.workspaceFolders;
  if (!folders?.length) {
    return undefined;
  }

  for (const folder of folders) {
    const workspaceRoot = folder.uri.fsPath;
    const envFileName = context
      ? getSelectedWorkspaceEnvFile(context, workspaceRoot)
      : listWorkspaceEnvFileNames(workspaceRoot)[0];
    if (!envFileName) {
      continue;
    }

    const envSuffix = context
      ? getSelectedWorkspaceEnvSuffix(context, workspaceRoot, envFileName)
      : undefined;
    const manualProjectKey = context ? getManualProjectKey(context, envSuffix) : undefined;

    const probe = probeWorkspaceEnv(workspaceRoot, envFileName, {
      workspaceFolder: folder.name,
      envSuffix,
      manualProjectKey,
    });
    if (
      probe.credentials ||
      probe.hasClientCredentials ||
      probe.detectedEnvSuffixes.length > 0 ||
      probe.hasEnvMcpFile
    ) {
      return probe;
    }
  }

  return undefined;
}

export function findActiveWorkspaceEnvFiles(): string[] {
  return listCredentialEnvFileNamesForActiveWorkspace();
}

export function findActiveWorkspaceCredentials(
  context?: import("vscode").ExtensionContext
): WorkspaceCredentials | undefined {
  // Lazy import keeps this module testable outside VS Code.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const vscode = require("vscode") as typeof import("vscode");
  const folders = vscode.workspace.workspaceFolders;
  if (!folders?.length) {
    return undefined;
  }

  for (const folder of folders) {
    const workspaceRoot = folder.uri.fsPath;
    const selectedEnvFile = context
      ? getSelectedWorkspaceEnvFile(context, workspaceRoot)
      : listWorkspaceEnvFileNames(workspaceRoot)[0];

    const envSuffix = context
      ? getSelectedWorkspaceEnvSuffix(context, workspaceRoot, selectedEnvFile ?? ".env")
      : undefined;
    const manualProjectKey = context ? getManualProjectKey(context, envSuffix) : undefined;

    const credentials = findWorkspaceCredentials(
      workspaceRoot,
      folder.name,
      selectedEnvFile,
      envSuffix,
      manualProjectKey
    );
    if (credentials) {
      return credentials;
    }
  }

  return undefined;
}
