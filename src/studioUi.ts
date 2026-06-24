import * as vscode from "vscode";
import { resolveStudioConfig } from "./config";
import { formatLogTimestamp } from "./logStore";
import { buildAiPrompt, buildChatPrompt } from "./mcpBootstrap";
import { buildProductSearchChatPrompt } from "./mcpChatContext";
import { CommerceMcpManager } from "./mcpManager";
import { groupToolsByCategory } from "./toolCatalog";
import { PROMPT_TEMPLATES } from "./templates";
import { ConnectionHealth, LogEntry, MCPConnection } from "./types";
import { ExtensionUpdateState, UpdateService } from "./updateService";

const COPILOT_AGENT_EXAMPLE_PROMPT = "List commercetools products using Commerce MCP";

async function openCopilotAgentChat(prompt: string): Promise<void> {
  const attempts: Array<[string, unknown?]> = [
    ["workbench.action.chat.open", { query: prompt, isPartialQuery: false }],
    ["workbench.action.chat.open", { query: prompt }],
    ["workbench.action.chat.open"],
  ];

  for (const entry of attempts) {
    const [command, args] = entry;
    try {
      if (args !== undefined) {
        await vscode.commands.executeCommand(command, args);
      } else {
        await vscode.commands.executeCommand(command);
      }
      return;
    } catch {
      // try next command variant
    }
  }

  const action = await vscode.window.showInformationMessage(
    "Open Copilot Chat → Agent mode, enable commerce-mcp / commerceMcpTools / commerceMcpCall in the tools picker, then run your prompt.",
    "Copy example prompt"
  );
  if (action === "Copy example prompt") {
    await vscode.env.clipboard.writeText(prompt);
    void vscode.window.showInformationMessage("Example prompt copied to clipboard.");
  }
}

export interface StudioPanelState {
  activeTab: "connections" | "tools" | "logs" | "templates";
  activeConnection?: MCPConnection;
  connected: boolean;
  connectionStatus?: string;
  health?: ConnectionHealth;
  tools: Array<{ name: string; description?: string; category: string }>;
  toolGroups: Array<{ category: string; tools: Array<{ name: string; description?: string }> }>;
  logs: Array<{ time: string; level: string; message: string; toolName?: string }>;
  connectDiagnostics: Array<{ time: string; level: string; message: string }>;
  templates: Array<{ id: string; title: string; description: string; prompt: string; toolName: string }>;
  workspaceCredentials?: {
    name: string;
    projectKey: string;
    clientId: string;
    source: string;
    authUrl: string;
    apiUrl: string;
    isAdmin: boolean;
  };
  hasWorkspaceEnvFiles: boolean;
  workspaceEnvSources: string[];
  autoConnectOnStartup: boolean;
  currentVersion: string;
  latestVersion?: string;
  updateAvailable: boolean;
  updatePhase: ExtensionUpdateState["updatePhase"];
  updateProgress?: number;
  updateNotes: string[];
  updateError?: string;
  autoUpdateExtension: boolean;
  error?: string;
  busy?: boolean;
}

export type StudioWebviewMessage =
  | { type: "ready" }
  | { type: "switchTab"; tab: StudioPanelState["activeTab"] }
  | { type: "connectFromWorkspace" }
  | { type: "disconnect" }
  | { type: "refresh" }
  | { type: "openExplorer"; toolName?: string }
  | { type: "openNavigator" }
  | { type: "checkForUpdate" }
  | { type: "toggleAutoConnect"; enabled: boolean }
  | { type: "toggleAutoUpdate"; enabled: boolean }
  | { type: "installUpdate" }
  | { type: "reloadWindow" }
  | { type: "openCopilotAgent" }
  | { type: "copyChatPrompt"; text: string; agentContext?: boolean }
  | { type: "copyChatContext" }
  | { type: "copyAiPrompt"; toolName: string; description?: string }
  | { type: "clearLogs" };

export interface StudioUiHost {
  postMessage(message: StudioPanelState & { type: "state" }): Thenable<boolean>;
}

