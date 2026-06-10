import * as vscode from "vscode";
import { ExplorerPanel } from "./explorerPanel";
import { getCommerceMcpManager, maybeAutoConnect, deactivateCommerceMcpManager } from "./mcpManager";
import { StudioViewProvider } from "./studioViewProvider";

export function activate(context: vscode.ExtensionContext): void {
  const manager = getCommerceMcpManager(context);
  const studioView = new StudioViewProvider(context, manager);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      StudioViewProvider.viewId,
      studioView,
      { webviewOptions: { retainContextWhenHidden: true } }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("ctMcp.openStudio", async () => {
      await vscode.commands.executeCommand("workbench.view.extension.ct-mcp-studio");
    }),
    vscode.commands.registerCommand("ctMcp.openExplorer", (toolName?: string) => {
      ExplorerPanel.show(context, manager, { toolName });
    }),
    vscode.commands.registerCommand("ctMcp.connect", async () => {
      try {
        await manager.connect();
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
    })
  );

  void maybeAutoConnect(context);
}

export async function deactivate(): Promise<void> {
  await deactivateCommerceMcpManager();
}
