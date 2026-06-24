import * as vscode from "vscode";
import { normalizeCommercetoolsUrls } from "./mcpBootstrap";
import { MCPConnection, MCPConnectionInput } from "./types";
import { GLOBAL_ACTIVE_CONNECTION_KEY, GLOBAL_CONNECTIONS_KEY, clientSecretKey } from "./secrets";

function createId(): string {
  return `conn_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export class ConnectionStore {
  constructor(private readonly context: vscode.ExtensionContext) {}

  async listConnections(): Promise<MCPConnection[]> {
    return this.context.globalState.get<MCPConnection[]>(GLOBAL_CONNECTIONS_KEY, []);
  }

  async getConnection(id: string): Promise<MCPConnection | undefined> {
    const connections = await this.listConnections();
    return connections.find((item) => item.id === id);
  }

  async getActiveConnectionId(): Promise<string | undefined> {
    return this.context.globalState.get<string>(GLOBAL_ACTIVE_CONNECTION_KEY);
  }

  async getActiveConnection(): Promise<MCPConnection | undefined> {
    const activeId = await this.getActiveConnectionId();
    if (!activeId) {
      return undefined;
    }
    return this.getConnection(activeId);
  }

  async setActiveConnection(id: string | undefined): Promise<void> {
    await this.context.globalState.update(GLOBAL_ACTIVE_CONNECTION_KEY, id);
  }

  async saveConnection(input: MCPConnectionInput, existingId?: string): Promise<MCPConnection> {
    const connections = await this.listConnections();
    const id = existingId ?? createId();
    const existing = connections.find((item) => item.id === id);

    const urls = normalizeCommercetoolsUrls(input.authUrl, input.apiUrl);
    const connection: MCPConnection = {
      id,
      name: input.name.trim(),
      projectKey: input.projectKey.trim(),
      clientId: input.clientId.trim(),
      authUrl: urls.authUrl,
      apiUrl: urls.apiUrl,
      enabledTools: input.enabledTools?.length ? input.enabledTools : ["all"],
      isAdmin: input.isAdmin ?? true,
    };

    if (input.clientSecret.trim()) {
      await this.context.secrets.store(clientSecretKey(id), input.clientSecret.trim());
    }

    const next = existing
      ? connections.map((item) => (item.id === id ? connection : item))
      : [...connections, connection];

    await this.context.globalState.update(GLOBAL_CONNECTIONS_KEY, next);
    return connection;
  }

  async deleteConnection(id: string): Promise<void> {
    const connections = await this.listConnections();
    await this.context.globalState.update(
      GLOBAL_CONNECTIONS_KEY,
      connections.filter((item) => item.id !== id)
    );
    await this.context.secrets.delete(clientSecretKey(id));

    const activeId = await this.getActiveConnectionId();
    if (activeId === id) {
      await this.setActiveConnection(undefined);
    }
  }

  async getClientSecret(connectionId: string): Promise<string | undefined> {
    return this.context.secrets.get(clientSecretKey(connectionId));
  }

  async hasClientSecret(connectionId: string): Promise<boolean> {
    const secret = await this.getClientSecret(connectionId);
    return Boolean(secret?.trim());
  }
}
