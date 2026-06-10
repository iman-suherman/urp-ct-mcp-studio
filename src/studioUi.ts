import * as vscode from "vscode";
import { resolveStudioConfig } from "./config";
import { formatLogTimestamp } from "./logStore";
import { buildAiPrompt, buildChatPrompt } from "./mcpBootstrap";
import { CommerceMcpManager } from "./mcpManager";
import { groupToolsByCategory } from "./toolCatalog";
import { PROMPT_TEMPLATES } from "./templates";
import { ConnectionHealth, LogEntry, MCPConnection } from "./types";

export interface StudioPanelState {
  activeTab: "connections" | "tools" | "logs" | "templates";
  connections: Array<
    MCPConnection & {
      isActive: boolean;
      hasSecret: boolean;
    }
  >;
  activeConnection?: MCPConnection;
  connected: boolean;
  connectionStatus?: string;
  health?: ConnectionHealth;
  tools: Array<{ name: string; description?: string; category: string }>;
  toolGroups: Array<{ category: string; tools: Array<{ name: string; description?: string }> }>;
  logs: Array<{ time: string; level: string; message: string; toolName?: string }>;
  templates: Array<{ id: string; title: string; description: string; prompt: string; toolName: string }>;
  defaults: {
    authUrl: string;
    apiUrl: string;
  };
  error?: string;
  busy?: boolean;
}

