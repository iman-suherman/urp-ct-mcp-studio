import { createRequire } from "module";
import * as path from "path";
import { MCPConnection } from "./types";
import { resolveStudioConfig, ResolvedStudioConfig } from "./config";

const nodeRequire = createRequire(__filename);

/** MCP initialize/listTools can exceed the SDK default 60s on first connect. */
export const MCP_REQUEST_TIMEOUT_MS = 180_000;

export interface CommerceMcpSpawn {
  command: string;
  args: string[];
  env: Record<string, string>;
}

function parseCommerceMcpPackage(spec: string): string {
  const at = spec.lastIndexOf("@");
  if (at <= 0) {
    return spec;
  }
  return spec.slice(0, at);
}

export function buildCommerceMcpCliArgs(
  connection: MCPConnection,
  clientSecret: string,
  config: ResolvedStudioConfig = resolveStudioConfig()
): string[] {
  const tools = connection.enabledTools.join(",") || "all";

  const args = [
    `--tools=${tools}`,
    "--authType=client_credentials",
    `--clientId=${connection.clientId}`,
    `--clientSecret=${clientSecret}`,
    `--projectKey=${connection.projectKey}`,
    `--authUrl=${connection.authUrl}`,
    `--apiUrl=${connection.apiUrl}`,
    `--dynamicToolLoadingThreshold=${config.dynamicToolLoadingThreshold}`,
  ];

  if (connection.isAdmin || tools === "all") {
    args.push("--isAdmin=true");
  }

  return args;
}

/** @deprecated Use buildCommerceMcpCliArgs or resolveCommerceMcpSpawn. */
export function buildCommerceMcpArgs(
  connection: MCPConnection,
  clientSecret: string
): string[] {
  const config = resolveStudioConfig();
  return ["-y", config.commerceMcpPackage, ...buildCommerceMcpCliArgs(connection, clientSecret, config)];
}

export function buildMcpSpawnEnv(): Record<string, string> {
  const pathKey = process.platform === "win32" ? "Path" : "PATH";
  const nodeBin = path.dirname(process.execPath);
  const existingPath = process.env[pathKey] ?? "";
  const env: Record<string, string> = {};

  for (const [key, value] of Object.entries({
    ELECTRON_RUN_AS_NODE: "1",
    HOME: process.env.HOME,
    LOGNAME: process.env.LOGNAME,
    [pathKey]: `${nodeBin}${path.delimiter}${existingPath}`,
    SHELL: process.env.SHELL,
    TERM: process.env.TERM,
    USER: process.env.USER,
    ...(process.platform === "win32"
      ? {
          APPDATA: process.env.APPDATA,
          LOCALAPPDATA: process.env.LOCALAPPDATA,
          SYSTEMROOT: process.env.SYSTEMROOT,
          USERPROFILE: process.env.USERPROFILE,
        }
      : {}),
  })) {
    if (value !== undefined) {
      env[key] = value;
    }
  }

  return env;
}

function resolveNpxCommand(): string {
  return path.join(
    path.dirname(process.execPath),
    process.platform === "win32" ? "npx.cmd" : "npx"
  );
}

export function resolveCommerceMcpSpawn(
  connection: MCPConnection,
  clientSecret: string,
  extensionPath?: string
): CommerceMcpSpawn {
  const config = resolveStudioConfig();
  const cliArgs = buildCommerceMcpCliArgs(connection, clientSecret, config);
  const env = buildMcpSpawnEnv();
  const packageName = parseCommerceMcpPackage(config.commerceMcpPackage);
  const resolver = extensionPath
    ? createRequire(path.join(extensionPath, "package.json"))
    : nodeRequire;

  try {
    const entry = resolver.resolve(`${packageName}/dist/index.js`);
    return { command: process.execPath, args: [entry, ...cliArgs], env };
  } catch {
    return {
      command: resolveNpxCommand(),
      args: ["-y", config.commerceMcpPackage, ...cliArgs],
      env,
    };
  }
}

export function buildNativeMcpServerConfig(
  connection: MCPConnection,
  clientSecret: string,
  extensionPath?: string
): Record<string, unknown> {
  const spawn = resolveCommerceMcpSpawn(connection, clientSecret, extensionPath);
  return {
    type: "stdio",
    command: spawn.command,
    args: spawn.args,
    env: spawn.env,
  };
}

export function buildMcpCallJson(toolName: string, args: Record<string, unknown>): string {
  return JSON.stringify({ tool: toolName, arguments: args }, null, 2);
}

export function buildChatPrompt(text: string): string {
  return `@commerce-mcp\n${text.trim()}`;
}

export function buildAiPrompt(toolName: string, description?: string): string {
  const hint = description?.trim()
    ? description.trim()
    : `perform a useful task with the ${toolName} tool`;
  return `Using ${toolName},\n${hint}.`;
}
