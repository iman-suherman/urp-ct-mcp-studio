import { EventEmitter } from "events";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { MCPConnection, MCPTool } from "./types";
import { MCP_REQUEST_TIMEOUT_MS, resolveCommerceMcpSpawn } from "./mcpBootstrap";

export interface McpSessionInfo {
  connectionId: string;
  connectionName: string;
  projectKey: string;
}

const MCP_REQUEST_OPTIONS = {
  timeout: MCP_REQUEST_TIMEOUT_MS,
  resetTimeoutOnProgress: true,
} as const;

function redactArg(arg: string): string {
  if (arg.startsWith("--clientSecret=")) {
    return "--clientSecret=***";
  }
  return arg;
}

export class McpProcessManager extends EventEmitter {
  private client: Client | undefined;
  private transport: StdioClientTransport | undefined;
  private session: McpSessionInfo | undefined;
  private tools: MCPTool[] = [];
  private connecting = false;

  constructor(private readonly extensionPath?: string) {
    super();
  }

  get isConnected(): boolean {
    return Boolean(this.client && this.session);
  }

  get currentSession(): McpSessionInfo | undefined {
    return this.session;
  }

  get cachedTools(): MCPTool[] {
    return this.tools;
  }

  async connect(connection: MCPConnection, clientSecret: string): Promise<MCPTool[]> {
    if (this.connecting) {
      throw new Error("Connection already in progress.");
    }

    this.connecting = true;
    try {
      await this.disconnect();
      this.emit("log", "[connect] Cleared previous MCP session state.");

      const spawn = resolveCommerceMcpSpawn(connection, clientSecret, this.extensionPath);
      this.emit("log", `[connect] Launch command: ${spawn.command}`);
      this.emit("log", `[connect] Launch args: ${spawn.args.map(redactArg).join(" ")}`);
      const transport = new StdioClientTransport({
        command: spawn.command,
        args: spawn.args,
        stderr: "pipe",
        env: spawn.env,
      });
      transport.onclose = () => {
        this.emit("log", "[connect] Transport closed.");
      };
      transport.onerror = (error: unknown) => {
        const text = error instanceof Error ? error.message : String(error);
        this.emit("log", `[connect] Transport error: ${text}`);
      };

      const client = new Client(
        { name: "ct-mcp-studio", version: "0.1.0" },
        { capabilities: {} }
      );

      transport.stderr?.on("data", (chunk: Buffer) => {
        const text = chunk.toString("utf-8").trim();
        if (text) {
          this.emit("log", `[connect] [stderr] ${text}`);
        }
      });

      this.emit("log", "[connect] Opening MCP client transport...");
      await client.connect(transport, MCP_REQUEST_OPTIONS);
      this.emit("log", "[connect] MCP initialize completed.");

      this.emit("log", "[connect] Requesting tools/list...");
      const listed = await client.listTools({}, MCP_REQUEST_OPTIONS);
      this.emit("log", `[connect] tools/list returned ${listed.tools.length} tool(s).`);
      this.tools = listed.tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema as Record<string, unknown> | undefined,
      }));

      this.client = client;
      this.transport = transport;
      this.session = {
        connectionId: connection.id,
        connectionName: connection.name,
        projectKey: connection.projectKey,
      };

      return this.tools;
    } catch (error) {
      const text = error instanceof Error ? error.message : String(error);
      this.emit("log", `[connect] MCP connect failed: ${text}`);
      throw error;
    } finally {
      this.connecting = false;
    }
  }

  async disconnect(): Promise<void> {
    const client = this.client;
    const transport = this.transport;

    this.client = undefined;
    this.transport = undefined;
    this.session = undefined;
    this.tools = [];

    if (client) {
      try {
        await client.close();
      } catch {
        // ignore close errors during teardown
      }
    }

    if (transport) {
      try {
        await transport.close();
      } catch {
        // ignore close errors during teardown
      }
    }
  }

  async listTools(): Promise<MCPTool[]> {
    if (!this.client) {
      return [];
    }

    const listed = await this.client.listTools({}, MCP_REQUEST_OPTIONS);
    this.tools = listed.tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema as Record<string, unknown> | undefined,
    }));
    return this.tools;
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
    if (!this.client) {
      throw new Error("Commerce MCP is not connected.");
    }

    const result = await this.client.callTool({ name, arguments: args }, undefined, MCP_REQUEST_OPTIONS);
    const content = Array.isArray(result.content)
      ? (result.content as Array<{ type?: string; text?: string }>)
      : [];

    if (result.isError) {
      const text = content
        .map((item) => (typeof item.text === "string" ? item.text : JSON.stringify(item)))
        .join("\n");
      throw new Error(text || `Tool ${name} failed.`);
    }

    if (content.length === 1 && typeof content[0]?.text === "string") {
      const text = content[0].text;
      try {
        return JSON.parse(text);
      } catch {
        return text;
      }
    }

    return content;
  }
}
