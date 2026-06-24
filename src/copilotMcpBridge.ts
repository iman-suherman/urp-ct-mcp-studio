import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import { resolveStudioConfig } from "./config";
import { buildNativeMcpServerConfig } from "./mcpBootstrap";
import { buildCommerceMcpCopilotInstructions } from "./mcpChatContext";
import { CommerceMcpManager } from "./mcpManager";
import { MCPConnection } from "./types";

const COPILOT_INSTRUCTIONS_FILE = ".github/copilot-instructions.md";
const COPILOT_INSTRUCTIONS_START = "<!-- commerce-mcp-studio:start -->";
const COPILOT_INSTRUCTIONS_END = "<!-- commerce-mcp-studio:end -->";

export interface CopilotMcpSession {
  connection: MCPConnection;
  clientSecret: string;
  extensionPath: string;
}

let activeSession: CopilotMcpSession | undefined;
const definitionsChangedEmitter = new vscode.EventEmitter<void>();

function isCopilotIntegrationEnabled(): boolean {
  return vscode.workspace.getConfiguration("ctMcp").get<boolean>("enableCopilotMcpIntegration", true);
}

function isCopilotInstructionsSyncEnabled(): boolean {
  return vscode.workspace.getConfiguration("ctMcp").get<boolean>("syncCopilotInstructions", true);
}

function getLanguageModelApi(): {
  registerTool?: (name: string, tool: unknown) => vscode.Disposable;
  registerMcpServerDefinitionProvider?: (
    id: string,
    provider: unknown
  ) => vscode.Disposable;
  McpStdioServerDefinition?: new (options: Record<string, unknown>) => unknown;
} | undefined {
  return (vscode as unknown as { lm?: Record<string, unknown> }).lm as
    | {
        registerTool?: (name: string, tool: unknown) => vscode.Disposable;
        registerMcpServerDefinitionProvider?: (
          id: string,
          provider: unknown
        ) => vscode.Disposable;
        McpStdioServerDefinition?: new (options: Record<string, unknown>) => unknown;
      }
    | undefined;
}

export function setCopilotMcpSession(session: CopilotMcpSession | undefined): void {
  activeSession = session;
  definitionsChangedEmitter.fire();
}

export async function syncCopilotMcpSession(
  connection: MCPConnection | undefined,
  clientSecret: string | undefined,
  extensionPath: string
): Promise<void> {
  if (!isCopilotIntegrationEnabled()) {
    setCopilotMcpSession(undefined);
    return;
  }

  if (connection && clientSecret) {
    setCopilotMcpSession({ connection, clientSecret, extensionPath });
    if (isCopilotInstructionsSyncEnabled()) {
      await syncWorkspaceCopilotInstructions(connection);
    }
    return;
  }

  setCopilotMcpSession(undefined);
  if (isCopilotInstructionsSyncEnabled()) {
    await removeWorkspaceCopilotInstructions();
  }
}

function formatToolResult(value: unknown): vscode.LanguageModelToolResult {
  const text =
    typeof value === "string" ? value : JSON.stringify(value, null, 2);
  return new vscode.LanguageModelToolResult([new vscode.LanguageModelTextPart(text)]);
}

function createListToolsTool(getManager: () => CommerceMcpManager): vscode.LanguageModelTool<Record<string, never>> {
  return {
    invoke: async () => {
      const manager = getManager();
      if (!(await manager.isConnected())) {
        return formatToolResult({
          error: "Commerce MCP is not connected. Connect from the Commerce MCP Studio sidebar first.",
        });
      }

      const connection = await manager.getActiveConnection();
      const tools = await manager.listTools();
      return formatToolResult({
        connected: true,
        connection: connection
          ? { name: connection.name, projectKey: connection.projectKey }
          : undefined,
        toolCount: tools.length,
        tools: tools.map((tool) => ({
          name: tool.name,
          description: tool.description,
        })),
        guidance:
          "Call commerce_mcp_call_tool with toolName and arguments to execute a commercetools operation directly.",
      });
    },
  };
}

interface CallToolArgs {
  toolName?: string;
  arguments?: Record<string, unknown>;
}

