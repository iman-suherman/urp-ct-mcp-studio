import { MCPConnection } from "./types";
import { resolveStudioConfig } from "./config";

export function buildCommerceMcpArgs(
  connection: MCPConnection,
  clientSecret: string
): string[] {
  const config = resolveStudioConfig();
  const tools = connection.enabledTools.join(",") || "all";

  const args = [
    "-y",
    config.commerceMcpPackage,
    `--tools=${tools}`,
    "--authType=client_credentials",
    `--clientId=${connection.clientId}`,
    `--clientSecret=${clientSecret}`,
    `--projectKey=${connection.projectKey}`,
    `--authUrl=${connection.authUrl}`,
    `--apiUrl=${connection.apiUrl}`,
    `--dynamicToolLoadingThreshold=${config.dynamicToolLoadingThreshold}`,
  ];

  if (connection.isAdmin || tools === "all") {
    args.push("--isAdmin=true");
  }

  return args;
}

export function buildNativeMcpServerConfig(
  connection: MCPConnection,
  clientSecret: string
): Record<string, unknown> {
  const config = resolveStudioConfig();
  return {
    type: "stdio",
    command: "npx",
    args: buildCommerceMcpArgs(connection, clientSecret),
  };
}

export function buildMcpCallJson(toolName: string, args: Record<string, unknown>): string {
  return JSON.stringify({ tool: toolName, arguments: args }, null, 2);
}

export function buildChatPrompt(text: string): string {
  return `@commerce-mcp\n${text.trim()}`;
}

export function buildAiPrompt(toolName: string, description?: string): string {
  const hint = description?.trim()
    ? description.trim()
    : `perform a useful task with the ${toolName} tool`;
  return `Using ${toolName},\n${hint}.`;
}
