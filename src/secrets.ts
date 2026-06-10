export const GLOBAL_CONNECTIONS_KEY = "ctMcp.connections";
export const GLOBAL_ACTIVE_CONNECTION_KEY = "ctMcp.activeConnectionId";
export const GLOBAL_CACHED_TOOLS_KEY = "ctMcp.cachedTools";
export const GLOBAL_CONNECTION_STATUS_KEY = "ctMcp.connectionStatus";

export function clientSecretKey(connectionId: string): string {
  return `ctMcp.connection.${connectionId}.clientSecret`;
}