function createCallToolTool(getManager: () => CommerceMcpManager): vscode.LanguageModelTool<CallToolArgs> {
  return {
    invoke: async (options) => {
      const manager = getManager();
      if (!(await manager.isConnected())) {
        return formatToolResult({
          error: "Commerce MCP is not connected. Connect from the Commerce MCP Studio sidebar first.",
        });
      }

      const toolName = options.input.toolName?.trim();
      if (!toolName) {
        return formatToolResult({ error: "toolName is required." });
      }

      const args =
        options.input.arguments && typeof options.input.arguments === "object"
          ? options.input.arguments
          : {};

      try {
        const result = await manager.callTool(toolName, args);
        return formatToolResult(result);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return formatToolResult({ error: message, toolName, arguments: args });
      }
    },
  };
}

function registerLanguageModelTools(
  context: vscode.ExtensionContext,
  getManager: () => CommerceMcpManager
): void {
  const lm = getLanguageModelApi();
  if (!lm?.registerTool) {
    return;
  }

  context.subscriptions.push(
    lm.registerTool("commerce_mcp_list_tools", createListToolsTool(getManager)),
    lm.registerTool("commerce_mcp_call_tool", createCallToolTool(getManager))
  );
}

function registerMcpServerDefinitionProvider(context: vscode.ExtensionContext): void {
  const lm = getLanguageModelApi();
  if (!lm?.registerMcpServerDefinitionProvider || !lm.McpStdioServerDefinition) {
    return;
  }

  const provider = {
    onDidChangeMcpServerDefinitions: definitionsChangedEmitter.event,
    provideMcpServerDefinitions: async () => {
      if (!activeSession || !isCopilotIntegrationEnabled()) {
        return [];
      }

      const config = resolveStudioConfig();
      const serverConfig = buildNativeMcpServerConfig(
        activeSession.connection,
        activeSession.clientSecret,
        activeSession.extensionPath
      );

      return [
        new lm.McpStdioServerDefinition!({
          label: config.nativeMcpServerId,
          command: serverConfig.command,
          args: serverConfig.args,
          env: serverConfig.env,
        }),
      ];
    },
    resolveMcpServerDefinition: async (definition: { label?: string }) => definition,
  };

  context.subscriptions.push(
    lm.registerMcpServerDefinitionProvider("commerceMcpStudio", provider)
  );
}

async function syncWorkspaceCopilotInstructions(connection: MCPConnection): Promise<void> {
  const folder = vscode.workspace.workspaceFolders?.[0];
  if (!folder) {
    return;
  }

  const filePath = path.join(folder.uri.fsPath, COPILOT_INSTRUCTIONS_FILE);
  const block = buildCommerceMcpCopilotInstructions(connection);
  const wrapped = `${COPILOT_INSTRUCTIONS_START}\n${block}\n${COPILOT_INSTRUCTIONS_END}`;

  let contents = "";
  if (fs.existsSync(filePath)) {
    contents = fs.readFileSync(filePath, "utf-8");
  }

  const startIndex = contents.indexOf(COPILOT_INSTRUCTIONS_START);
  const endIndex = contents.indexOf(COPILOT_INSTRUCTIONS_END);

  if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
    contents =
      contents.slice(0, startIndex) +
      wrapped +
      contents.slice(endIndex + COPILOT_INSTRUCTIONS_END.length);
  } else if (contents.trim()) {
    contents = `${contents.trimEnd()}\n\n${wrapped}\n`;
  } else {
    contents = `# Copilot instructions\n\n${wrapped}\n`;
  }

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, contents, "utf-8");
}

async function removeWorkspaceCopilotInstructions(): Promise<void> {
  const folder = vscode.workspace.workspaceFolders?.[0];
  if (!folder) {
    return;
  }

  const filePath = path.join(folder.uri.fsPath, COPILOT_INSTRUCTIONS_FILE);
  if (!fs.existsSync(filePath)) {
    return;
  }

  const contents = fs.readFileSync(filePath, "utf-8");
  const startIndex = contents.indexOf(COPILOT_INSTRUCTIONS_START);
  const endIndex = contents.indexOf(COPILOT_INSTRUCTIONS_END);
  if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) {
    return;
  }

  const next = (contents.slice(0, startIndex) + contents.slice(endIndex + COPILOT_INSTRUCTIONS_END.length))
    .replace(/\n{3,}/g, "\n\n")
    .trimEnd();

  if (next.trim()) {
    fs.writeFileSync(filePath, `${next}\n`, "utf-8");
  } else {
    fs.unlinkSync(filePath);
  }
}

export function registerCopilotMcpIntegration(
  context: vscode.ExtensionContext,
  getManager: () => CommerceMcpManager
): void {
  if (!isCopilotIntegrationEnabled()) {
    return;
  }

  registerLanguageModelTools(context, getManager);
  registerMcpServerDefinitionProvider(context);
}
