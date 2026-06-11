import * as vscode from "vscode";
import { ExplorerPanel } from "./explorerPanel";
import { buildAiPrompt, buildChatPrompt } from "./mcpBootstrap";
import { CommerceMcpManager } from "./mcpManager";
import { categorizeTools, groupToolsByCategory } from "./toolCatalog";
import {
  NavigatorWebviewMessage,
  navigatorToPanelState,
  renderNavigatorHtml,
} from "./navigatorUi";

export class NavigatorPanel {
  public static currentPanel: NavigatorPanel | undefined;

  private constructor(
    private readonly panel: vscode.WebviewPanel,
    private readonly context: vscode.ExtensionContext,
    private readonly manager: CommerceMcpManager
  ) {
    this.panel.webview.html = renderNavigatorHtml({ cspSource: panel.webview.cspSource });
    this.panel.webview.onDidReceiveMessage(
      (message: NavigatorWebviewMessage) => void this.handleMessage(message),
      undefined,
      context.subscriptions
    );
    this.panel.onDidDispose(() => {
      NavigatorPanel.currentPanel = undefined;
    });

    manager.onDidChange(() => {
      void this.refreshState();
    });
  }

  public static show(
    context: vscode.ExtensionContext,
    manager: CommerceMcpManager,
    column: vscode.ViewColumn = vscode.ViewColumn.One
  ): void {
    if (NavigatorPanel.currentPanel) {
      NavigatorPanel.currentPanel.panel.reveal(column, false);
      void NavigatorPanel.currentPanel.refreshState();
      return;
    }

    void (async () => {
      const connection = await manager.getActiveConnection();
      const panel = vscode.window.createWebviewPanel(
        "ctMcpNavigator",
        `${connection?.name ?? "Commerce MCP"} · Navigator`,
        column,
        {
          enableScripts: true,
          retainContextWhenHidden: true,
        }
      );

      const navigator = new NavigatorPanel(panel, context, manager);
      NavigatorPanel.currentPanel = navigator;
      await navigator.refreshState();
    })();
  }

  private async refreshState(options?: { error?: string; busy?: boolean }): Promise<void> {
    const connected = await this.manager.isConnected();
    const connection = await this.manager.getActiveConnection();
    const tools = connected ? categorizeTools(await this.manager.listTools()) : [];
    const toolGroups = groupToolsByCategory(tools);

    if (connection) {
      this.panel.title = `${connection.name} · MCP Navigator`;
    }

    await this.panel.webview.postMessage(
      navigatorToPanelState(toolGroups, {
        connected,
        connectionName: connection?.name ?? "",
        projectKey: connection?.projectKey ?? "",
        connectionStatus: this.manager.getConnectionStatusMessage(),
        error: options?.error,
        busy: options?.busy,
      })
    );
  }

  private async handleMessage(message: NavigatorWebviewMessage): Promise<void> {
    switch (message.type) {
      case "ready":
        await this.refreshState();
        break;

      case "connect":
        await this.refreshState({ busy: true });
        try {
          await this.manager.connect(undefined, { openExplorer: false });
          await this.refreshState();
        } catch (err) {
          const text = err instanceof Error ? err.message : String(err);
          await this.refreshState({ error: text });
        }
        break;

      case "disconnect":
        await this.refreshState({ busy: true });
        await this.manager.disconnect();
        await this.refreshState();
        break;

      case "refresh":
        await this.refreshState({ busy: true });
        try {
          if (await this.manager.isConnected()) {
            await this.manager.refresh();
          } else {
            await this.manager.connect(undefined, { openExplorer: false });
          }
          await this.refreshState();
        } catch (err) {
          const text = err instanceof Error ? err.message : String(err);
          await this.refreshState({ error: text });
        }
        break;

      case "openExplorer":
        ExplorerPanel.show(this.context, this.manager, { toolName: message.toolName });
        break;

      case "copyChatPrompt":
        await vscode.env.clipboard.writeText(buildChatPrompt(message.description ?? message.toolName));
        void vscode.window.showInformationMessage("Chat prompt copied to clipboard.");
        break;

      case "copyAiPrompt":
        await vscode.env.clipboard.writeText(
          buildAiPrompt(message.toolName, message.description)
        );
        void vscode.window.showInformationMessage("AI prompt copied to clipboard.");
        break;
    }
  }
}
