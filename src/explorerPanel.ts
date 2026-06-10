import * as vscode from "vscode";
import { buildAiPrompt, buildChatPrompt, buildMcpCallJson } from "./mcpBootstrap";
import { CommerceMcpManager } from "./mcpManager";
import { formatMcpResultJson, formatMcpResultReadable } from "./responseFormat";
import { categorizeTools, defaultArgsFromSchema } from "./toolCatalog";
import {
  explorerToPanelState,
  ExplorerRunResult,
  ExplorerWebviewMessage,
  renderExplorerHtml,
} from "./explorerUi";

export interface ExplorerShowOptions {
  toolName?: string;
  column?: vscode.ViewColumn;
}

function formatRunLogLine(message: string): string {
  const now = new Date();
  const pad = (value: number, width = 2): string => String(value).padStart(width, "0");
  return `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}.${pad(now.getMilliseconds(), 3)} ${message}`;
}

export class ExplorerPanel {
  public static currentPanel: ExplorerPanel | undefined;

  private selectedToolName?: string;
  private lastArgsJson = "{}";
  private lastRun?: ExplorerRunResult;
  private activeRunLogs: string[] = [];
  private runGeneration = 0;

  private constructor(
    private readonly panel: vscode.WebviewPanel,
    private readonly context: vscode.ExtensionContext,
    private readonly manager: CommerceMcpManager
  ) {
    this.panel.webview.html = renderExplorerHtml({ cspSource: panel.webview.cspSource });
    this.panel.webview.onDidReceiveMessage(
      (message: ExplorerWebviewMessage) => void this.handleMessage(message),
      undefined,
      context.subscriptions
    );
    this.panel.onDidDispose(() => {
      ExplorerPanel.currentPanel = undefined;
    });

    manager.onDidChange(() => {
      void this.refreshState();
    });
  }

  public static show(
    context: vscode.ExtensionContext,
    manager: CommerceMcpManager,
    options: ExplorerShowOptions = {}
  ): void {
    const column = options.column ?? vscode.ViewColumn.One;

    if (ExplorerPanel.currentPanel) {
      ExplorerPanel.currentPanel.panel.reveal(column, false);
      if (options.toolName) {
        void ExplorerPanel.currentPanel.openTool(options.toolName);
      } else {
        void ExplorerPanel.currentPanel.refreshState();
      }
      return;
    }

    void (async () => {
      const connection = await manager.getActiveConnection();
      const panel = vscode.window.createWebviewPanel(
        "ctMcpExplorer",
        `${connection?.name ?? "Commerce MCP"} · Explorer`,
        column,
        {
          enableScripts: true,
          retainContextWhenHidden: true,
        }
      );

      const explorer = new ExplorerPanel(panel, context, manager);
      ExplorerPanel.currentPanel = explorer;
      if (options.toolName) {
        await explorer.openTool(options.toolName);
      } else {
        await explorer.refreshState();
      }
    })();
  }

  public async openTool(toolName: string): Promise<void> {
    this.selectedToolName = toolName;
    const tools = await this.manager.listTools();
    const tool = tools.find((item) => item.name === toolName);
    this.lastArgsJson = defaultArgsFromSchema(tool?.inputSchema);
    const connection = await this.manager.getActiveConnection();
    this.panel.title = `${connection?.name ?? "Commerce MCP"} · ${toolName}`;
    await this.refreshState();
  }

  private async refreshState(options?: {
    error?: string;
    busy?: boolean;
    running?: boolean;
    runLogs?: string[];
  }): Promise<void> {
    const connected = await this.manager.isConnected();
    const connection = await this.manager.getActiveConnection();
    const tools = connected ? categorizeTools(await this.manager.listTools()) : [];
    const selected = tools.find((tool) => tool.name === this.selectedToolName);

    if (selected && this.lastArgsJson === "{}" && selected.inputSchema) {
      this.lastArgsJson = defaultArgsFromSchema(selected.inputSchema);
    }

    const runLogs =
      options?.runLogs ??
      (options?.running || this.activeRunLogs.length > 0
        ? this.activeRunLogs
        : this.lastRun?.logs);

    await this.panel.webview.postMessage(
      explorerToPanelState(tools, {
        loggedIn: connected,
        connectionName: connection?.name ?? "Commerce MCP",
        projectKey: connection?.projectKey ?? "",
        connectionStatus: this.manager.getConnectionStatusMessage(),
        selectedToolName: this.selectedToolName,
        argsJson: this.lastArgsJson,
        lastRun: this.lastRun,
        runLogs,
        error: options?.error,
        busy: options?.busy,
        running: options?.running,
      })
    );
  }

