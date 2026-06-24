import * as fs from "fs";
import * as path from "path";

const DEFAULT_AUTH_URL = "https://auth.europe-west1.gcp.commercetools.com";
const DEFAULT_API_URL = "https://api.europe-west1.gcp.commercetools.com";

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
    const value = stripQuotes(trimmed.slice(eq + 1));
    if (key && value) {
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

function firstDefined(env: Record<string, string>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = env[key]?.trim();
    if (value && !isPlaceholder(value)) {
      return value;
    }
  }
  return undefined;
}

function resolveClientCredentials(
  env: Record<string, string>
): { clientId: string; clientSecret: string; isAdmin: boolean } | undefined {
  const adminClientId = firstDefined(env, [
    "CT_MCP_ADMIN_CLIENT_ID",
    "COMM_TOOLS_ADMIN_CLIENT_ID",
    "COMMERCETOOLS_ADMIN_CLIENT_ID",
  ]);
  const adminClientSecret = firstDefined(env, [
    "CT_MCP_ADMIN_CLIENT_SECRET",
    "COMM_TOOLS_ADMIN_CLIENT_SECRET",
    "COMMERCETOOLS_ADMIN_CLIENT_SECRET",
  ]);
  if (adminClientId && adminClientSecret) {
    return { clientId: adminClientId, clientSecret: adminClientSecret, isAdmin: true };
  }

  const clientId = firstDefined(env, [
    "CT_MCP_CLIENT_ID",
    "COMMERCETOOLS_CLIENT_ID",
    "CTP_CLIENT_ID",
    "COMM_TOOLS_CLIENT_ID",
    "CLIENT_ID",
  ]);
  const clientSecret = firstDefined(env, [
    "CT_MCP_CLIENT_SECRET",
    "COMMERCETOOLS_CLIENT_SECRET",
    "CTP_CLIENT_SECRET",
    "COMM_TOOLS_CLIENT_SECRET",
    "CLIENT_SECRET",
  ]);
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

export function resolveCredentialsFromEnv(
  env: Record<string, string>,
  options: { workspaceFolder?: string; source?: string } = {}
): WorkspaceCredentials | undefined {
  const projectKey = firstDefined(env, [
    "CT_MCP_PROJECT_KEY",
    "COMMERCETOOLS_PROJECT_KEY",
    "CTP_PROJECT_KEY",
    "CTOOLS_PROJECT_KEY",
    "PROJECT_KEY",
  ]);
  const client = resolveClientCredentials(env);
  if (!projectKey || !client) {
    return undefined;
  }

  const authUrl =
    firstDefined(env, [
      "CT_MCP_AUTH_URL",
      "COMMERCETOOLS_AUTH_URL",
      "CTP_AUTH_URL",
      "CTOOLS_AUTH_HOST",
      "AUTH_URL",
    ]) ?? DEFAULT_AUTH_URL;
  const apiUrl =
    firstDefined(env, [
      "CT_MCP_API_URL",
      "COMMERCETOOLS_API_URL",
      "CTP_API_URL",
      "CTOOLS_API_HOST",
      "API_URL",
    ]) ?? DEFAULT_API_URL;
  const urls = normalizeCommercetoolsUrls(authUrl, apiUrl);

  const name =
    firstDefined(env, ["CT_MCP_CONNECTION_NAME"]) ??
    (options.source ? connectionNameFromEnvFile(options.source) : undefined) ??
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

export function getSelectedWorkspaceEnvFile(
  context: import("vscode").ExtensionContext,
  workspaceRoot: string
): string | undefined {
  const files = listWorkspaceEnvFileNames(workspaceRoot);
  if (!files.length) {
    return undefined;
  }

  const saved = context.workspaceState.get<string>(WORKSPACE_ENV_SELECTED_KEY);
  if (saved && files.includes(saved)) {
    return saved;
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
  workspaceFolderName?: string
): WorkspaceCredentials | undefined {
  const filePath = path.join(workspaceRoot, envFileName);
  if (!fs.existsSync(filePath)) {
    return undefined;
  }

  const env = parseEnvFile(filePath);
  if (Object.keys(env).length === 0) {
    return undefined;
  }

  return resolveCredentialsFromEnv(env, {
    workspaceFolder: workspaceFolderName,
    source: envFileName,
  });
}

export function findWorkspaceCredentials(
  workspaceRoot: string,
  workspaceFolderName?: string,
  envFileName?: string
): WorkspaceCredentials | undefined {
  if (envFileName) {
    return findWorkspaceCredentialsFromFile(workspaceRoot, envFileName, workspaceFolderName);
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
  });
}

export function findActiveWorkspaceEnvFiles(): string[] {
  // Lazy import keeps this module testable outside VS Code.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const vscode = require("vscode") as typeof import("vscode");
  const folders = vscode.workspace.workspaceFolders;
  if (!folders?.length) {
    return [];
  }

  for (const folder of folders) {
    const names = listWorkspaceEnvFileNames(folder.uri.fsPath);
    if (names.length > 0) {
      return names;
    }
  }

  return [];
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

    const credentials = findWorkspaceCredentials(
      workspaceRoot,
      folder.name,
      selectedEnvFile
    );
    if (credentials) {
      return credentials;
    }
  }

  return undefined;
}
