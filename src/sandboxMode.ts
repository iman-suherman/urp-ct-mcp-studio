import * as vscode from "vscode";
import { MCPConnection, MCPConnectionInput } from "./types";

const RESTRICTED_TERMS = ["prod", "qantas"];

export function isSandboxModeEnabled(): boolean {
  return vscode.workspace.getConfiguration("ctMcp").get<boolean>("sandboxMode", true);
}

export function isRestrictedConnection(
  connection: Pick<MCPConnection | MCPConnectionInput, "name" | "projectKey">
): boolean {
  const haystack = `${connection.name} ${connection.projectKey}`.toLowerCase();
  return RESTRICTED_TERMS.some((term) => haystack.includes(term));
}

export function getSandboxBlockReason(
  connection: Pick<MCPConnection | MCPConnectionInput, "name" | "projectKey">
): string | undefined {
  if (!isSandboxModeEnabled() || !isRestrictedConnection(connection)) {
    return undefined;
  }

  return `Sandbox mode is enabled and blocks connections containing "prod" or "qantas" (${connection.name} · ${connection.projectKey}). Disable sandbox mode in Commerce MCP Studio settings to use this project.`;
}

export async function warnIfSandboxBlocked(
  connection: Pick<MCPConnection | MCPConnectionInput, "name" | "projectKey">
): Promise<boolean> {
  const reason = getSandboxBlockReason(connection);
  if (!reason) {
    return false;
  }

  await vscode.window.showWarningMessage(reason);
  return true;
}
