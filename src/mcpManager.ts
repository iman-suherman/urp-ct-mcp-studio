import * as vscode from "vscode";
import { ConnectionStore } from "./connectionStore";
import { resolveStudioConfig } from "./config";
import { LogStore } from "./logStore";
import { McpProcessManager } from "./mcpProcessManager";
import { syncNativeMcpConfig } from "./nativeMcpBridge";
import { initProjectMcpContext, ProjectMcpInitResult } from "./projectMcpInit";
import {
  COMMERCETOOLS_HOSTING_REGIONS,
  createOrUpdateEnvMcpUrls,
  createWorkspaceSupplementEnvFile,
  ENV_MCP_FILE,
  findActiveWorkspaceCredentials,
  findActiveWorkspaceEnvFiles,
  findActiveWorkspaceEnvProbe,
  getSelectedWorkspaceEnvFile,
  getSelectedWorkspaceEnvSuffix,
  listSupplementEnvSuffixOptions,
  setSelectedWorkspaceEnvFile,
  setSelectedWorkspaceEnvSuffix,
  supplementEnvFileName,
  WorkspaceCredentials,
  WorkspaceEnvProbe,
} from "./workspaceEnvCredentials";
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
  private readonly processManager: McpProcessManager;
  readonly logs = new LogStore();
  private readonly changeEmitter = new vscode.EventEmitter<void>();
  readonly onDidChange = this.changeEmitter.event;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly store: ConnectionStore
  ) {
    this.processManager = new McpProcessManager(context.extensionPath);
    this.processManager.on("log", (message: string) => {
      this.logs.info(message, message.startsWith("[connect]") ? "connect" : undefined);
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

  async validateConnectionIdentity(
    input: Pick<MCPConnectionInput, "name" | "projectKey">
  ): Promise<void> {
    const name = input.name.trim();
    const projectKey = input.projectKey.trim();

    if (!name || !projectKey) {
      throw new Error("Name and project key are required.");
    }
  }

  async saveConnection(input: MCPConnectionInput, existingId?: string): Promise<MCPConnection> {
    await this.validateConnectionIdentity(input);

    const workspace = findActiveWorkspaceCredentials(this.context);
    const clientId = input.clientId.trim() || workspace?.clientId || "";
    if (!clientId) {
      throw new Error(
        "Client ID is required. Add commercetools credentials to the workspace .env file."
      );
    }

    const connection = await this.store.saveConnection(
      {
        ...input,
        clientId,
        authUrl: input.authUrl.trim() || workspace?.authUrl || "",
        apiUrl: input.apiUrl.trim() || workspace?.apiUrl || "",
        isAdmin: input.isAdmin ?? workspace?.isAdmin ?? true,
      },
      existingId
    );
    this.logs.info(`Saved connection "${connection.name}".`);
    this.notifyChanged();
    return connection;
  }

  getWorkspaceCredentials(): WorkspaceCredentials | undefined {
    return findActiveWorkspaceCredentials(this.context);
  }

  getWorkspaceEnvProbe(): WorkspaceEnvProbe | undefined {
    return findActiveWorkspaceEnvProbe(this.context);
  }

  getDetectedEnvSuffixes(): string[] {
    return this.getWorkspaceEnvProbe()?.detectedEnvSuffixes ?? [];
  }

  getSelectedWorkspaceEnvSuffix(): string | undefined {
    const folder = vscode.workspace.workspaceFolders?.[0];
    if (!folder) {
      return undefined;
    }
    const envFile = this.getSelectedWorkspaceEnvFile();
    if (!envFile) {
      return undefined;
    }
    return getSelectedWorkspaceEnvSuffix(this.context, folder.uri.fsPath, envFile);
  }

  async setSelectedWorkspaceEnvSuffix(envSuffix: string): Promise<void> {
    await setSelectedWorkspaceEnvSuffix(this.context, envSuffix);
    this.notifyChanged();
  }

  getWorkspaceEnvFiles(): string[] {
    return findActiveWorkspaceEnvFiles();
  }

  getSelectedWorkspaceEnvFile(): string | undefined {
    const folder = vscode.workspace.workspaceFolders?.[0];
    if (!folder) {
      return undefined;
    }
    return getSelectedWorkspaceEnvFile(this.context, folder.uri.fsPath);
  }

  async setSelectedWorkspaceEnvFile(envFile: string): Promise<void> {
    await setSelectedWorkspaceEnvFile(this.context, envFile);
    this.notifyChanged();
  }

  async createSupplementEnvFile(): Promise<
    { fileName: string; created: boolean } | undefined
  > {
    const folder = vscode.workspace.workspaceFolders?.[0];
    if (!folder) {
      throw new Error("Open a workspace folder before creating a supplement .env file.");
    }

    const workspaceRoot = folder.uri.fsPath;
    const envFile = this.getSelectedWorkspaceEnvFile() ?? ".env";
    const suffixOptions = listSupplementEnvSuffixOptions(workspaceRoot, envFile);
    const picked = await vscode.window.showQuickPick(
      suffixOptions.map((suffix) => ({
        label: suffix,
        description: supplementEnvFileName(suffix),
        detail:
          suffix === "STG"
            ? "Default — pairs with COMM_TOOLS_*_STG in .env"
            : `Creates ${supplementEnvFileName(suffix)} with Australia GCP URLs`,
      })),
      {
        title: "Environment for supplement .env",
        placeHolder: "Choose STG, DEV, SIT, PRD, …",
      }
    );
    if (!picked) {
      return undefined;
    }

    const result = createWorkspaceSupplementEnvFile(workspaceRoot, picked.label);
    await setSelectedWorkspaceEnvFile(this.context, result.fileName);

    const uri = vscode.Uri.joinPath(folder.uri, result.fileName);
    const doc = await vscode.workspace.openTextDocument(uri);
    await vscode.window.showTextDocument(doc, { preview: false });

    this.logs.info(
      result.created
        ? `Created supplement env file ${result.fileName}.`
        : `Opened existing supplement env file ${result.fileName}.`
    );
    this.notifyChanged();
    return { fileName: result.fileName, created: result.created };
  }

  async createEnvMcpUrls(): Promise<{ fileName: string; created: boolean } | undefined> {
    const folder = vscode.workspace.workspaceFolders?.[0];
    if (!folder) {
      throw new Error("Open a workspace folder before creating .env.mcp.");
    }

    const cloudPick = await vscode.window.showQuickPick(
      [
        {
          label: "Google Cloud (GCP)",
          description: "Recommended for Australia, Europe, and North America",
          cloud: "gcp" as const,
        },
        {
          label: "Amazon Web Services (AWS)",
          description: "Ohio and Frankfurt regions",
          cloud: "aws" as const,
        },
      ],
      {
        title: "Cloud provider for commercetools API",
        placeHolder: "Choose GCP or AWS",
      }
    );
    if (!cloudPick) {
      return undefined;
    }

    const regions = COMMERCETOOLS_HOSTING_REGIONS.filter(
      (entry) => entry.cloud === cloudPick.cloud
    );
    const regionPick = await vscode.window.showQuickPick(
      regions.map((entry) => ({
        label: entry.label,
        description: entry.authUrl,
        entry,
      })),
      {
        title: `${cloudPick.label} region`,
        placeHolder: "Choose the region that hosts your project",
      }
    );
    if (!regionPick) {
      return undefined;
    }

    const workspaceRoot = folder.uri.fsPath;
    const result = createOrUpdateEnvMcpUrls(workspaceRoot, regionPick.entry);
    await setSelectedWorkspaceEnvFile(this.context, result.fileName);

    const uri = vscode.Uri.joinPath(folder.uri, result.fileName);
    const doc = await vscode.workspace.openTextDocument(uri);
    await vscode.window.showTextDocument(doc, { preview: false });

    this.logs.info(
      result.created
        ? `Created ${ENV_MCP_FILE} with ${regionPick.entry.label} URLs.`
        : `Updated ${ENV_MCP_FILE} with ${regionPick.entry.label} URLs.`
    );
    this.notifyChanged();
    return { fileName: result.fileName, created: result.created };
  }

  async ensureWorkspaceConnection(): Promise<MCPConnection | undefined> {
    const workspace = findActiveWorkspaceCredentials(this.context);
    if (!workspace) {
      return undefined;
    }

    const connections = await this.store.listConnections();
    const existing = connections.find(
      (item) =>
        item.projectKey === workspace.projectKey &&
        item.clientId === workspace.clientId
    );

    const connection = await this.store.saveConnection(
      {
        name: workspace.name,
        projectKey: workspace.projectKey,
        clientId: workspace.clientId,
        clientSecret: "",
        authUrl: workspace.authUrl,
        apiUrl: workspace.apiUrl,
        enabledTools: ["all"],
        isAdmin: workspace.isAdmin,
      },
      existing?.id
    );

    await this.store.setActiveConnection(connection.id);
    this.logs.info(
      `Using commercetools credentials from ${workspace.source} (${workspace.projectKey}).`
    );
    this.notifyChanged();
    return connection;
  }

  async resolveClientSecret(connection: MCPConnection): Promise<string | undefined> {
    const stored = await this.store.getClientSecret(connection.id);
    if (stored?.trim()) {
      return stored.trim();
    }

    const workspace = findActiveWorkspaceCredentials(this.context);
    if (
      workspace &&
      workspace.projectKey === connection.projectKey &&
      workspace.clientId === connection.clientId
    ) {
      return workspace.clientSecret;
    }

    return undefined;
  }

  async hasResolvableSecret(connection: MCPConnection): Promise<boolean> {
    return Boolean(await this.resolveClientSecret(connection));
  }

  async selectConnection(id: string): Promise<void> {
    const connection = await this.store.getConnection(id);
    if (!connection) {
      throw new Error("Connection not found.");
    }

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

  async connect(
    connectionId?: string,
    options: { openExplorer?: boolean } = {}
  ): Promise<ConnectionTestResult> {
    const config = resolveStudioConfig();
    let targetId = connectionId ?? (await this.store.getActiveConnectionId());
    if (!targetId) {
      const imported = await this.ensureWorkspaceConnection();
      targetId = imported?.id;
    }
    if (!targetId) {
      throw new Error(
        "No commercetools credentials found. Add CTP_* or CTOOLS_* variables to the workspace .env file."
      );
    }

    const connection = await this.store.getConnection(targetId);
    if (!connection) {
      throw new Error("Connection not found.");
    }

    const clientSecret = await this.resolveClientSecret(connection);
    if (!clientSecret) {
      throw new Error(
        "Commercetools credentials not found. Add CTP_* or CTOOLS_* variables to the workspace .env file."
      );
    }

    return vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `Connecting to ${connection.name}…`,
        cancellable: false,
      },
      async () => {
        const started = Date.now();
        this.logs.info(
          `[connect] Connecting to ${connection.name} (${connection.projectKey})…`,
          "connect"
        );
        this.notifyChanged();

        try {
          this.logs.info("[connect] Starting MCP stdio client…", "connect");
          this.notifyChanged();
          const tools = await this.processManager.connect(connection, clientSecret);
          this.logs.info("[connect] MCP handshake complete.", "connect");
          this.notifyChanged();

          this.logs.info("[connect] Saving active connection and caching tool metadata…", "connect");
          this.notifyChanged();
          await this.store.setActiveConnection(connection.id);
          await this.context.globalState.update(GLOBAL_CACHED_TOOLS_KEY, tools);

          const health = await this.buildHealth(connection, tools.length, true);
          const message = `Connected · ${tools.length} tool(s) loaded`;
          await this.context.globalState.update(GLOBAL_CONNECTION_STATUS_KEY, message);

          if (config.syncNativeMcpConfig) {
            this.logs.info("[connect] Syncing native MCP config…", "connect");
            this.notifyChanged();
            await syncNativeMcpConfig(connection, clientSecret, this.context.extensionPath);
          }

          this.logs.success(`Connected to ${connection.name}. ${tools.length} tools loaded.`);
          if (options.openExplorer ?? true) {
            this.openExplorerIfEnabled();
          }
          this.notifyChanged();

          return {
            ok: true,
            message,
            latencyMs: Date.now() - started,
            tools,
            health,
          };
        } catch (err) {
          let text = err instanceof Error ? err.message : String(err);
          const detail = err instanceof Error && err.stack ? err.stack : text;
          if (text.includes("Request timed out") || text.includes("-32001")) {
            text =
              "Commerce MCP took too long to start. Reload the window and try again — first connect can take up to 3 minutes while tools load.";
          }
          await this.context.globalState.update(
            GLOBAL_CONNECTION_STATUS_KEY,
            `Connection failed: ${text}`
          );
          this.logs.error(`Connection failed: ${text}`);
          this.logs.error(`[connect] Failure detail: ${detail}`, "connect");
          await syncNativeMcpConfig(undefined, undefined, this.context.extensionPath);
          this.notifyChanged();
          throw err;
        }
      }
    );
  }

  async disconnect(): Promise<void> {
    await this.processManager.disconnect();
    await syncNativeMcpConfig(undefined, undefined, this.context.extensionPath);
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

  async initProjectMcpContext(extensionPath: string): Promise<ProjectMcpInitResult> {
    let connection = await this.getActiveConnection();
    if (!connection) {
      connection = await this.ensureWorkspaceConnection();
    }
    if (!connection) {
      throw new Error("No commercetools credentials found in workspace .env files.");
    }

    const clientSecret = await this.resolveClientSecret(connection);
    if (!clientSecret) {
      throw new Error(
        "Commercetools credentials not found in the workspace .env for the active connection."
      );
    }

    const result = await initProjectMcpContext(extensionPath, connection, clientSecret);
    this.logs.success(
      `Initialized project MCP context for "${connection.name}" in ${result.workspaceFolder}.`,
      "project-init"
    );
    this.notifyChanged();
    return result;
  }

  private openExplorerIfEnabled(): void {
    const config = resolveStudioConfig();
    if (!config.openExplorerOnConnect) {
      return;
    }
    void vscode.commands.executeCommand("ctMcp.openExplorer");
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
  let active = await manager.getActiveConnection();
  if (!active) {
    active = await manager.ensureWorkspaceConnection();
  }
  if (!active || (await manager.isConnected())) {
    return;
  }

  try {
    const result = await manager.connect(active.id, { openExplorer: false });
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
