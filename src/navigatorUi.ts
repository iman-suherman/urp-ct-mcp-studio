import { ToolCategoryGroup } from "./toolCatalog";

export type NavigatorWebviewMessage =
  | { type: "ready" }
  | { type: "connect" }
  | { type: "disconnect" }
  | { type: "refresh" }
  | { type: "search"; query: string }
  | { type: "openExplorer"; toolName: string }
  | { type: "copyChatPrompt"; toolName: string; description?: string }
  | { type: "copyAiPrompt"; toolName: string; description?: string };

export interface NavigatorPanelState {
  connected: boolean;
  connectionName: string;
  projectKey: string;
  connectionStatus?: string;
  toolGroups: Array<{
    category: string;
    tools: Array<{ name: string; description?: string; action: string }>;
  }>;
  toolCount: number;
  searchQuery?: string;
  error?: string;
  busy?: boolean;
}

export function navigatorToPanelState(
  toolGroups: ToolCategoryGroup[],
  partial: Omit<NavigatorPanelState, "toolGroups" | "toolCount">
): NavigatorPanelState & { type: "state" } {
  const toolCount = toolGroups.reduce((sum, group) => sum + group.tools.length, 0);
  return {
    type: "state",
    toolGroups: toolGroups.map((group) => ({
      category: group.category,
      tools: group.tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        action: tool.action,
      })),
    })),
    toolCount,
    ...partial,
  };
}

