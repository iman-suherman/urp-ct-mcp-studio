import * as vscode from "vscode";
import { ConnectionStore } from "./connectionStore";
import { resolveStudioConfig } from "./config";
import { LogStore } from "./logStore";
import { McpProcessManager } from "./mcpProcessManager";
import { syncNativeMcpConfig } from "./nativeMcpBridge";
import {
  GLOBAL_CACHED_TOOLS_KEY,
  GLOBAL_CONNECTION_STATUS_KEY,
} from "./secrets";
import {
  ConnectionHealth,
  ConnectionTestResult,
  MCPConnection,
  MCPConnectionInput,
  MCPTool,
} from "./types";

export class CommerceMcpManager {
  private readonly processManager = new McpProcessManager();
  readonly logs = new LogStore();
  private readonly changeEmitter = new vscode.EventEmitter<void>();
  readonly onDidChange = this.changeEmitter.event;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly store: ConnectionStore
  ) {
    this.processManager.on("log", (message: string) => {
      this.logs.info(message);
      this.notifyChanged();
    });
  }

  private notifyChanged(): void {
    this.changeEmitter.fire();
  }

  async listConnections(): Promise<MCPConnection[]> {
    return this.store.listConnections();
  }

  async getActiveConnection(): Promise<MCPConnection | undefined> {
    return this.store.getActiveConnection();
  }

  async isConnected(): Promise<boolean> {
    return this.processManager.isConnected;
  }

  getConnectionStatusMessage(): string | undefined {
    return this.context.globalState.get<string>(GLOBAL_CONNECTION_STATUS_KEY);
  }

  async listTools(): Promise<MCPTool[]> {
    if (this.processManager.isConnected) {
      return this.processManager.cachedTools;
    }
    return this.context.globalState.get<MCPTool[]>(GLOBAL_CACHED_TOOLS_KEY, []);
  }

  async saveConnection(input: MCPConnectionInput, existingId?: string): Promise<MCPConnection> {
    const connection = await this.store.saveConnection(input, existingId);
    this.logs.info(`Saved connection "${connection.name}".`);
    this.notifyChanged();
    return connection;
  }

  async selectConnection(id: string): Promise<void> {
    await this.store.setActiveConnection(id);
    this.notifyChanged();
  }

  async deleteConnection(id: string): Promise<void> {
    const active = await this.store.getActiveConnectionId();
    if (active === id) {
      await this.disconnect();
    }
    const connection = await this.store.getConnection(id);
    await this.store.deleteConnection(id);
    this.logs.info(`Deleted connection "${connection?.name ?? id}".`);
    this.notifyChanged();
  }

  async connect(connectionId?: string): Promise<ConnectionTestResult> {
    const config = resolveStudioConfig();
    const targetId = connectionId ?? (await this.store.getActiveConnectionId());
    if (!targetId) {
      throw new Error("Select or create a connection first.");
    }

    const connection = await this.store.getConnection(targetId);
    if (!connection) {
      throw new Error("Connection not found.");
    }

    const clientSecret = await this.store.getClientSecret(connection.id);
    if (!clientSecret) {
      throw new Error("Client secret is missing for this connection.");
    }

    return vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `Connecting to ${connection.name}…`,
        cancellable: false,
      },
      async () => {
        const started = Date.now();
        this.logs.info(`Connecting to ${connection.name} (${connection.projectKey})…`);

        try {
          const tools = await this.processManager.connect(connection, clientSecret);
          await this.store.setActiveConnection(connection.id);
          await this.context.globalState.update(GLOBAL_CACHED_TOOLS_KEY, tools);

          const health = await this.buildHealth(connection, tools.length, true);
          const message = `Connected · ${tools.length} tool(s) loaded`;
          await this.context.globalState.update(GLOBAL_CONNECTION_STATUS_KEY, message);

          if (config.syncNativeMcpConfig) {
            await syncNativeMcpConfig(connection, clientSecret);
          }

          this.logs.success(`Connected to ${connection.name}. ${tools.length} tools loaded.`);
          this.notifyChanged();

          return {
            ok: true,
            message,
            latencyMs: Date.now() - started,
            tools,
            health,
          };
        } catch (err) {
          const text = err instanceof Error ? err.message : String(err);
          await this.context.globalState.update(
            GLOBAL_CONNECTION_STATUS_KEY,
            `Connection failed: ${text}`
          );
          this.logs.error(`Connection failed: ${text}`);
          await syncNativeMcpConfig(undefined, undefined);
          this.notifyChanged();
          throw err;
        }
      }
    );
  }

  async disconnect(): Promise<void> {
    await this.processManager.disconnect();
    await syncNativeMcpConfig(undefined, undefined);
    await this.context.globalState.update(GLOBAL_CONNECTION_STATUS_KEY, "Disconnected");
    this.logs.info("Disconnected from Commerce MCP.");
    this.notifyChanged();
  }

  async refresh(): Promise<MCPTool[]> {
    if (!this.processManager.isConnected) {
      throw new Error("Commerce MCP is not connected.");
    }

    const tools = await this.processManager.listTools();
    await this.context.globalState.update(GLOBAL_CACHED_TOOLS_KEY, tools);
    await this.context.globalState.update(
      GLOBAL_CONNECTION_STATUS_KEY,
      `Connected · ${tools.length} tool(s) loaded`
    );
    this.logs.success(`Refreshed tool list (${tools.length} tools).`);
    this.notifyChanged();
    return tools;
  }

  async testConnection(): Promise<ConnectionTestResult> {
    if (!this.processManager.isConnected) {
      const active = await this.store.getActiveConnection();
      if (!active) {
        return { ok: false, message: "No active connection configured." };
      }
      try {
        return await this.connect(active.id);
      } catch (err) {
        const text = err instanceof Error ? err.message : String(err);
        return { ok: false, message: text };
      }
    }

    const started = Date.now();
    try {
      const tools = await this.processManager.listTools();
      const connection = await this.store.getActiveConnection();
      const health = await this.buildHealth(connection, tools.length, true);
      const message = `Connected · ${tools.length} tool(s) loaded`;
      await this.context.globalState.update(GLOBAL_CONNECTION_STATUS_KEY, message);
      this.notifyChanged();
      return {
        ok: true,
        message,
        latencyMs: Date.now() - started,
        tools,
        health,
      };
    } catch (err) {
      const text = err instanceof Error ? err.message : String(err);
      return { ok: false, message: text };
    }
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
    this.logs.info(`Executing ${name}…`, name);
    try {
      const result = await this.processManager.callTool(name, args);
      this.logs.success(`${name} succeeded.`, name);
      this.notifyChanged();
      return result;
    } catch (err) {
      const text = err instanceof Error ? err.message : String(err);
      this.logs.error(`${name} failed: ${text}`, name);
      this.notifyChanged();
      throw err;
    }
  }

  private async buildHealth(
    connection: MCPConnection | undefined,
    toolCount: number,
    mcpRunning: boolean
  ): Promise<ConnectionHealth> {
    return {
      mcpRunning,
      authValid: mcpRunning,
      apiReachable: mcpRunning,
      toolsLoaded: toolCount,
      message: connection
        ? `${connection.name} · ${connection.projectKey}`
        : undefined,
    };
  }
}

let managerSingleton: CommerceMcpManager | undefined;

export function getCommerceMcpManager(context: vscode.ExtensionContext): CommerceMcpManager {
  if (!managerSingleton) {
    managerSingleton = new CommerceMcpManager(context, new ConnectionStore(context));
  }
  return managerSingleton;
}

export async function deactivateCommerceMcpManager(): Promise<void> {
  if (managerSingleton) {
    await managerSingleton.disconnect();
  }
}

export async function maybeAutoConnect(context: vscode.ExtensionContext): Promise<void> {
  const config = resolveStudioConfig();
  if (!config.autoConnectOnStartup) {
    return;
  }

  const manager = getCommerceMcpManager(context);
  const active = await manager.getActiveConnection();
  if (!active || (await manager.isConnected())) {
    return;
  }

  try {
    const result = await manager.connect(active.id);
    if (result.ok && result.tools && result.tools.length > 0) {
      void vscode.window.setStatusBarMessage(
        `Commerce MCP: ${result.tools.length} tool(s) ready`,
        5000
      );
    }
  } catch (err) {
    console.warn("Commerce MCP auto-connect failed:", err);
  }
}