export class StudioUiController {
  private activeTab: StudioPanelState["activeTab"] = "connections";

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly manager: CommerceMcpManager,
    private readonly updateService: UpdateService,
    private readonly host: StudioUiHost
  ) {}

  bind(webview: vscode.Webview): void {
    webview.onDidReceiveMessage(
      (message: StudioWebviewMessage) => void this.handleMessage(message),
      undefined,
      this.context.subscriptions
    );
  }

  async pushState(error?: string, busy?: boolean): Promise<void> {
    const workspaceCredentials = this.manager.getWorkspaceCredentials();
    const workspaceEnvSources = this.manager.getWorkspaceEnvFiles();
    const update = this.updateService.getState();
    const active = await this.manager.getActiveConnection();
    const connected = await this.manager.isConnected();
    const tools = connected ? await this.manager.listTools() : [];
    const categorized = groupToolsByCategory(
      tools.map((tool) => ({
        ...tool,
        category: tool.name.includes(".") ? tool.name.split(".")[0] : "other",
        action: tool.name.includes(".") ? tool.name.split(".").slice(1).join(".") : tool.name,
      }))
    );

    const health =
      connected && active
        ? {
            mcpRunning: true,
            authValid: true,
            apiReachable: true,
            toolsLoaded: tools.length,
            message: `${active.name} · ${active.projectKey}`,
          }
        : undefined;
    const logs: LogEntry[] = this.manager.logs.list(80);
    const connectDiagnostics = logs
      .filter(
        (entry) =>
          entry.toolName === "connect" ||
          entry.message.startsWith("[connect]") ||
          /connection failed|connecting to/i.test(entry.message)
      )
      .slice(0, 30);

    await this.host.postMessage({
      type: "state",
      activeTab: this.activeTab,
      activeConnection: active,
      connected,
      connectionStatus: this.manager.getConnectionStatusMessage(),
      health: health,
      tools: tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        category: tool.name.includes(".") ? tool.name.split(".")[0] : "other",
      })),
      toolGroups: categorized.map((group) => ({
        category: group.category,
        tools: group.tools.map((tool) => ({
          name: tool.name,
          description: tool.description,
        })),
      })),
      logs: logs.map((entry) => ({
        time: formatLogTimestamp(entry.timestamp),
        level: entry.level,
        message: entry.message,
        toolName: entry.toolName,
      })),
      connectDiagnostics: connectDiagnostics.map((entry) => ({
        time: formatLogTimestamp(entry.timestamp),
        level: entry.level,
        message: entry.message,
      })),
      templates: PROMPT_TEMPLATES.map((template) => ({
        id: template.id,
        title: template.title,
        description: template.description,
        prompt: template.prompt,
        toolName: template.toolName,
      })),
      workspaceCredentials: workspaceCredentials
        ? {
            name: workspaceCredentials.name,
            projectKey: workspaceCredentials.projectKey,
            clientId: workspaceCredentials.clientId,
            source: workspaceCredentials.source,
            authUrl: workspaceCredentials.authUrl,
            apiUrl: workspaceCredentials.apiUrl,
            isAdmin: workspaceCredentials.isAdmin,
          }
        : undefined,
      hasWorkspaceEnvFiles: workspaceEnvSources.length > 0,
      workspaceEnvSources,
      autoConnectOnStartup: resolveStudioConfig().autoConnectOnStartup,
      currentVersion: update.currentVersion,
      latestVersion: update.latestVersion,
      updateAvailable: update.updateAvailable,
      updatePhase: update.updatePhase,
      updateProgress: update.updateProgress,
      updateNotes: update.updateNotes,
      updateError: update.updateError,
      autoUpdateExtension: update.autoUpdateExtension,
      error,
      busy,
    });
  }

  private async handleMessage(message: StudioWebviewMessage): Promise<void> {
    switch (message.type) {
      case "ready":
        void this.updateService.checkOnPanelVisible();
        await this.pushState();
        break;

      case "switchTab":
        this.activeTab = message.tab;
        await this.pushState();
        break;

      case "connectFromWorkspace":
        await this.pushState(undefined, true);
        try {
          const connection = await this.manager.ensureWorkspaceConnection();
          if (!connection) {
            await this.pushState(
              "No commercetools credentials found in workspace .env files."
            );
            break;
          }
          if (!(await this.manager.isConnected())) {
            await this.manager.connect(connection.id, { openExplorer: false });
          }
          await this.pushState(undefined, false);
        } catch (err) {
          const text = err instanceof Error ? err.message : String(err);
          await this.pushState(text);
        }
        break;

      case "disconnect":
        await this.pushState(undefined, true);
        await this.manager.disconnect();
        await this.pushState();
        break;

      case "refresh":
        await this.pushState(undefined, true);
        try {
          await this.manager.refresh();
          await this.pushState();
        } catch (err) {
          const text = err instanceof Error ? err.message : String(err);
          await this.pushState(text);
        }
        break;

      case "openExplorer":
        await vscode.commands.executeCommand("ctMcp.openExplorer", message.toolName);
        break;

      case "openNavigator":
        await vscode.commands.executeCommand("ctMcp.openNavigator");
        break;

      case "copyChatPrompt": {
        const active = await this.manager.getActiveConnection();
        await vscode.env.clipboard.writeText(
          buildChatPrompt(message.text, {
            agentContext: message.agentContext,
            connection: active,
          })
        );
        void vscode.window.showInformationMessage("Chat prompt copied to clipboard.");
        break;
      }

      case "copyChatContext": {
        const active = await this.manager.getActiveConnection();
        await vscode.env.clipboard.writeText(
          buildChatPrompt(buildProductSearchChatPrompt(5, active), {
            agentContext: true,
            connection: active,
          })
        );
        void vscode.window.showInformationMessage("Chat context and sample product-search prompt copied.");
        break;
      }

      case "copyAiPrompt":
        await vscode.env.clipboard.writeText(
          buildAiPrompt(message.toolName, message.description)
        );
        void vscode.window.showInformationMessage("AI prompt copied to clipboard.");
        break;

      case "clearLogs":
        this.manager.logs.clear();
        await this.pushState("Logs cleared.");
        break;

      case "checkForUpdate":
        await this.pushState(undefined, true);
        try {
          await this.updateService.checkForUpdates({ force: true, suggestUpgrade: false });
          await this.pushState();
        } catch (err) {
          const text = err instanceof Error ? err.message : String(err);
          await this.pushState(text);
        }
        break;

      case "toggleAutoConnect":
        await vscode.workspace
          .getConfiguration("ctMcp")
          .update("autoConnectOnStartup", message.enabled, vscode.ConfigurationTarget.Global);
        await this.pushState();
        break;

      case "toggleAutoUpdate":
        await this.updateService.setAutoUpdateEnabled(message.enabled);
        await this.pushState();
        break;

      case "installUpdate":
        await this.pushState(undefined, true);
        try {
          await this.updateService.installUpdate();
          await this.pushState();
        } catch (err) {
          const text = err instanceof Error ? err.message : String(err);
          await this.pushState(text);
        }
        break;

      case "reloadWindow":
        await this.updateService.reloadWindow();
        break;

      case "openCopilotAgent":
        await openCopilotAgentChat(COPILOT_AGENT_EXAMPLE_PROMPT);
        break;
    }
  }
}

