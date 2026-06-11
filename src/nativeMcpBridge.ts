import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as vscode from "vscode";
import { MCPConnection } from "./types";
import { resolveStudioConfig } from "./config";
import { buildNativeMcpServerConfig } from "./mcpBootstrap";

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
    return;
  }

  existingServers[serverId] = buildNativeMcpServerConfig(connection, clientSecret, extensionPath);
  await mcpConfig.update("servers", existingServers, vscode.ConfigurationTarget.Global);

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