export function renderNavigatorHtml(options: { cspSource?: string } = {}): string {
  const nonce = String(Date.now());
  const imgSrc = options.cspSource ?? "'none'";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${imgSrc}; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>MCP Navigator</title>
  <style>
    :root {
      color: var(--vscode-foreground);
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      background: var(--vscode-editor-background);
    }
    * { box-sizing: border-box; }
    body { margin: 0; min-height: 100vh; display: flex; flex-direction: column; }
    .header {
      padding: 16px 20px 12px;
      border-bottom: 1px solid var(--vscode-widget-border, rgba(128,128,128,.28));
      background: rgba(37,99,235,0.06);
    }
    h1 { margin: 0 0 4px; font-size: 20px; }
    .subtitle { margin: 0; color: var(--vscode-descriptionForeground); font-size: 12px; }
    .conn-bar {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
      padding: 12px 20px;
      border-bottom: 1px solid var(--vscode-widget-border, rgba(128,128,128,.2));
      background: var(--vscode-sideBar-background, rgba(128,128,128,.04));
    }
    .status-pill {
      padding: 4px 12px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.02em;
    }
    .status-pill.connected {
      background: rgba(34,197,94,0.15);
      color: #22c55e;
    }
    .status-pill.disconnected {
      background: rgba(239,68,68,0.12);
      color: #ef4444;
    }
    .conn-meta { font-size: 12px; color: var(--vscode-descriptionForeground); flex: 1; min-width: 160px; }
    .conn-actions { display: flex; gap: 8px; flex-wrap: wrap; }
    button {
      border: none;
      border-radius: 6px;
      padding: 8px 14px;
      font: inherit;
      cursor: pointer;
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
    }
    button.secondary {
      background: var(--vscode-button-secondaryBackground, transparent);
      color: var(--vscode-button-secondaryForeground, inherit);
      border: 1px solid rgba(128,128,128,.35);
    }
    button.btn-connect {
      background: rgba(37,99,235,0.92);
      color: #fff;
      border: 1px solid rgba(37,99,235,0.55);
    }
    button.btn-connect:hover {
      background: rgba(37,99,235,1);
    }
    button.btn-disconnect {
      background: rgba(239,68,68,0.15);
      color: #ef4444;
      border: 1px solid rgba(239,68,68,0.45);
    }
    button.btn-disconnect:hover {
      background: rgba(239,68,68,0.22);
    }
    button.small {
      padding: 5px 10px;
      font-size: 11px;
    }
    .toolbar {
      padding: 12px 20px;
      display: flex;
      gap: 10px;
      align-items: center;
      flex-wrap: wrap;
      border-bottom: 1px solid rgba(128,128,128,.15);
    }
    .search {
      flex: 1;
      min-width: 220px;
      padding: 8px 12px;
      border-radius: 6px;
      border: 1px solid var(--vscode-input-border, rgba(128,128,128,.45));
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      font: inherit;
    }
    .tool-count { font-size: 11px; color: var(--vscode-descriptionForeground); white-space: nowrap; }
    .content { flex: 1; overflow: auto; padding: 16px 20px 24px; }
    .error {
      margin: 0 20px 12px;
      padding: 10px 12px;
      border-radius: 6px;
      background: rgba(239,68,68,0.12);
      color: #ef4444;
      font-size: 12px;
    }
    .empty {
      text-align: center;
      color: var(--vscode-descriptionForeground);
      padding: 48px 24px;
      font-size: 13px;
      line-height: 1.6;
    }
    .category-block { margin-bottom: 24px; }
    .category-title {
      font-size: 13px;
      font-weight: 700;
      text-transform: capitalize;
      margin: 0 0 12px;
      color: var(--vscode-descriptionForeground);
    }
    .nav-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 12px;
    }
    .nav-card {
      border: 1px solid var(--vscode-widget-border, rgba(128,128,128,.25));
      border-radius: 10px;
      padding: 14px;
      background: var(--vscode-editor-background);
      display: flex;
      flex-direction: column;
      min-height: 160px;
      transition: border-color 0.15s ease, box-shadow 0.15s ease;
    }
    .nav-card:hover {
      border-color: rgba(37,99,235,0.45);
      box-shadow: 0 2px 8px rgba(0,0,0,0.08);
    }
    .nav-card-cat {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--vscode-descriptionForeground);
    }
    .nav-card-name {
      font-family: var(--vscode-editor-font-family, monospace);
      font-size: 12px;
      font-weight: 600;
      margin: 6px 0 8px;
      word-break: break-all;
      line-height: 1.35;
    }
    .nav-card-desc {
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
      line-height: 1.45;
      flex: 1;
      margin-bottom: 12px;
      display: -webkit-box;
      -webkit-line-clamp: 4;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .nav-card-actions { display: flex; flex-wrap: wrap; gap: 6px; }
    .hidden { display: none !important; }
    .busy { font-size: 11px; color: var(--vscode-descriptionForeground); }
  </style>
</head>
<body>
  <header class="header">
    <h1>MCP Navigator</h1>
    <p class="subtitle">Browse all Commerce MCP tools in one place — connect, then explore or query.</p>
  </header>

  <div class="conn-bar">
    <span id="statusPill" class="status-pill disconnected">Not connected</span>
    <div id="connMeta" class="conn-meta">Select a connection in the sidebar, then connect here.</div>
    <div class="conn-actions">
      <button id="btnConnect" class="btn-connect">Connect</button>
      <button id="btnDisconnect" class="btn-disconnect hidden">Disconnect</button>
      <button id="btnRefresh" class="secondary">Refresh</button>
    </div>
  </div>

  <div id="errorBox" class="error hidden"></div>
  <div id="busyLine" class="conn-bar busy hidden">Working…</div>

  <div id="toolbar" class="toolbar hidden">
    <input id="search" class="search" type="search" placeholder="Search tools by meaning, name, or description…" />
    <span id="toolCount" class="tool-count"></span>
  </div>

  <main id="content" class="content">
    <div id="emptyState" class="empty">
      Connect to Commerce MCP to browse tools.<br />
      Use <strong>Connect</strong> above to establish a session — tool cards appear here when connected.
    </div>
    <div id="toolGrid" class="hidden"></div>
  </main>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    let state = { toolGroups: [], connected: false };

    document.getElementById('btnConnect').addEventListener('click', () => {
      vscode.postMessage({ type: 'connect' });
    });
    document.getElementById('btnDisconnect').addEventListener('click', () => {
      vscode.postMessage({ type: 'disconnect' });
    });
    document.getElementById('btnRefresh').addEventListener('click', () => {
      vscode.postMessage({ type: 'refresh' });
    });

    let searchTimer;
    document.getElementById('search').addEventListener('input', (event) => {
      const query = event.target.value || '';
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        vscode.postMessage({ type: 'search', query });
      }, 180);
    });

    function escapeHtml(value) {
      return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    }

    function renderTools(groups) {
      const grid = document.getElementById('toolGrid');
      const filtered = groups.filter(group => group.tools.length > 0);
      const total = filtered.reduce((sum, group) => sum + group.tools.length, 0);
      document.getElementById('toolCount').textContent = total + ' tool' + (total === 1 ? '' : 's');

      if (!filtered.length) {
        grid.innerHTML = '<div class="empty">No tools match your search. Try words like product, order, inventory, customer, or publish.</div>';
        return;
      }

      grid.innerHTML = filtered.map(group => \`
        <section class="category-block">
          <h2 class="category-title">\${escapeHtml(group.category)}</h2>
          <div class="nav-grid">
            \${group.tools.map(tool => \`
              <article class="nav-card" data-tool="\${escapeHtml(tool.name)}">
                <div class="nav-card-cat">\${escapeHtml(tool.action || group.category)}</div>
                <div class="nav-card-name">\${escapeHtml(tool.name)}</div>
                <div class="nav-card-desc">\${escapeHtml(tool.description || 'No description provided.')}</div>
                <div class="nav-card-actions">
                  <button class="small" data-action="query" data-tool="\${escapeHtml(tool.name)}">Query</button>
                  <button class="small secondary" data-action="explore" data-tool="\${escapeHtml(tool.name)}">Explore</button>
                  <button class="small secondary" data-action="prompt" data-tool="\${escapeHtml(tool.name)}" data-desc="\${escapeHtml(tool.description || '')}">Prompt</button>
                  <button class="small secondary" data-action="chat" data-tool="\${escapeHtml(tool.name)}" data-desc="\${escapeHtml(tool.description || '')}">Chat</button>
                </div>
              </article>
            \`).join('')}
          </div>
        </section>
      \`).join('');

      grid.querySelectorAll('[data-action]').forEach(btn => {
        btn.addEventListener('click', (event) => {
          event.stopPropagation();
          const action = btn.dataset.action;
          const toolName = btn.dataset.tool;
          const description = btn.dataset.desc || '';
          if (action === 'query' || action === 'explore') {
            vscode.postMessage({ type: 'openExplorer', toolName });
          } else if (action === 'prompt') {
            vscode.postMessage({ type: 'copyAiPrompt', toolName, description });
          } else if (action === 'chat') {
            const text = description.trim()
              ? 'Use ' + toolName + ' to ' + description.trim().replace(/\\.$/, '') + '.'
              : 'Use the ' + toolName + ' Commerce MCP tool.';
            vscode.postMessage({ type: 'copyChatPrompt', toolName, description: text });
          }
        });
      });
    }

    function applyState(next) {
      state = next;
      const pill = document.getElementById('statusPill');
      const connected = !!next.connected;
      pill.textContent = connected ? 'Connected' : 'Not connected';
      pill.className = 'status-pill ' + (connected ? 'connected' : 'disconnected');

      const meta = next.connectionName
        ? next.connectionName + (next.projectKey ? ' · ' + next.projectKey : '') +
          (next.toolCount ? ' · ' + next.toolCount + ' tools' : '')
        : 'Select a connection in the sidebar, then connect here.';
      document.getElementById('connMeta').textContent = next.connectionStatus || meta;

      document.getElementById('btnConnect').classList.toggle('hidden', connected);
      document.getElementById('btnDisconnect').classList.toggle('hidden', !connected);

      document.getElementById('toolbar').classList.toggle('hidden', !connected);
      document.getElementById('emptyState').classList.toggle('hidden', connected);
      document.getElementById('toolGrid').classList.toggle('hidden', !connected);
      document.getElementById('busyLine').classList.toggle('hidden', !next.busy);

      const searchInput = document.getElementById('search');
      if (typeof next.searchQuery === 'string' && searchInput.value !== next.searchQuery) {
        searchInput.value = next.searchQuery;
      }

      const errorEl = document.getElementById('errorBox');
      if (next.error) {
        errorEl.textContent = next.error;
        errorEl.classList.remove('hidden');
      } else {
        errorEl.classList.add('hidden');
      }

      if (connected) {
        renderTools(next.toolGroups || []);
      }
    }

    window.addEventListener('message', (event) => {
      if (event.data?.type === 'state') applyState(event.data);
    });

    vscode.postMessage({ type: 'ready' });
  </script>
</body>
</html>`;
}
