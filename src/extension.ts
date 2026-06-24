import * as vscode from "vscode";
import { ExplorerPanel } from "./explorerPanel";
import { NavigatorPanel } from "./navigatorPanel";
import { getCommerceMcpManager, maybeAutoConnect, deactivateCommerceMcpManager } from "./mcpManager";
import { openProjectMcpFiles } from "./projectMcpInit";
import { StudioViewProvider } from "./studioViewProvider";
import { disposeUpdateService, getUpdateService } from "./updateService";
import { ReleaseNotesPanel, VersionHistoryProvider } from "./versionHistory";

export function activate(context: vscode.ExtensionContext): void {
  const manager = getCommerceMcpManager(context);
  const updateService = getUpdateService(context);
  const studioView = new StudioViewProvider(context, manager, updateService);
  const versionHistory = new VersionHistoryProvider(context);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      StudioViewProvider.viewId,
      studioView,
      { webviewOptions: { retainContextWhenHidden: true } }
    ),
    vscode.window.registerTreeDataProvider("ctMcp.versionHistory", versionHistory),
    versionHistory,
    updateService
  );

  updateService.start();

  context.subscriptions.push(
    vscode.commands.registerCommand("ctMcp.openStudio", async () => {
      await vscode.commands.executeCommand("workbench.view.extension.ct-mcp-studio");
    }),
    vscode.commands.registerCommand("ctMcp.openExplorer", (toolName?: string) => {
      ExplorerPanel.show(context, manager, { toolName });
    }),
    vscode.commands.registerCommand("ctMcp.openNavigator", () => {
      NavigatorPanel.show(context, manager);
    }),
    vscode.commands.registerCommand("ctMcp.initProjectMcp", async () => {
      try {
        const result = await manager.initProjectMcpContext(context.extensionPath);
        const action = await vscode.window.showInformationMessage(
          `Project MCP initialized for ${result.connectionName} · ${result.projectKey}.`,
          "Open .env.mcp"
        );
        if (action === "Open .env.mcp") {
          await openProjectMcpFiles(result);
        }
        await studioView.refresh();
      } catch (err) {
        const text = err instanceof Error ? err.message : String(err);
        void vscode.window.showErrorMessage(text);
      }
    }),
    vscode.commands.registerCommand("ctMcp.connect", async () => {
      try {
        await manager.connect(undefined, { openExplorer: false });
        await studioView.refresh();
      } catch (err) {
        const text = err instanceof Error ? err.message : String(err);
        void vscode.window.showErrorMessage(text);
      }
    }),
    vscode.commands.registerCommand("ctMcp.disconnect", async () => {
      await manager.disconnect();
      await studioView.refresh();
    }),
    vscode.commands.registerCommand("ctMcp.refresh", async () => {
      try {
        await manager.refresh();
        await studioView.refresh();
      } catch (err) {
        const text = err instanceof Error ? err.message : String(err);
        void vscode.window.showErrorMessage(text);
      }
    }),
    vscode.commands.registerCommand("ctMcp.checkForUpdates", async () => {
      await updateService.checkForUpdates({ force: true, suggestUpgrade: false });
      await studioView.refresh();
      const state = updateService.getState();
      if (!state.latestVersion) {
        void vscode.window.showWarningMessage("Could not check for updates.");
        return;
      }
      if (!state.updateAvailable) {
        void vscode.window.showInformationMessage(
          `Commerce MCP Studio ${state.currentVersion} is up to date.`
        );
      }
    }),
    vscode.commands.registerCommand("ctMcp.downloadUpdate", async () => {
      await updateService.installUpdate();
      await studioView.refresh();
    }),
    vscode.commands.registerCommand("ctMcp.openReleaseNotes", async (version?: string) => {
      const targetVersion =
        version ??
        updateService.getLatestRelease()?.version ??
        context.extension.packageJSON.version;
      await ReleaseNotesPanel.show(context, String(targetVersion));
    }),
    vscode.commands.registerCommand("ctMcp.refreshVersionHistory", async () => {
      await versionHistory.refresh();
    }),
    vscode.commands.registerCommand("ctMcp.openVersionHistory", async () => {
      await vscode.commands.executeCommand("ctMcp.versionHistory.focus");
    })
  );

  void maybeAutoConnect(context);
}

export async function deactivate(): Promise<void> {
  disposeUpdateService();
  await deactivateCommerceMcpManager();
}
