import { CategorizedTool } from "./toolCatalog";

export type ExplorerWebviewMessage =
  | { type: "ready" }
  | { type: "refresh" }
  | { type: "selectTool"; name: string }
  | { type: "updateArgs"; argsJson: string }
  | { type: "runTool"; name: string; argsJson: string }
  | { type: "copyResponse"; format: "readable" | "json" }
  | { type: "copyChatPrompt"; text: string }
  | { type: "copyMcpJson"; toolName: string; argsJson: string }
  | { type: "copyAiPrompt"; toolName: string; description?: string }
  | { type: "openSchema"; name: string; schema: string };

export interface ExplorerRunResult {
  name: string;
  args: Record<string, unknown>;
  result: unknown;
  readableText: string;
  jsonText: string;
  ok: boolean;
  durationMs: number;
  error?: string;
  logs: string[];
}

export interface ExplorerPanelState {
  loggedIn: boolean;
  connectionName: string;
  projectKey: string;
  connectionStatus?: string;
  tools: CategorizedTool[];
  selectedToolName?: string;
  argsJson: string;
  lastRun?: ExplorerRunResult;
  runLogs?: string[];
  error?: string;
  busy?: boolean;
  running?: boolean;
}

export function explorerToPanelState(
  tools: CategorizedTool[],
  partial: Omit<ExplorerPanelState, "tools">
): ExplorerPanelState & { type: "state" } {
  return {
    type: "state",
    tools,
    ...partial,
  };
}

