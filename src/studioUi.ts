import * as vscode from "vscode";
import { formatLogTimestamp } from "./logStore";
import { buildAiPrompt, buildChatPrompt } from "./mcpBootstrap";
import { buildProductSearchChatPrompt } from "./mcpChatContext";
import { CommerceMcpManager } from "./mcpManager";
import { openProjectMcpFiles } from "./projectMcpInit";
import { groupToolsByCategory } from "./toolCatalog";
import { PROMPT_TEMPLATES } from "./templates";
import { ConnectionHealth, LogEntry, MCPConnection } from "./types";
import { ExtensionUpdateState, UpdateService } from "./updateService";

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
    source: string;
    authUrl: string;
    apiUrl: string;
    isAdmin: boolean;
  };
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
  | { type: "initProjectMcp" }
  | { type: "checkForUpdate" }
  | { type: "toggleAutoUpdate"; enabled: boolean }
  | { type: "installUpdate" }
  | { type: "reloadWindow" }
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
            source: workspaceCredentials.source,
            authUrl: workspaceCredentials.authUrl,
            apiUrl: workspaceCredentials.apiUrl,
            isAdmin: workspaceCredentials.isAdmin,
          }
        : undefined,
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

      case "initProjectMcp":
        await this.pushState(undefined, true);
        try {
          const result = await this.manager.initProjectMcpContext(this.context.extensionPath);
          const action = await vscode.window.showInformationMessage(
            `Project MCP initialized for ${result.connectionName} · ${result.projectKey}.`,
            "Open .env.mcp"
          );
          if (action === "Open .env.mcp") {
            await openProjectMcpFiles(result);
          }
          await this.pushState(
            `Created ${result.files.length} file(s): ${result.files.join(", ")}`
          );
        } catch (err) {
          const text = err instanceof Error ? err.message : String(err);
          await this.pushState(text);
        }
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
    <div class="card">
      <div class="status" id="connection-status">Not connected</div>
      <div class="health" id="health"></div>
      <div id="workspace-env-status" class="subtitle" style="margin-top:8px;">Scanning workspace .env files…</div>
      <div class="row" style="margin-top:8px;">
        <button id="btn-connect">Connect</button>
        <button id="btn-disconnect" class="secondary disconnect-btn">Disconnect</button>
        <button id="btn-refresh">Refresh</button>
      </div>
      <div class="row">
        <button id="btn-navigator">Navigate</button>
        <button id="btn-explorer">Explorer</button>
        <button id="btn-init-project" class="secondary">Init Project MCP</button>
      </div>
      <p class="subtitle" style="margin-top:6px;">Credentials are read from workspace <code>.env</code> (<code>CTP_*</code>, <code>CTOOLS_*</code>, <code>COMM_TOOLS_*</code>, <code>CT_MCP_*</code>). Init writes <code>.cursor/mcp.json</code> and <code>.env.mcp</code>.</p>
      <div class="subtitle" style="margin-top:8px;">Connection diagnostics (latest)</div>
      <div id="connect-diagnostics" class="diag-list"></div>
    </div>
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

    function applyWorkspaceCredentials(workspaceCredentials, connected) {
      const status = document.getElementById('workspace-env-status');
      const connectBtn = document.getElementById('btn-connect');
      const disconnectBtn = document.getElementById('btn-disconnect');
      if (!workspaceCredentials) {
        status.textContent = 'No commercetools credentials found in workspace .env files.';
        connectBtn.disabled = true;
        disconnectBtn.disabled = true;
        return;
      }
      status.innerHTML =
        'Credentials from <code>' + workspaceCredentials.source + '</code> · ' +
        workspaceCredentials.projectKey +
        (workspaceCredentials.isAdmin ? ' · admin client' : '');
      connectBtn.disabled = connected;
      disconnectBtn.disabled = !connected;
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
    document.getElementById('btn-init-project').addEventListener('click', () => {
      vscode.postMessage({ type: 'initProjectMcp' });
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

    function formatConnectionStatus(next) {
      if (!next.connected) {
        return next.connectionStatus || 'Not connected';
      }
      const name = next.activeConnection?.name;
      const tools = next.health?.toolsLoaded;
      if (name && tools != null) {
        return 'Connected · ' + name + ' · ' + tools + ' tool(s) loaded';
      }
      if (name) {
        return 'Connected · ' + name;
      }
      return next.connectionStatus || 'Connected';
    }

    function renderHealth(health, activeConnection) {
      const el = document.getElementById('health');
      if (!health) { el.textContent = ''; return; }
      const lines = [];
      if (activeConnection?.name) {
        lines.push('Using connection: ' + activeConnection.name +
          (activeConnection.projectKey ? ' · ' + activeConnection.projectKey : ''));
      }
      lines.push(
        health.mcpRunning ? '✓ MCP Running' : '✗ MCP Not Running',
        health.authValid ? '✓ Authentication Valid' : '✗ Authentication Invalid',
        health.apiReachable ? '✓ API Reachable' : '✗ API Unreachable',
        '✓ Tools Loaded (' + (health.toolsLoaded || 0) + ')'
      );
      el.textContent = lines.join('\\n');
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
      document.getElementById('connection-status').textContent = formatConnectionStatus(next);
      document.getElementById('connection-status').className = 'status ' + (next.connected ? 'ok' : 'bad');
      renderHealth(next.health, next.activeConnection);
      renderTools(next.toolGroups || []);
      renderLogs(next.logs || []);
      renderConnectDiagnostics(next.connectDiagnostics || []);
      renderTemplates(next.templates || []);
      renderUpdatePanel(next);
      applyWorkspaceCredentials(next.workspaceCredentials, next.connected);

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