export type StudioWebviewMessage =
  | { type: "ready" }
  | { type: "switchTab"; tab: StudioPanelState["activeTab"] }
  | { type: "saveConnection"; connection: Record<string, unknown>; connectionId?: string }
  | { type: "deleteConnection"; connectionId: string }
  | { type: "selectConnection"; connectionId: string }
  | { type: "connect"; connectionId?: string }
  | { type: "disconnect" }
  | { type: "refresh" }
  | { type: "openExplorer"; toolName?: string }
  | { type: "copyChatPrompt"; text: string }
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
    const config = resolveStudioConfig();
    const connections = await this.manager.listConnections();
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

    const connectionsWithMeta = await Promise.all(
      connections.map(async (connection) => ({
        ...connection,
        isActive: active?.id === connection.id,
        hasSecret: await this.manager["store"].hasClientSecret(connection.id),
      }))
    );

    const test = connected ? await this.manager.testConnection() : undefined;
    const logs: LogEntry[] = this.manager.logs.list(80);

    await this.host.postMessage({
      type: "state",
      activeTab: this.activeTab,
      connections: connectionsWithMeta,
      activeConnection: active,
      connected,
      connectionStatus: this.manager.getConnectionStatusMessage(),
      health: test?.health,
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
      templates: PROMPT_TEMPLATES.map((template) => ({
        id: template.id,
        title: template.title,
        description: template.description,
        prompt: template.prompt,
        toolName: template.toolName,
      })),
      defaults: {
        authUrl: config.defaultAuthUrl,
        apiUrl: config.defaultApiUrl,
      },
      error,
      busy,
    });
  }

  private async handleMessage(message: StudioWebviewMessage): Promise<void> {
    switch (message.type) {
      case "ready":
        await this.pushState();
        break;

      case "switchTab":
        this.activeTab = message.tab;
        await this.pushState();
        break;

      case "saveConnection": {
        const payload = message.connection;
        try {
          await this.manager.saveConnection(
            {
              name: String(payload.name ?? ""),
              projectKey: String(payload.projectKey ?? ""),
              clientId: String(payload.clientId ?? ""),
              clientSecret: String(payload.clientSecret ?? ""),
              authUrl: String(payload.authUrl ?? ""),
              apiUrl: String(payload.apiUrl ?? ""),
              enabledTools: ["all"],
              isAdmin: true,
            },
            message.connectionId
          );
          await this.pushState("Connection saved.");
        } catch (err) {
          const text = err instanceof Error ? err.message : String(err);
          await this.pushState(text);
        }
        break;
      }

      case "deleteConnection":
        await this.manager.deleteConnection(message.connectionId);
        await this.pushState("Connection deleted.");
        break;

      case "selectConnection":
        await this.manager.selectConnection(message.connectionId);
        await this.pushState();
        break;

      case "connect":
        await this.pushState(undefined, true);
        try {
          await this.manager.connect(message.connectionId);
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

      case "copyChatPrompt":
        await vscode.env.clipboard.writeText(buildChatPrompt(message.text));
        void vscode.window.showInformationMessage("Chat prompt copied to clipboard.");
        break;

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
    .hero { text-align: center; margin-bottom: 12px; }
    .logo { width: 72px; height: 72px; object-fit: contain; }
    .logo-fallback {
      width: 72px; height: 72px; margin: 0 auto;
      display: grid; place-items: center;
      border-radius: 12px; background: rgba(128,128,128,0.15);
      font-weight: 700;
    }
    h1 { margin: 8px 0 4px; font-size: 16px; }
    .subtitle { margin: 0; color: var(--vscode-descriptionForeground); font-size: 11px; }
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
    .conn-name { font-weight: 600; }
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
    .log-time { color: var(--vscode-descriptionForeground); margin-right: 6px; }
    .log-error { color: #ef4444; }
    .log-success { color: #22c55e; }
    .template-item { margin-bottom: 8px; }
    .template-title { font-weight: 600; font-size: 12px; }
    .template-desc { font-size: 11px; color: var(--vscode-descriptionForeground); }
    .error { color: #ef4444; font-size: 11px; margin: 8px 0; white-space: pre-wrap; }
    .hidden { display: none; }
  </style>
</head>
<body>
  <div class="hero">
    ${logoHtml}
    <h1>Commerce MCP</h1>
    <p class="subtitle">Configure, explore, and test commercetools MCP</p>
  </div>

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
      <div class="row">
        <button id="btn-connect">Connect</button>
        <button id="btn-disconnect">Disconnect</button>
        <button id="btn-refresh">Refresh</button>
        <button id="btn-explorer">Open Explorer</button>
      </div>
    </div>

    <div class="card">
      <strong>Saved Connections</strong>
      <div id="connections-list"></div>
    </div>

    <div class="card">
      <strong id="form-title">Add Connection</strong>
      <input type="hidden" id="connection-id" />
      <div class="field"><label>Name</label><input id="name" placeholder="Qantas SIT" /></div>
      <div class="field"><label>Project Key</label><input id="projectKey" placeholder="my-project" /></div>
      <div class="field"><label>Client ID</label><input id="clientId" /></div>
      <div class="field"><label>Client Secret</label><input id="clientSecret" type="password" /></div>
      <div class="field"><label>Auth URL</label><input id="authUrl" /></div>
      <div class="field"><label>API URL</label><input id="apiUrl" /></div>
      <div class="row">
        <button id="btn-save">Save Connection</button>
        <button id="btn-reset-form">Reset</button>
      </div>
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

    document.getElementById('btn-connect').addEventListener('click', () => {
      vscode.postMessage({ type: 'connect' });
    });
    document.getElementById('btn-disconnect').addEventListener('click', () => {
      vscode.postMessage({ type: 'disconnect' });
    });
    document.getElementById('btn-refresh').addEventListener('click', () => {
      vscode.postMessage({ type: 'refresh' });
    });
    document.getElementById('btn-explorer').addEventListener('click', () => {
      vscode.postMessage({ type: 'openExplorer' });
    });
    document.getElementById('btn-clear-logs').addEventListener('click', () => {
      vscode.postMessage({ type: 'clearLogs' });
    });
    document.getElementById('btn-reset-form').addEventListener('click', () => {
      document.getElementById('connection-id').value = '';
      document.getElementById('form-title').textContent = 'Add Connection';
      ['name','projectKey','clientId','clientSecret'].forEach(id => {
        document.getElementById(id).value = '';
      });
      document.getElementById('authUrl').value = state.defaults?.authUrl || '';
      document.getElementById('apiUrl').value = state.defaults?.apiUrl || '';
    });
    document.getElementById('btn-save').addEventListener('click', () => {
      vscode.postMessage({
        type: 'saveConnection',
        connectionId: document.getElementById('connection-id').value || undefined,
        connection: {
          name: document.getElementById('name').value,
          projectKey: document.getElementById('projectKey').value,
          clientId: document.getElementById('clientId').value,
          clientSecret: document.getElementById('clientSecret').value,
          authUrl: document.getElementById('authUrl').value,
          apiUrl: document.getElementById('apiUrl').value,
        }
      });
    });

    function renderHealth(health) {
      const el = document.getElementById('health');
      if (!health) { el.textContent = ''; return; }
      const lines = [
        health.mcpRunning ? '✓ MCP Running' : '✗ MCP Not Running',
        health.authValid ? '✓ Authentication Valid' : '✗ Authentication Invalid',
        health.apiReachable ? '✓ API Reachable' : '✗ API Unreachable',
        '✓ Tools Loaded (' + (health.toolsLoaded || 0) + ')'
      ];
      el.textContent = lines.join('\\n');
    }

    function renderConnections(connections) {
      const list = document.getElementById('connections-list');
      if (!connections.length) {
        list.innerHTML = '<p class="subtitle">No connections yet.</p>';
        return;
      }
      list.innerHTML = connections.map(conn => \`
        <div class="conn-item \${conn.isActive ? 'active' : ''}" data-id="\${conn.id}">
          <div class="conn-name">\${conn.name}</div>
          <div class="conn-meta">\${conn.projectKey} · \${conn.hasSecret ? 'secret saved' : 'missing secret'}</div>
          <div class="row">
            <button data-action="select" data-id="\${conn.id}">Select</button>
            <button data-action="connect" data-id="\${conn.id}">Connect</button>
            <button data-action="edit" data-id="\${conn.id}">Edit</button>
            <button data-action="delete" data-id="\${conn.id}">Delete</button>
          </div>
        </div>
      \`).join('');

      list.querySelectorAll('button').forEach(btn => {
        btn.addEventListener('click', (event) => {
          event.stopPropagation();
          const id = btn.dataset.id;
          const action = btn.dataset.action;
          const conn = connections.find(item => item.id === id);
          if (action === 'select') vscode.postMessage({ type: 'selectConnection', connectionId: id });
          if (action === 'connect') vscode.postMessage({ type: 'connect', connectionId: id });
          if (action === 'delete') vscode.postMessage({ type: 'deleteConnection', connectionId: id });
          if (action === 'edit' && conn) {
            document.getElementById('connection-id').value = conn.id;
            document.getElementById('form-title').textContent = 'Edit Connection';
            document.getElementById('name').value = conn.name;
            document.getElementById('projectKey').value = conn.projectKey;
            document.getElementById('clientId').value = conn.clientId;
            document.getElementById('clientSecret').value = '';
            document.getElementById('authUrl').value = conn.authUrl;
            document.getElementById('apiUrl').value = conn.apiUrl;
          }
        });
      });
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
        btn.addEventListener('click', () => vscode.postMessage({ type: 'copyChatPrompt', text: btn.dataset.chat }));
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

    function applyState(next) {
      state = next;
      document.getElementById('connection-status').textContent = next.connectionStatus || (next.connected ? 'Connected' : 'Not connected');
      document.getElementById('connection-status').className = 'status ' + (next.connected ? 'ok' : 'bad');
      renderHealth(next.health);
      renderConnections(next.connections || []);
      renderTools(next.toolGroups || []);
      renderLogs(next.logs || []);
      renderTemplates(next.templates || []);

      if (!document.getElementById('authUrl').value && next.defaults) {
        document.getElementById('authUrl').value = next.defaults.authUrl || '';
        document.getElementById('apiUrl').value = next.defaults.apiUrl || '';
      }

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
