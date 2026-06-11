import * as vscode from "vscode";
import {
  flattenReleaseNotes,
  formatPublishedDate,
  PluginVersion,
  RegistryClient,
} from "./registryClient";
import { resolveUpdateConfig } from "./config";

class RefreshItem extends vscode.TreeItem {
  constructor() {
    super("Refresh", vscode.TreeItemCollapsibleState.None);
    this.command = { command: "ctMcp.refreshVersionHistory", title: "Refresh" };
    this.iconPath = new vscode.ThemeIcon("refresh");
  }
}

class VersionItem extends vscode.TreeItem {
  constructor(
    version: PluginVersion,
    currentVersion: string,
    isLatest: boolean
  ) {
    const isCurrent = version.version === currentVersion;
    const label = isCurrent
      ? `${version.version} (Current)`
      : version.version;
    super(label, vscode.TreeItemCollapsibleState.None);
    this.description = isLatest && !isCurrent ? "Latest" : formatPublishedDate(version.publishedAt);
    this.tooltip = version.summary ?? `Version ${version.version}`;
    this.contextValue = isCurrent ? "currentVersion" : "version";
    this.iconPath = isCurrent
      ? new vscode.ThemeIcon("check")
      : new vscode.ThemeIcon("versions");
    this.command = {
      command: "ctMcp.openReleaseNotes",
      title: "Open Release Notes",
      arguments: [version.version],
    };
  }
}

export class VersionHistoryProvider
  implements vscode.TreeDataProvider<vscode.TreeItem>, vscode.Disposable
{
  private readonly registry: RegistryClient;
  private readonly currentVersion: string;
  private readonly emitter = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this.emitter.event;
  private versions: PluginVersion[] = [];
  private loading = false;
  private error: string | undefined;

  constructor(_context: vscode.ExtensionContext) {
    this.currentVersion = _context.extension.packageJSON.version as string;
    const config = resolveUpdateConfig();
    this.registry = new RegistryClient(config.registryApiUrl, config.pluginId);
    void this.refresh();
  }

  dispose(): void {
    this.emitter.dispose();
  }

  async refresh(): Promise<void> {
    this.loading = true;
    this.error = undefined;
    this.emitter.fire();
    try {
      this.versions = await this.registry.fetchVersions();
    } catch (err) {
      this.error = err instanceof Error ? err.message : String(err);
      this.versions = [];
    } finally {
      this.loading = false;
      this.emitter.fire();
    }
  }

  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: vscode.TreeItem): vscode.TreeItem[] {
    if (element) return [];
    if (this.loading) {
      return [
        new vscode.TreeItem(
          "Loading version history…",
          vscode.TreeItemCollapsibleState.None
        ),
      ];
    }
    if (this.error) {
      const item = new vscode.TreeItem(
        `Failed to load: ${this.error}`,
        vscode.TreeItemCollapsibleState.None
      );
      item.iconPath = new vscode.ThemeIcon("error");
      return [item, new RefreshItem()];
    }
    if (this.versions.length === 0) {
      return [new RefreshItem()];
    }
    const latestVersion = this.versions[0]?.version;
    return [
      ...this.versions.map(
        (version) =>
          new VersionItem(version, this.currentVersion, version.version === latestVersion)
      ),
      new RefreshItem(),
    ];
  }
}

export function renderReleaseNotesHtml(options: {
  cspSource: string;
  version: PluginVersion;
  websiteUrl: string;
  downloadUrl?: string;
}): string {
  const notes = flattenReleaseNotes(options.version.releaseNotes);
  const markdown = options.version.releaseNotesMarkdown;
  const notesHtml =
    notes.length > 0
      ? `<ul>${notes.map((note: string) => `<li>${escapeHtml(note)}</li>`).join("")}</ul>`
      : markdown
        ? `<pre class="markdown">${escapeHtml(markdown)}</pre>`
        : `<p>No release notes available.</p>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${options.cspSource} 'unsafe-inline';">
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Release ${escapeHtml(options.version.version)}</title>
  <style>
    body { font-family: var(--vscode-font-family); color: var(--vscode-foreground); background: var(--vscode-editor-background); padding: 16px 20px; line-height: 1.5; }
    h1 { font-size: 1.4rem; margin: 0 0 8px; }
    .meta { color: var(--vscode-descriptionForeground); font-size: 0.9rem; margin-bottom: 16px; }
    ul { padding-left: 1.2rem; }
    .actions { margin-top: 20px; display: flex; gap: 8px; flex-wrap: wrap; }
    a.button { color: var(--vscode-textLink-foreground); text-decoration: none; border: 1px solid var(--vscode-button-border, transparent); padding: 6px 10px; border-radius: 4px; background: var(--vscode-button-secondaryBackground); }
    pre.markdown { white-space: pre-wrap; background: var(--vscode-textBlockQuote-background); padding: 12px; border-radius: 6px; overflow: auto; }
  </style>
</head>
<body>
  <h1>Commerce MCP Studio ${escapeHtml(options.version.version)}</h1>
  <p class="meta">${escapeHtml(options.version.summary ?? "Release notes")} · ${escapeHtml(formatPublishedDate(options.version.publishedAt))}</p>
  ${notesHtml}
  <div class="actions">
    ${options.downloadUrl ? `<a class="button" href="${escapeHtml(options.downloadUrl)}">Download VSIX</a>` : ""}
    <a class="button" href="${escapeHtml(options.websiteUrl)}/versions?version=${encodeURIComponent(options.version.version)}">View on website</a>
  </div>
</body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export class ReleaseNotesPanel {
  private static currentPanel: vscode.WebviewPanel | undefined;

  static async show(
    context: vscode.ExtensionContext,
    versionLabel: string
  ): Promise<void> {
    const config = resolveUpdateConfig();
    const registry = new RegistryClient(config.registryApiUrl, config.pluginId);
    const version =
      (await registry.fetchVersion(versionLabel)) ??
      ({
        pluginId: config.pluginId,
        version: versionLabel,
      } satisfies PluginVersion);

    const title = `Release Notes · ${version.version}`;
    if (ReleaseNotesPanel.currentPanel) {
      ReleaseNotesPanel.currentPanel.title = title;
      ReleaseNotesPanel.currentPanel.webview.html = renderReleaseNotesHtml({
        cspSource: ReleaseNotesPanel.currentPanel.webview.cspSource,
        version,
        websiteUrl: config.websiteUrl,
        downloadUrl: version.publicDownloadUrl,
      });
      ReleaseNotesPanel.currentPanel.reveal(vscode.ViewColumn.One);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      "ctMcpReleaseNotes",
      title,
      vscode.ViewColumn.One,
      { enableScripts: false, retainContextWhenHidden: true }
    );
    ReleaseNotesPanel.currentPanel = panel;
    panel.onDidDispose(() => {
      ReleaseNotesPanel.currentPanel = undefined;
    });
    panel.webview.html = renderReleaseNotesHtml({
      cspSource: panel.webview.cspSource,
      version,
      websiteUrl: config.websiteUrl,
      downloadUrl: version.publicDownloadUrl,
    });
    context.subscriptions.push(panel);
  }
}