export function renderExplorerHtml(options: { cspSource?: string } = {}): string {
  const nonce = String(Date.now());
  const imgSrc = options.cspSource ?? "'none'";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${imgSrc}; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Commerce MCP Explorer</title>
  <style>
    :root { color: var(--vscode-foreground); font-family: var(--vscode-font-family); font-size: var(--vscode-font-size); background: var(--vscode-editor-background); }
    * { box-sizing: border-box; }
    body { margin: 0; height: 100vh; display: flex; flex-direction: column; overflow: hidden; }
    .header { padding: 14px 18px; border-bottom: 1px solid var(--vscode-widget-border, rgba(128,128,128,.28)); background: rgba(102,85,255,0.06); }
    h1 { margin: 0 0 4px; font-size: 18px; }
    .subtitle { margin: 0; color: var(--vscode-descriptionForeground); font-size: 11px; }
    .layout { flex: 1; display: grid; grid-template-columns: minmax(260px, 320px) 1fr; min-height: 0; }
    .sidebar { border-right: 1px solid var(--vscode-widget-border); display: flex; flex-direction: column; min-height: 0; background: var(--vscode-sideBar-background); }
    .sidebar-toolbar { padding: 10px; border-bottom: 1px solid rgba(128,128,128,.2); display: flex; flex-direction: column; gap: 8px; }
    .search, textarea, select { width: 100%; padding: 8px 10px; border-radius: 6px; border: 1px solid var(--vscode-input-border, rgba(128,128,128,.5)); background: var(--vscode-input-background); color: var(--vscode-input-foreground); font: inherit; }
    .tool-list { flex: 1; overflow: auto; padding: 6px; }
    .tool-item { width: 100%; text-align: left; border: 1px solid transparent; border-radius: 6px; padding: 8px 10px; margin-bottom: 4px; background: transparent; color: inherit; cursor: pointer; font: inherit; }
    .tool-item:hover { background: rgba(128,128,128,0.08); }
    .tool-item.active { background: rgba(102,85,255,0.12); border-color: rgba(102,85,255,0.35); }
    .tool-item-name { font-family: var(--vscode-editor-font-family, monospace); font-size: 11px; font-weight: 600; word-break: break-all; }
    .tool-item-cat { font-size: 10px; color: var(--vscode-descriptionForeground); margin-top: 2px; text-transform: capitalize; }
    .main { display: flex; flex-direction: column; min-height: 0; padding: 16px 18px; overflow: auto; }
    .tool-title { font-family: var(--vscode-editor-font-family, monospace); font-size: 15px; font-weight: 600; margin: 0 0 8px; }
    .tool-desc { margin: 0 0 12px; color: var(--vscode-descriptionForeground); font-size: 12px; line-height: 1.5; }
    textarea.args { min-height: 140px; font-family: var(--vscode-editor-font-family, monospace); font-size: 12px; resize: vertical; }
    .actions { display: flex; flex-wrap: wrap; gap: 8px; margin: 12px 0; }
    button { border: none; border-radius: 4px; padding: 8px 14px; font: inherit; cursor: pointer; background: var(--vscode-button-background); color: var(--vscode-button-foreground); }
    button.secondary { background: var(--vscode-button-secondaryBackground, transparent); color: var(--vscode-button-secondaryForeground, inherit); border: 1px solid rgba(128,128,128,.4); }
    pre { margin: 0; padding: 12px; overflow: auto; max-height: 320px; font-family: var(--vscode-editor-font-family, monospace); font-size: 11px; white-space: pre-wrap; word-break: break-word; background: rgba(0,0,0,0.15); border-radius: 8px; border: 1px solid rgba(128,128,128,.25); }
    .error { margin-bottom: 10px; padding: 10px 12px; border-radius: 6px; background: rgba(239,68,68,0.12); color: #ef4444; font-size: 12px; }
    .empty { color: var(--vscode-descriptionForeground); font-size: 12px; padding: 24px; text-align: center; }
    .hidden { display: none !important; }
  </style>
</head>
<body>
  <header class="header">
    <h1>Commerce MCP Explorer</h1>
    <p class="subtitle" id="metaLine">Connect Commerce MCP to explore and execute tools.</p>
  </header>

  <div id="disconnectedBox" class="empty">Connect Commerce MCP from the sidebar to use the explorer.</div>

  <div id="layout" class="layout hidden">
    <aside class="sidebar">
      <div class="sidebar-toolbar">
        <input id="search" class="search" type="search" placeholder="Search tools…" />
        <button id="refreshBtn" class="secondary">Refresh tools</button>
      </div>
      <div id="toolList" class="tool-list"></div>
    </aside>

    <main class="main">
      <div id="errorBox" class="error hidden"></div>
      <div id="emptyMain" class="empty">Select a tool to inspect parameters and execute it.</div>
      <div id="toolPanel" class="hidden">
        <h2 id="toolTitle" class="tool-title"></h2>
        <p id="toolDesc" class="tool-desc"></p>
        <label>Parameters (JSON)</label>
        <textarea id="argsEditor" class="args" spellcheck="false"></textarea>
        <div class="actions">
          <button id="runBtn">Execute</button>
          <button id="schemaBtn" class="secondary">View schema</button>
          <button id="copyJsonBtn" class="secondary">Copy JSON</button>
          <button id="copyPromptBtn" class="secondary">Copy Prompt</button>
          <button id="copyChatBtn" class="secondary">Use in Chat</button>
        </div>
        <div id="runLogSection" class="hidden">
          <strong>Execution log</strong>
          <pre id="runLogBody"></pre>
        </div>
        <div id="responseSection" class="hidden">
          <strong>Result</strong>
          <pre id="responseJson"></pre>
          <div class="actions">
            <button id="copyReadableBtn" class="secondary">Copy readable</button>
            <button id="copyResponseJsonBtn" class="secondary">Copy JSON response</button>
          </div>
        </div>
      </div>
    </main>
  </div>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    let state = { tools: [], selectedToolName: '', argsJson: '{}' };
    let filter = '';

    function selectedTool() {
      return state.tools.find(tool => tool.name === state.selectedToolName);
    }

    function renderTools() {
      const list = document.getElementById('toolList');
      const tools = state.tools.filter(tool => {
        if (!filter) return true;
        const q = filter.toLowerCase();
        return tool.name.toLowerCase().includes(q) || (tool.description || '').toLowerCase().includes(q);
      });
      list.innerHTML = tools.map(tool => \`
        <button class="tool-item \${tool.name === state.selectedToolName ? 'active' : ''}" data-name="\${tool.name}">
          <div class="tool-item-name">\${tool.name}</div>
          <div class="tool-item-cat">\${tool.category}</div>
        </button>
      \`).join('');
      list.querySelectorAll('[data-name]').forEach(btn => {
        btn.addEventListener('click', () => vscode.postMessage({ type: 'selectTool', name: btn.dataset.name }));
      });
    }

    function applyState(next) {
      state = next;
      const connected = !!next.loggedIn;
      document.getElementById('disconnectedBox').classList.toggle('hidden', connected);
      document.getElementById('layout').classList.toggle('hidden', !connected);
      document.getElementById('metaLine').textContent = connected
        ? \`\${next.connectionName} · \${next.projectKey} · \${next.connectionStatus || ''}\`
        : 'Connect Commerce MCP to explore and execute tools.';

      renderTools();

      const tool = selectedTool();
      const hasTool = !!tool;
      document.getElementById('emptyMain').classList.toggle('hidden', hasTool);
      document.getElementById('toolPanel').classList.toggle('hidden', !hasTool);

      if (tool) {
        document.getElementById('toolTitle').textContent = tool.name;
        document.getElementById('toolDesc').textContent = tool.description || 'No description provided.';
        document.getElementById('argsEditor').value = next.argsJson || '{}';
      }

      const errorBox = document.getElementById('errorBox');
      if (next.error) {
        errorBox.textContent = next.error;
        errorBox.classList.remove('hidden');
      } else {
        errorBox.classList.add('hidden');
      }

      const logs = next.runLogs || next.lastRun?.logs || [];
      document.getElementById('runLogSection').classList.toggle('hidden', !logs.length);
      document.getElementById('runLogBody').textContent = logs.join('\\n');

      if (next.lastRun) {
        document.getElementById('responseSection').classList.remove('hidden');
        document.getElementById('responseJson').textContent = next.lastRun.jsonText || next.lastRun.readableText || '';
      } else {
        document.getElementById('responseSection').classList.add('hidden');
      }

      document.getElementById('runBtn').disabled = !!next.running;
    }

    document.getElementById('search').addEventListener('input', (event) => {
      filter = event.target.value;
      renderTools();
    });
    document.getElementById('refreshBtn').addEventListener('click', () => vscode.postMessage({ type: 'refresh' }));
    document.getElementById('argsEditor').addEventListener('change', (event) => {
      vscode.postMessage({ type: 'updateArgs', argsJson: event.target.value });
    });
    document.getElementById('runBtn').addEventListener('click', () => {
      vscode.postMessage({ type: 'runTool', name: state.selectedToolName, argsJson: document.getElementById('argsEditor').value });
    });
    document.getElementById('schemaBtn').addEventListener('click', () => {
      const tool = selectedTool();
      if (!tool) return;
      vscode.postMessage({ type: 'openSchema', name: tool.name, schema: JSON.stringify(tool.inputSchema || {}, null, 2) });
    });
    document.getElementById('copyJsonBtn').addEventListener('click', () => {
      vscode.postMessage({ type: 'copyMcpJson', toolName: state.selectedToolName, argsJson: document.getElementById('argsEditor').value });
    });
    document.getElementById('copyPromptBtn').addEventListener('click', () => {
      const tool = selectedTool();
      vscode.postMessage({ type: 'copyAiPrompt', toolName: state.selectedToolName, description: tool?.description });
    });
    document.getElementById('copyChatBtn').addEventListener('click', () => {
      const tool = selectedTool();
      const text = tool?.description ? tool.description : \`Use \${state.selectedToolName} for my commercetools task.\`;
      vscode.postMessage({ type: 'copyChatPrompt', text });
    });
    document.getElementById('copyReadableBtn').addEventListener('click', () => vscode.postMessage({ type: 'copyResponse', format: 'readable' }));
    document.getElementById('copyResponseJsonBtn').addEventListener('click', () => vscode.postMessage({ type: 'copyResponse', format: 'json' }));

    window.addEventListener('message', (event) => {
      if (event.data?.type === 'state') applyState(event.data);
    });

    vscode.postMessage({ type: 'ready' });
  </script>
</body>
</html>`;
}
