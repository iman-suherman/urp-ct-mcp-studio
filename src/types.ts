export interface MCPConnection {
  id: string;
  name: string;
  projectKey: string;
  clientId: string;
  authUrl: string;
  apiUrl: string;
  enabledTools: string[];
  isAdmin: boolean;
}

export interface MCPConnectionInput {
  name: string;
  projectKey: string;
  clientId: string;
  clientSecret: string;
  authUrl: string;
  apiUrl: string;
  enabledTools?: string[];
  isAdmin?: boolean;
}

export interface MCPTool {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}

export interface ConnectionHealth {
  mcpRunning: boolean;
  authValid: boolean;
  apiReachable: boolean;
  toolsLoaded: number;
  message?: string;
}

export interface ConnectionTestResult {
  ok: boolean;
  message?: string;
  latencyMs?: number;
  tools?: MCPTool[];
  health?: ConnectionHealth;
}

export interface LogEntry {
  id: string;
  timestamp: number;
  level: "info" | "success" | "error";
  message: string;
  toolName?: string;
}

export interface PromptTemplate {
  id: string;
  title: string;
  description: string;
  toolName: string;
  prompt: string;
}