export function renderStudioHtml(options: {
  logoUri?: string;
  cspSource?: string;
} = {}): string {
  const nonce = String(Date.now());
  const imgSrc = options.cspSource ?? "'none'";
  const logoHtml = options.logoUri
    ? `<img class="logo" src="${options.logoUri}" alt="Commerce MCP" />`
    : `<div class="logo-fallback">MCP</div>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${imgSrc}; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Commerce MCP Studio</title>
  <style>
    :root {
      color: var(--vscode-foreground);
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      background: var(--vscode-sideBar-background, var(--vscode-editor-background));
    }
    * { box-sizing: border-box; }
    body { margin: 0; padding: 12px; }
    .studio-header {
      margin-bottom: 12px;
      padding-bottom: 10px;
      border-bottom: 1px solid var(--vscode-widget-border, rgba(128,128,128,.25));
    }
    .header-row {
      display: flex;
      align-items: flex-start;
      gap: 10px;
    }
    .header-content { flex: 1; min-width: 0; }
    .header-title-row {
      display: flex;
      align-items: baseline;
      gap: 6px;
      min-width: 0;
    }
    .hero { text-align: left; margin-bottom: 0; }
    .logo { width: 48px; height: 48px; object-fit: contain; flex-shrink: 0; }
    .logo-fallback {
      width: 48px; height: 48px;
      display: grid; place-items: center;
      border-radius: 8px; background: rgba(128,128,128,0.15);
      font-weight: 700; flex-shrink: 0;
    }
    h1 { margin: 0; font-size: 14px; font-weight: 600; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .header-version {
      font-size: 11px;
      font-weight: 600;
      opacity: 0.7;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      flex: 1 1 auto;
      min-width: 0;
    }
    .header-update {
      display: flex;
      flex-direction: row;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
      margin-top: 8px;
    }
    .header-update-btn {
      font-size: 11px;
      line-height: 1.2;
      padding: 5px 10px;
      min-width: 148px;
      white-space: nowrap;
    }
    .header-auto-update {
      font-size: 11px;
      opacity: 0.85;
      user-select: none;
      white-space: nowrap;
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }
    .header-auto-update input { width: auto; margin: 0; }
    .update-detail {
      margin: 6px 0 0;
      font-size: 11px;
      opacity: 0.85;
      color: var(--vscode-descriptionForeground);
    }
    .update-detail.error { color: #ef4444; opacity: 1; }
    .update-progress {
      height: 4px;
      margin: 6px 0 0;
      border-radius: 2px;
      overflow: hidden;
      background: var(--vscode-progressBar-background, rgba(128,128,128,.25));
    }
    .update-progress-fill {
      height: 100%;
      width: 0%;
      border-radius: 2px;
      background: var(--vscode-progressBar-foreground, var(--vscode-button-background));
      transition: width 0.15s ease-out;
    }
    .update-notes {
      margin: 6px 0 0;
      padding-left: 18px;
      font-size: 11px;
      opacity: 0.8;
    }
    .subtitle { margin: 2px 0 0; color: var(--vscode-descriptionForeground); font-size: 11px; }
    .tabs { display: flex; gap: 4px; flex-wrap: wrap; margin: 12px 0; }
    .tab, button {
      border: 1px solid var(--vscode-button-border, transparent);
      background: var(--vscode-button-secondaryBackground, rgba(128,128,128,0.12));
      color: var(--vscode-button-secondaryForeground, inherit);
      border-radius: 6px;
      padding: 6px 10px;
      font: inherit;
      cursor: pointer;
    }
    .tab.active {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
    }
    .panel { display: none; }
    .panel.active { display: block; }
    .card {
      border: 1px solid var(--vscode-widget-border, rgba(128,128,128,.25));
      border-radius: 8px;
      padding: 10px;
      margin-bottom: 10px;
      background: var(--vscode-editor-background);
    }
    .row { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 8px; }
    .field { margin-bottom: 8px; }
    label { display: block; font-size: 11px; color: var(--vscode-descriptionForeground); margin-bottom: 4px; }
    input, textarea, select {
      width: 100%;
      padding: 6px 8px;
      border-radius: 6px;
      border: 1px solid var(--vscode-input-border, rgba(128,128,128,.45));
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      font: inherit;
    }
    .status { font-size: 11px; margin: 8px 0; }
    .status.ok { color: #22c55e; }
    .status.bad { color: #ef4444; }
    .connection-banner {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      padding: 12px;
      border-radius: 8px;
      margin-bottom: 12px;
      border: 1px solid var(--vscode-widget-border, rgba(128,128,128,.25));
    }
    .connection-banner.disconnected {
      background: rgba(148,163,184,.08);
      border-color: rgba(148,163,184,.35);
    }
    .connection-banner.ready {
      background: rgba(245,158,11,.08);
      border-color: rgba(245,158,11,.35);
    }
    .connection-banner.connecting {
      background: rgba(59,130,246,.08);
      border-color: rgba(59,130,246,.35);
    }
    .connection-banner.connected {
      background: rgba(34,197,94,.1);
      border-color: rgba(34,197,94,.45);
    }
    .connection-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      margin-top: 4px;
      flex-shrink: 0;
    }
    .connection-banner.disconnected .connection-dot { background: #94a3b8; }
    .connection-banner.ready .connection-dot { background: #f59e0b; }
    .connection-banner.connecting .connection-dot {
      background: #3b82f6;
      animation: connection-pulse 1.2s ease-in-out infinite;
    }
    .connection-banner.connected .connection-dot {
      background: #22c55e;
      box-shadow: 0 0 0 3px rgba(34,197,94,.22);
    }
    @keyframes connection-pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.55; transform: scale(0.92); }
    }
    .connection-banner-text { min-width: 0; flex: 1; }
    .connection-banner-title {
      font-size: 13px;
      font-weight: 700;
      line-height: 1.3;
    }
    .connection-banner-subtitle {
      margin-top: 2px;
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
      line-height: 1.45;
    }
    .connection-details {
      border: 1px solid var(--vscode-widget-border, rgba(128,128,128,.25));
      border-radius: 8px;
      padding: 10px;
      margin-bottom: 12px;
      background: var(--vscode-editor-background);
    }
    .connection-details-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      margin-bottom: 8px;
    }
    .connection-details-label {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--vscode-descriptionForeground);
    }
    .connection-scope-badge {
      font-size: 9px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.03em;
      padding: 2px 7px;
      border-radius: 999px;
      color: #22c55e;
      background: rgba(34,197,94,.15);
    }
    .connection-props {
      display: grid;
      gap: 6px;
      margin: 0;
    }
    .connection-prop {
      display: grid;
      grid-template-columns: 92px 1fr;
      gap: 8px;
      font-size: 11px;
      align-items: start;
    }
    .connection-prop dt {
      margin: 0;
      color: var(--vscode-descriptionForeground);
    }
    .connection-prop dd {
      margin: 0;
      word-break: break-all;
      font-family: var(--vscode-editor-font-family, monospace);
      font-size: 10px;
      line-height: 1.45;
    }
    .connection-health-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 6px;
      margin-bottom: 12px;
    }
    .health-chip {
      font-size: 10px;
      padding: 6px 8px;
      border-radius: 6px;
      background: rgba(128,128,128,.08);
      display: flex;
      align-items: center;
      gap: 5px;
      line-height: 1.3;
    }
    .health-chip.ok { color: #22c55e; }
    .health-chip.bad { color: #ef4444; }
    .connection-pref {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 11px;
      margin: 0 0 12px;
      opacity: 0.92;
      user-select: none;
    }
    .connection-pref input { width: auto; margin: 0; }
    .connection-env-hint {
      border: 1px solid var(--vscode-widget-border, rgba(128,128,128,.25));
      border-radius: 8px;
      padding: 10px;
      margin-bottom: 12px;
      background: var(--vscode-editor-background);
    }
    .connection-env-hint-title {
      font-size: 11px;
      font-weight: 600;
      margin: 0 0 6px;
    }
    .connection-env-hint-desc {
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
      margin: 0 0 8px;
      line-height: 1.45;
    }
    .connection-env-example {
      margin: 0;
      padding: 8px;
      border-radius: 6px;
      font-family: var(--vscode-editor-font-family, monospace);
      font-size: 10px;
      line-height: 1.5;
      white-space: pre-wrap;
      word-break: break-word;
      background: rgba(128,128,128,.08);
      color: var(--vscode-foreground);
      overflow-x: auto;
    }
    .connection-copilot-hint {
      border: 1px solid rgba(59,130,246,.35);
      border-radius: 8px;
      padding: 10px;
      margin-bottom: 12px;
      background: rgba(59,130,246,.08);
    }
    .connection-copilot-hint-title {
      font-size: 11px;
      font-weight: 600;
      margin: 0 0 6px;
    }
    .connection-copilot-hint-desc {
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
      margin: 0 0 10px;
      line-height: 1.45;
    }
    .connection-copilot-actions {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
    }
    .connection-copilot-actions button {
      font-size: 11px;
    }
    .connection-actions { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 8px; }
    button.primary {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      font-weight: 600;
    }
    button.primary:disabled {
      opacity: 0.55;
      cursor: not-allowed;
    }
    .health { font-size: 11px; line-height: 1.6; }
    .conn-item {
      border: 1px solid var(--vscode-widget-border, rgba(128,128,128,.2));
      border-radius: 8px;
      padding: 8px;
      margin-bottom: 8px;
      cursor: pointer;
    }
    .conn-item.active { border-color: rgba(37,99,235,.55); background: rgba(37,99,235,.08); }
    .conn-item.connected {
      border-color: rgba(34,197,94,.55);
      background: rgba(34,197,94,.08);
    }
    .conn-item.connected.active {
      border-color: rgba(34,197,94,.65);
      background: linear-gradient(135deg, rgba(34,197,94,.1), rgba(37,99,235,.06));
    }
    .conn-name { font-weight: 600; }
    .conn-badge {
      display: inline-block;
      margin-left: 6px;
      padding: 1px 6px;
      border-radius: 999px;
      font-size: 9px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.03em;
      color: #22c55e;
      background: rgba(34,197,94,.15);
    }
    button.disconnect-btn {
      background: rgba(239,68,68,.15);
      color: #ef4444;
      border-color: rgba(239,68,68,.35);
    }
    .conn-meta { font-size: 10px; color: var(--vscode-descriptionForeground); }
    .tool-group { margin-bottom: 10px; }
    .tool-group-title {
      font-size: 11px; font-weight: 700; text-transform: capitalize;
      margin-bottom: 4px; color: var(--vscode-descriptionForeground);
    }
    .tool-link {
      display: block; width: 100%; text-align: left;
      margin-bottom: 4px; padding: 6px 8px;
      border-radius: 6px; border: 1px solid transparent;
      background: transparent; color: inherit; cursor: pointer; font: inherit;
    }
    .tool-link:hover { background: rgba(128,128,128,.08); }
    .tool-name { font-family: var(--vscode-editor-font-family, monospace); font-size: 11px; }
    .log-item { font-size: 11px; padding: 4px 0; border-bottom: 1px solid rgba(128,128,128,.12); }
    .diag-list {
      margin-top: 8px;
      max-height: 180px;
      overflow: auto;
      border-top: 1px solid rgba(128,128,128,.12);
      padding-top: 4px;
    }
    .log-time { color: var(--vscode-descriptionForeground); margin-right: 6px; }
    .log-error { color: #ef4444; }
    .log-success { color: #22c55e; }
    .template-item { margin-bottom: 8px; }
    .template-title { font-weight: 600; font-size: 12px; }
    .template-desc { font-size: 11px; color: var(--vscode-descriptionForeground); }
    .error { color: #ef4444; font-size: 11px; margin: 8px 0; white-space: pre-wrap; }
    .hidden { display: none; }
    .identity-summary {
      font-size: 11px;
      margin-bottom: 10px;
      padding: 8px;
      border-radius: 6px;
      background: rgba(128,128,128,.08);
      color: var(--vscode-descriptionForeground);
    }
    .identity-summary strong { color: var(--vscode-foreground); }
  </style>
</head>
<body>
  <header class="studio-header">
    <div class="header-row">
      ${logoHtml}
      <div class="header-content">
        <div class="header-title-row">
          <h1>Commerce MCP</h1>
          <span id="updateLabel" class="header-version">v—</span>
        </div>
        <p class="subtitle">Explore and test commercetools MCP using workspace credentials</p>
      </div>
    </div>
    <div id="updatePanel" class="header-update">
      <button id="updateActionBtn" type="button" class="header-update-btn">Check for updates</button>
      <label class="header-auto-update">
        <input type="checkbox" id="autoUpdate" checked />
        Auto-check for updates
      </label>
    </div>
    <p id="updateDetail" class="update-detail hidden"></p>
    <div id="updateProgressBar" class="update-progress hidden" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
      <div id="updateProgressFill" class="update-progress-fill"></div>
    </div>
    <ul id="updateNotes" class="update-notes hidden"></ul>
  </header>

  <div class="tabs">
    <button class="tab active" data-tab="connections">Connections</button>
    <button class="tab" data-tab="tools">Tools</button>
    <button class="tab" data-tab="logs">Logs</button>
    <button class="tab" data-tab="templates">Templates</button>
  </div>

  <div id="error" class="error hidden"></div>
  <div id="busy" class="status hidden">Working…</div>

  <section id="panel-connections" class="panel active">
    <div id="connection-banner" class="connection-banner disconnected" role="status" aria-live="polite">
      <span class="connection-dot" aria-hidden="true"></span>
      <div class="connection-banner-text">
        <div id="connection-banner-title" class="connection-banner-title">Not connected</div>
        <div id="connection-banner-subtitle" class="connection-banner-subtitle">Scanning workspace credentials…</div>
      </div>
    </div>

    <div id="connection-env-hint" class="connection-env-hint hidden">
      <p class="connection-env-hint-title">Example workspace <code>.env</code></p>
      <p class="connection-env-hint-desc">
        Create <code>.env</code> in your project root. You can also use
        <code>.env.local</code>, <code>.env.mcp</code>, or split values across multiple files.
        Supported prefixes: <code>CTP_*</code>, <code>CTOOLS_*</code>, <code>COMM_TOOLS_*</code>, <code>CT_MCP_*</code>.
      </p>
      <pre class="connection-env-example"># .env
CTP_PROJECT_KEY=my-project-key
CTP_CLIENT_ID=your-client-id
CTP_CLIENT_SECRET=your-client-secret
CTP_AUTH_URL=https://auth.europe-west1.gcp.commercetools.com
CTP_API_URL=https://api.europe-west1.gcp.commercetools.com

# Optional
CT_MCP_CONNECTION_NAME=my-commercetools-project</pre>
    </div>

    <div id="connection-details" class="connection-details hidden">
      <div class="connection-details-header">
        <span class="connection-details-label">Active profile</span>
        <span id="connection-scope-badge" class="connection-scope-badge hidden">Admin</span>
      </div>
      <dl class="connection-props" id="connection-props"></dl>
    </div>

    <div id="connection-health" class="connection-health-grid hidden"></div>

    <div id="connection-copilot-hint" class="connection-copilot-hint hidden">
      <p class="connection-copilot-hint-title">Use with Copilot Agent</p>
      <p class="connection-copilot-hint-desc">
        Open <strong>Copilot Chat → Agent mode</strong> and enable
        <code>commerce-mcp</code>, <code>commerceMcpTools</code>, or <code>commerceMcpCall</code>
        in the tools picker. Then ask Copilot to run commercetools operations through MCP.
      </p>
      <div class="connection-copilot-actions">
        <button id="btn-open-copilot" class="primary" type="button">Ask Copilot to list products</button>
        <button id="btn-copy-copilot-prompt" type="button">Copy example prompt</button>
      </div>
    </div>

    <label class="connection-pref">
      <input type="checkbox" id="autoConnect" />
      Auto-connect on startup
    </label>

    <div class="connection-actions">
      <button id="btn-connect" class="primary">Connect</button>
      <button id="btn-disconnect" class="secondary disconnect-btn">Disconnect</button>
      <button id="btn-refresh">Refresh</button>
    </div>
    <div class="row">
      <button id="btn-navigator">Navigate</button>
      <button id="btn-explorer">Explorer</button>
    </div>
    <p class="subtitle" style="margin-top:6px;">Credentials are read from workspace <code>.env</code> (<code>CTP_*</code>, <code>CTOOLS_*</code>, <code>COMM_TOOLS_*</code>, <code>CT_MCP_*</code>).</p>
    <div class="subtitle" style="margin-top:8px;">Connection diagnostics (latest)</div>
    <div id="connect-diagnostics" class="diag-list"></div>
  </section>

  <section id="panel-tools" class="panel">
    <div class="card">
      <strong>MCP Tools</strong>
      <p class="subtitle">Loaded dynamically from Commerce MCP via tools/list.</p>
      <div id="tools-tree"></div>
    </div>
  </section>

  <section id="panel-logs" class="panel">
    <div class="card">
      <div class="row">
        <strong>Commerce MCP Logs</strong>
        <button id="btn-clear-logs">Clear</button>
      </div>
      <div id="logs-list"></div>
    </div>
  </section>

  <section id="panel-templates" class="panel">
    <div class="card">
      <strong>Prompt Templates</strong>
      <div id="templates-list"></div>
    </div>
  </section>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    let state = {};

    function formatUpdateProgressLabel(phase, progress) {
      const pct = Math.max(0, Math.min(100, Math.round(Number(progress) || 0)));
      return phase === 'downloading'
        ? 'Downloading update… ' + pct + '%'
        : 'Installing update… ' + pct + '%';
    }

    function renderUpdatePanel(next) {
      const updateLabel = document.getElementById('updateLabel');
      const updateActionBtn = document.getElementById('updateActionBtn');
      const autoUpdateEl = document.getElementById('autoUpdate');
      const updateDetailEl = document.getElementById('updateDetail');
      const updateProgressBarEl = document.getElementById('updateProgressBar');
      const updateProgressFillEl = document.getElementById('updateProgressFill');
      const updateNotesEl = document.getElementById('updateNotes');

      const currentVersion = next.currentVersion || '0.0.0';
      const latestVersion = next.latestVersion || '';
      const updateAvailable = next.updateAvailable === true;
      const updatePhase = next.updatePhase || 'idle';
      const updateProgress = typeof next.updateProgress === 'number'
        ? Math.max(0, Math.min(100, next.updateProgress))
        : undefined;
      const updateBusy = updatePhase === 'checking' || updatePhase === 'downloading' || updatePhase === 'installing';
      const notes = Array.isArray(next.updateNotes) ? next.updateNotes : [];
      const showProgressBar = (updatePhase === 'downloading' || updatePhase === 'installing') && updateProgress != null;

      let versionText = 'v' + currentVersion;
      if (updateAvailable && latestVersion && updatePhase !== 'installed') {
        versionText += ' → v' + latestVersion;
      } else if (updatePhase === 'installed' && latestVersion) {
        versionText += ' → v' + latestVersion;
      } else if (updatePhase === 'checking') {
        versionText += ' · checking…';
      } else if ((updatePhase === 'downloading' || updatePhase === 'installing') && updateProgress != null) {
        versionText += ' · ' + updateProgress + '%';
      }
      if (updateLabel) updateLabel.textContent = versionText;

      if (autoUpdateEl) autoUpdateEl.checked = next.autoUpdateExtension !== false;

      if (updateActionBtn) {
        updateActionBtn.disabled = updateBusy;
        if (updatePhase === 'installed') {
          updateActionBtn.textContent = 'Reload window';
          updateActionBtn.disabled = false;
        } else if (updatePhase === 'checking') {
          updateActionBtn.textContent = 'Checking for updates…';
        } else if (updatePhase === 'downloading' || updatePhase === 'installing') {
          updateActionBtn.textContent = formatUpdateProgressLabel(updatePhase, updateProgress || 0);
        } else if (updateAvailable) {
          updateActionBtn.textContent = 'Install update now';
        } else {
          updateActionBtn.textContent = 'Check for updates';
        }
      }

      if (updateDetailEl) {
        updateDetailEl.classList.remove('error');
        if (next.updateError) {
          updateDetailEl.classList.remove('hidden');
          updateDetailEl.classList.add('error');
          updateDetailEl.textContent = next.updateError;
        } else if (updatePhase === 'installed' && latestVersion) {
          updateDetailEl.classList.remove('hidden');
          updateDetailEl.textContent = 'Updated to v' + latestVersion + '. Reload VS Code to finish.';
        } else if (updatePhase === 'downloading') {
          updateDetailEl.classList.remove('hidden');
          updateDetailEl.textContent = 'Downloading extension package…';
        } else if (updatePhase === 'installing') {
          updateDetailEl.classList.remove('hidden');
          updateDetailEl.textContent = 'Installing extension package…';
        } else if (updateAvailable) {
          updateDetailEl.classList.remove('hidden');
          updateDetailEl.textContent = 'A newer version is available from the CT MCP registry.';
        } else if (updatePhase === 'checking') {
          updateDetailEl.classList.remove('hidden');
          updateDetailEl.textContent = 'Checking registry for updates…';
        } else {
          updateDetailEl.classList.add('hidden');
          updateDetailEl.textContent = '';
        }
      }

      if (updateProgressBarEl && updateProgressFillEl) {
        updateProgressBarEl.classList.toggle('hidden', !showProgressBar);
        if (showProgressBar) {
          updateProgressFillEl.style.width = updateProgress + '%';
          updateProgressBarEl.setAttribute('aria-valuenow', String(updateProgress));
        } else {
          updateProgressFillEl.style.width = '0%';
        }
      }

      if (updateNotesEl) {
        if (updateAvailable && notes.length && updatePhase !== 'installed') {
          updateNotesEl.classList.remove('hidden');
          updateNotesEl.innerHTML = notes.map(function (note) {
            return '<li>' + note.replace(/</g, '&lt;') + '</li>';
          }).join('');
        } else {
          updateNotesEl.classList.add('hidden');
          updateNotesEl.innerHTML = '';
        }
      }
    }

    function setTab(tab) {
      document.querySelectorAll('.tab').forEach(el => {
        el.classList.toggle('active', el.dataset.tab === tab);
      });
      document.querySelectorAll('.panel').forEach(el => {
        el.classList.toggle('active', el.id === 'panel-' + tab);
      });
      vscode.postMessage({ type: 'switchTab', tab });
    }

    document.querySelectorAll('.tab').forEach(el => {
      el.addEventListener('click', () => setTab(el.dataset.tab));
    });

    document.getElementById('btn-refresh').addEventListener('click', () => {
      vscode.postMessage({ type: 'refresh' });
    });
    document.getElementById('btn-connect').addEventListener('click', () => {
      vscode.postMessage({ type: 'connectFromWorkspace' });
    });
    document.getElementById('btn-disconnect').addEventListener('click', () => {
      vscode.postMessage({ type: 'disconnect' });
    });
    document.getElementById('btn-navigator').addEventListener('click', () => {
      vscode.postMessage({ type: 'openNavigator' });
    });
    document.getElementById('btn-explorer').addEventListener('click', () => {
      vscode.postMessage({ type: 'openExplorer' });
    });
    document.getElementById('btn-open-copilot').addEventListener('click', () => {
      vscode.postMessage({ type: 'openCopilotAgent' });
    });
    document.getElementById('btn-copy-copilot-prompt').addEventListener('click', () => {
      vscode.postMessage({
        type: 'copyChatPrompt',
        text: 'List commercetools products using Commerce MCP',
        agentContext: true
      });
    });
    document.getElementById('btn-clear-logs').addEventListener('click', () => {
      vscode.postMessage({ type: 'clearLogs' });
    });
    document.getElementById('updateActionBtn').addEventListener('click', () => {
      if (state.updatePhase === 'installed') {
        vscode.postMessage({ type: 'reloadWindow' });
        return;
      }
      if (state.updateAvailable === true) {
        vscode.postMessage({ type: 'installUpdate' });
        return;
      }
      vscode.postMessage({ type: 'checkForUpdate' });
    });
    document.getElementById('autoUpdate').addEventListener('change', (event) => {
      const target = event.target;
      vscode.postMessage({ type: 'toggleAutoUpdate', enabled: target.checked });
    });
    document.getElementById('autoConnect').addEventListener('change', (event) => {
      const target = event.target;
      vscode.postMessage({ type: 'toggleAutoConnect', enabled: target.checked });
    });

    function escapeHtml(value) {
      return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    }

    function maskClientId(clientId) {
      if (!clientId) return '—';
      if (clientId.length <= 10) return clientId;
      return clientId.slice(0, 4) + '…' + clientId.slice(-4);
    }

    function resolveConnectionProfile(next) {
      if (!next.hasWorkspaceEnvFiles || !next.workspaceCredentials) {
        return undefined;
      }
      const creds = next.workspaceCredentials;
      const conn = next.activeConnection;
      return {
        name: conn?.name || creds.name,
        projectKey: creds.projectKey,
        clientId: creds.clientId,
        authUrl: creds.authUrl,
        apiUrl: creds.apiUrl,
        isAdmin: creds.isAdmin,
        source: creds.source,
      };
    }

    function connectionBannerLabel(next) {
      const profile = resolveConnectionProfile(next);
      if (profile) {
        return profile.name + ' · ' + profile.projectKey;
      }
      const conn = next.activeConnection;
      if (conn) {
        return conn.name + ' · ' + conn.projectKey;
      }
      return 'Commerce MCP';
    }

    function renderConnectionHealth(health) {
      const el = document.getElementById('connection-health');
      if (!health) {
        el.classList.add('hidden');
        el.innerHTML = '';
        return;
      }
      const chips = [
        { ok: health.mcpRunning, label: health.mcpRunning ? 'MCP running' : 'MCP not running' },
        { ok: health.authValid, label: health.authValid ? 'Auth valid' : 'Auth invalid' },
        { ok: health.apiReachable, label: health.apiReachable ? 'API reachable' : 'API unreachable' },
        { ok: (health.toolsLoaded || 0) > 0, label: (health.toolsLoaded || 0) + ' tools loaded' },
      ];
      el.classList.remove('hidden');
      el.innerHTML = chips.map(function (chip) {
        return '<div class="health-chip ' + (chip.ok ? 'ok' : 'bad') + '">' +
          '<span aria-hidden="true">' + (chip.ok ? '✓' : '✗') + '</span>' +
          '<span>' + chip.label + '</span>' +
          '</div>';
      }).join('');
    }

    function renderConnectionPanel(next) {
      const banner = document.getElementById('connection-banner');
      const title = document.getElementById('connection-banner-title');
      const subtitle = document.getElementById('connection-banner-subtitle');
      const details = document.getElementById('connection-details');
      const props = document.getElementById('connection-props');
      const scopeBadge = document.getElementById('connection-scope-badge');
      const connectBtn = document.getElementById('btn-connect');
      const disconnectBtn = document.getElementById('btn-disconnect');
      const refreshBtn = document.getElementById('btn-refresh');
      const autoConnectEl = document.getElementById('autoConnect');
      const envHint = document.getElementById('connection-env-hint');
      const copilotHint = document.getElementById('connection-copilot-hint');

      const profile = resolveConnectionProfile(next);
      const canConnect = next.hasWorkspaceEnvFiles && next.workspaceCredentials;
      const connected = next.connected === true;
      const busy = next.busy === true;
      const health = next.health;

      banner.className = 'connection-banner';
      if (busy) {
        banner.classList.add('connecting');
        title.textContent = 'Connecting…';
        subtitle.textContent = profile
          ? 'Starting Commerce MCP for ' + profile.name + ' · ' + profile.projectKey
          : 'Starting Commerce MCP server…';
      } else if (connected) {
        banner.classList.add('connected');
        title.textContent = 'Connected';
        subtitle.textContent = connectionBannerLabel(next) +
          ' · ' + (health && health.toolsLoaded != null ? health.toolsLoaded : 0) + ' tools loaded';
      } else if (profile) {
        banner.classList.add('ready');
        title.textContent = 'Ready to connect';
        subtitle.textContent = 'Click Connect to start ' + profile.name + ' (' + profile.projectKey + ')';
      } else if (next.hasWorkspaceEnvFiles) {
        banner.classList.add('disconnected');
        title.textContent = 'Incomplete credentials';
        subtitle.textContent = 'Add project key and client credentials to ' +
          (next.workspaceEnvSources || []).join(', ');
      } else {
        banner.classList.add('disconnected');
        title.textContent = 'No .env files';
        subtitle.textContent = 'Create a workspace .env file with commercetools credentials (see example below)';
      }

      if (envHint) {
        const showEnvHint = !next.hasWorkspaceEnvFiles && !connected && !busy;
        envHint.classList.toggle('hidden', !showEnvHint);
      }

      if (copilotHint) {
        copilotHint.classList.toggle('hidden', !connected || busy);
      }

      if (profile) {
        details.classList.remove('hidden');
        scopeBadge.textContent = profile.isAdmin ? 'Admin client' : 'Standard client';
        scopeBadge.classList.remove('hidden');
        scopeBadge.style.color = profile.isAdmin ? '#22c55e' : 'var(--vscode-descriptionForeground)';
        scopeBadge.style.background = profile.isAdmin ? 'rgba(34,197,94,.15)' : 'rgba(128,128,128,.12)';
        const rows = [
          ['Connection', profile.name],
          ['Project key', profile.projectKey],
          ['Client ID', maskClientId(profile.clientId)],
          ['Auth URL', profile.authUrl || '—'],
          ['API URL', profile.apiUrl || '—'],
          ['Credentials', profile.source ? profile.source : '—'],
          ['Status', connected ? 'Connected' : (busy ? 'Connecting…' : 'Disconnected')],
        ];
        if (connected && health && health.toolsLoaded != null) {
          rows.push(['Tools', String(health.toolsLoaded) + ' loaded']);
        }
        props.innerHTML = rows.map(function (row) {
          return '<div class="connection-prop"><dt>' + escapeHtml(row[0]) + '</dt><dd>' + escapeHtml(row[1]) + '</dd></div>';
        }).join('');
      } else {
        details.classList.add('hidden');
        props.innerHTML = '';
        scopeBadge.classList.add('hidden');
      }

      renderConnectionHealth(connected ? health : undefined);

      connectBtn.disabled = !canConnect || connected || busy;
      disconnectBtn.disabled = !connected || busy;
      refreshBtn.disabled = busy;
      connectBtn.textContent = busy ? 'Connecting…' : 'Connect';
      connectBtn.classList.toggle('hidden', connected && !busy);
      disconnectBtn.classList.toggle('hidden', !connected);
      if (autoConnectEl) {
        autoConnectEl.checked = next.autoConnectOnStartup === true;
      }
    }

    function renderTools(groups) {
      const el = document.getElementById('tools-tree');
      if (!groups.length) {
        el.innerHTML = '<p class="subtitle">Connect to load tools.</p>';
        return;
      }
      el.innerHTML = groups.map(group => \`
        <div class="tool-group">
          <div class="tool-group-title">\${group.category}</div>
          \${group.tools.map(tool => \`
            <button class="tool-link" data-tool="\${tool.name}">
              <div class="tool-name">\${tool.name}</div>
              <div class="subtitle">\${tool.description || ''}</div>
            </button>
          \`).join('')}
        </div>
      \`).join('');
      el.querySelectorAll('[data-tool]').forEach(btn => {
        btn.addEventListener('click', () => {
          vscode.postMessage({ type: 'openExplorer', toolName: btn.dataset.tool });
        });
      });
    }

    function renderLogs(logs) {
      const el = document.getElementById('logs-list');
      if (!logs.length) {
        el.innerHTML = '<p class="subtitle">No log entries yet.</p>';
        return;
      }
      el.innerHTML = logs.map(log => \`
        <div class="log-item \${log.level === 'error' ? 'log-error' : log.level === 'success' ? 'log-success' : ''}">
          <span class="log-time">[\${log.time}]</span>
          \${log.toolName ? '<span>' + log.toolName + '</span> ' : ''}
          \${log.message}
        </div>
      \`).join('');
    }

    function renderTemplates(templates) {
      const el = document.getElementById('templates-list');
      el.innerHTML = templates.map(item => \`
        <div class="template-item">
          <div class="template-title">\${item.title}</div>
          <div class="template-desc">\${item.description}</div>
          <div class="row">
            <button data-chat="\${item.prompt.replace(/"/g, '&quot;')}">Use in Chat</button>
            <button data-ai-tool="\${item.toolName}" data-ai-desc="\${item.description.replace(/"/g, '&quot;')}">Generate AI Prompt</button>
            <button data-explorer="\${item.toolName}">Open Tool</button>
          </div>
        </div>
      \`).join('');
      el.querySelectorAll('[data-chat]').forEach(btn => {
        btn.addEventListener('click', () => vscode.postMessage({
          type: 'copyChatPrompt',
          text: btn.dataset.chat,
          agentContext: true
        }));
      });
      el.querySelectorAll('[data-ai-tool]').forEach(btn => {
        btn.addEventListener('click', () => vscode.postMessage({
          type: 'copyAiPrompt',
          toolName: btn.dataset.aiTool,
          description: btn.dataset.aiDesc
        }));
      });
      el.querySelectorAll('[data-explorer]').forEach(btn => {
        btn.addEventListener('click', () => vscode.postMessage({ type: 'openExplorer', toolName: btn.dataset.explorer }));
      });
    }

    function renderConnectDiagnostics(logs) {
      const el = document.getElementById('connect-diagnostics');
      if (!logs.length) {
        el.innerHTML = '<p class="subtitle">No connection diagnostics yet.</p>';
        return;
      }
      el.innerHTML = logs.map(log => {
        const levelClass = log.level === 'error' ? 'log-error' : (log.level === 'success' ? 'log-success' : '');
        return '<div class="log-item ' + levelClass + '">' +
          '<span class="log-time">[' + log.time + ']</span>' + log.message +
          '</div>';
      }).join('');
    }

    function applyState(next) {
      state = next;
      renderConnectionPanel(next);
      renderTools(next.toolGroups || []);
      renderLogs(next.logs || []);
      renderConnectDiagnostics(next.connectDiagnostics || []);
      renderTemplates(next.templates || []);
      renderUpdatePanel(next);

      const errorEl = document.getElementById('error');
      if (next.error) {
        errorEl.textContent = next.error;
        errorEl.classList.remove('hidden');
      } else {
        errorEl.classList.add('hidden');
      }

      document.getElementById('busy').classList.toggle('hidden', !next.busy);

      if (next.activeTab) {
        document.querySelectorAll('.tab').forEach(el => {
          el.classList.toggle('active', el.dataset.tab === next.activeTab);
        });
        document.querySelectorAll('.panel').forEach(el => {
          el.classList.toggle('active', el.id === 'panel-' + next.activeTab);
        });
      }
    }

    window.addEventListener('message', (event) => {
      const message = event.data;
      if (message.type === 'state') applyState(message);
    });

    vscode.postMessage({ type: 'ready' });
  </script>
</body>
</html>`;
}
