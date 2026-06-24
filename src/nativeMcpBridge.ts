import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as vscode from "vscode";
import { MCPConnection } from "./types";
import { resolveStudioConfig } from "./config";
import { buildNativeMcpServerConfig } from "./mcpBootstrap";
import { syncCopilotMcpSession } from "./copilotMcpBridge";

function resolveUserMcpJsonPath(): string | undefined {
  const appName = vscode.env.appName.replace(/\s+/g, "-").toLowerCase() || "code-oss-dev";
  const home = os.homedir();

  if (process.platform === "darwin") {
    return path.join(home, "Library", "Application Support", appName, "User", "mcp.json");
  }
  if (process.platform === "win32") {
    const appData = process.env.APPDATA ?? path.join(home, "AppData", "Roaming");
    return path.join(appData, appName, "User", "mcp.json");
  }
  return path.join(home, ".config", appName, "User", "mcp.json");
}

const WORKSPACE_MCP_FILE = path.join(".vscode", "mcp.json");

function resolveWorkspaceMcpJsonPath(): string | undefined {
  const folder = vscode.workspace.workspaceFolders?.[0];
  if (!folder) {
    return undefined;
  }
  return path.join(folder.uri.fsPath, WORKSPACE_MCP_FILE);
}

function readWorkspaceMcpPayload(filePath: string): Record<string, unknown> {
  if (!fs.existsSync(filePath)) {
    return { servers: {} };
  }
  try {
    const payload = JSON.parse(fs.readFileSync(filePath, "utf-8")) as Record<string, unknown>;
    if (!payload.servers || typeof payload.servers !== "object") {
      payload.servers = {};
    }
    return payload;
  } catch {
    return { servers: {} };
  }
}

function syncWorkspaceMcpJson(
  connection: MCPConnection | undefined,
  clientSecret: string | undefined,
  extensionPath: string | undefined,
  serverId: string
): void {
  if (!vscode.workspace.getConfiguration("ctMcp").get<boolean>("syncWorkspaceMcpConfig", true)) {
    return;
  }

  const filePath = resolveWorkspaceMcpJsonPath();
  if (!filePath) {
    return;
  }

  const payload = readWorkspaceMcpPayload(filePath);
  const servers = { ...((payload.servers as Record<string, unknown> | undefined) ?? {}) };

  if (!connection || !clientSecret) {
    delete servers[serverId];
  } else {
    servers[serverId] = buildNativeMcpServerConfig(connection, clientSecret, extensionPath);
  }

  if (Object.keys(servers).length === 0) {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    return;
  }

  payload.servers = servers;
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf-8");
}

export async function syncNativeMcpConfig(
  connection: MCPConnection | undefined,
  clientSecret: string | undefined,
  extensionPath?: string
): Promise<void> {
  const config = resolveStudioConfig();
  if (!config.syncNativeMcpConfig) {
    return;
  }

  const serverId = config.nativeMcpServerId;
  const mcpConfig = vscode.workspace.getConfiguration("mcp");
  const existingServers = { ...(mcpConfig.get<Record<string, unknown>>("servers") ?? {}) };

  if (!connection || !clientSecret) {
    delete existingServers[serverId];
    await mcpConfig.update("servers", existingServers, vscode.ConfigurationTarget.Global);
    syncWorkspaceMcpJson(undefined, undefined, extensionPath, serverId);

    const filePath = resolveUserMcpJsonPath();
    if (filePath && fs.existsSync(filePath)) {
      try {
        const payload = JSON.parse(fs.readFileSync(filePath, "utf-8")) as Record<string, unknown>;
        const servers = { ...((payload.servers as Record<string, unknown> | undefined) ?? {}) };
        delete servers[serverId];
        payload.servers = servers;
        fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf-8");
      } catch {
        // ignore malformed mcp.json
      }
    }

    await reloadNativeMcp();
    await syncCopilotMcpSession(undefined, undefined, extensionPath ?? "");
    return;
  }

  const serverConfig = buildNativeMcpServerConfig(connection, clientSecret, extensionPath);
  existingServers[serverId] = serverConfig;
  await mcpConfig.update("servers", existingServers, vscode.ConfigurationTarget.Global);
  syncWorkspaceMcpJson(connection, clientSecret, extensionPath, serverId);

  const filePath = resolveUserMcpJsonPath();
  if (filePath) {
    let payload: Record<string, unknown> = {};
    if (fs.existsSync(filePath)) {
      try {
        payload = JSON.parse(fs.readFileSync(filePath, "utf-8")) as Record<string, unknown>;
      } catch {
        payload = {};
      }
    }

    payload.servers = {
      ...((payload.servers as Record<string, unknown> | undefined) ?? {}),
      [serverId]: buildNativeMcpServerConfig(connection, clientSecret, extensionPath),
    };

    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf-8");
  }

  await reloadNativeMcp();
  await syncCopilotMcpSession(connection, clientSecret, extensionPath ?? "");
}

async function reloadNativeMcp(): Promise<void> {
  const commands = ["mcp.reload", "workbench.mcp.reload"];
  for (const command of commands) {
    try {
      await vscode.commands.executeCommand(command);
      return;
    } catch {
      // command may not exist in all VS Code builds
    }
  }
}