  private async appendRunLog(runId: number, message: string, running: boolean): Promise<void> {
    if (runId !== this.runGeneration) {
      return;
    }
    this.activeRunLogs.push(formatRunLogLine(message));
    await this.refreshState({ running, runLogs: [...this.activeRunLogs] });
  }

  private async handleMessage(message: ExplorerWebviewMessage): Promise<void> {
    switch (message.type) {
      case "ready":
        await this.refreshState();
        break;

      case "refresh":
        await this.refreshState({ busy: true });
        try {
          const test = await this.manager.testConnection();
          if (!test.ok) {
            await this.refreshState({ error: test.message ?? "Failed to refresh MCP tools" });
            return;
          }
          await this.refreshState();
        } catch (err) {
          const text = err instanceof Error ? err.message : String(err);
          await this.refreshState({ error: text });
        }
        break;

      case "selectTool":
        await this.openTool(message.name);
        break;

      case "updateArgs":
        this.lastArgsJson = message.argsJson;
        break;

      case "runTool": {
        const runId = ++this.runGeneration;
        this.lastRun = undefined;
        this.activeRunLogs = [];
        this.lastArgsJson = message.argsJson;

        let args: Record<string, unknown> = {};
        try {
          args = message.argsJson.trim() ? JSON.parse(message.argsJson) : {};
        } catch {
          await this.refreshState({ error: "Arguments must be valid JSON." });
          return;
        }

        const started = Date.now();
        try {
          await this.appendRunLog(runId, `Tool: ${message.name}`, true);
          await this.appendRunLog(runId, `Arguments: ${JSON.stringify(args)}`, true);
          const result = await this.manager.callTool(message.name, args);
          const durationMs = Date.now() - started;
          if (runId !== this.runGeneration) {
            return;
          }
          this.lastRun = {
            name: message.name,
            args,
            result,
            readableText: formatMcpResultReadable(result),
            jsonText: formatMcpResultJson(result),
            ok: true,
            durationMs,
            logs: [...this.activeRunLogs, formatRunLogLine(`Completed in ${durationMs}ms`)],
          };
          await this.refreshState();
        } catch (err) {
          const text = err instanceof Error ? err.message : String(err);
          this.lastRun = {
            name: message.name,
            args,
            result: null,
            readableText: text,
            jsonText: formatMcpResultJson({ error: text, args }),
            ok: false,
            durationMs: Date.now() - started,
            error: text,
            logs: [...this.activeRunLogs, formatRunLogLine(`ERROR: ${text}`)],
          };
          await this.refreshState({ error: text });
        }
        break;
      }

      case "copyResponse": {
        if (!this.lastRun) {
          return;
        }
        const payload =
          message.format === "json" ? this.lastRun.jsonText : this.lastRun.readableText;
        await vscode.env.clipboard.writeText(payload);
        void vscode.window.showInformationMessage("Response copied to clipboard.");
        break;
      }

      case "copyChatPrompt":
        await vscode.env.clipboard.writeText(buildChatPrompt(message.text));
        void vscode.window.showInformationMessage("Chat prompt copied to clipboard.");
        break;

      case "copyMcpJson": {
        let args: Record<string, unknown> = {};
        try {
          args = message.argsJson.trim() ? JSON.parse(message.argsJson) : {};
        } catch {
          void vscode.window.showErrorMessage("Arguments must be valid JSON.");
          return;
        }
        await vscode.env.clipboard.writeText(buildMcpCallJson(message.toolName, args));
        void vscode.window.showInformationMessage("MCP call JSON copied to clipboard.");
        break;
      }

      case "copyAiPrompt":
        await vscode.env.clipboard.writeText(
          buildAiPrompt(message.toolName, message.description)
        );
        void vscode.window.showInformationMessage("AI prompt copied to clipboard.");
        break;

      case "openSchema": {
        const doc = await vscode.workspace.openTextDocument({
          content: message.schema,
          language: "json",
        });
        await vscode.window.showTextDocument(doc, {
          preview: true,
          viewColumn: vscode.ViewColumn.Beside,
        });
        break;
      }
    }
  }
}
