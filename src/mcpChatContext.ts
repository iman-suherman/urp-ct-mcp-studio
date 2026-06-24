import { MCPConnection } from "./types";

const USER_MCP_JSON_HINT =
  process.platform === "darwin"
    ? "~/Library/Application Support/Code/User/mcp.json"
    : process.platform === "win32"
      ? "%APPDATA%\\Code\\User\\mcp.json"
      : "~/.config/Code/User/mcp.json";

export const COMMERCE_MCP_AGENT_PLAYBOOK = `# Commerce MCP agent playbook

When the user asks for commercetools data (products, carts, orders, etc.):

1. **Prefer MCP tools** — use \`@commerce-mcp\` tools (e.g. product search) when they are available in chat.
2. **If the dedicated commerce tool is not exposed**, discover an existing setup in the workspace before asking for secrets:
   - Workspace \`.env\` (\`CTP_*\`, \`CTOOLS_*\`, \`COMM_TOOLS_*\`, \`CT_MCP_*\`, \`COMMERCETOOLS_*\`)
   - \`.env.mcp\` (\`CT_MCP_*\`, \`COMMERCETOOLS_*\`)
   - \`.cursor/mcp.json\` → \`mcpServers.commerce-mcp\`
   - \`.vscode/settings.json\` → \`mcp.servers.commerce-mcp\`
   - User MCP config: \`${USER_MCP_JSON_HINT}\` → \`servers.commerce-mcp\` args (\`--projectKey=\`, \`--clientId=\`, etc.)
   - Shell env: \`CT_MCP_*\`, \`COMMERCETOOLS_*\`, \`CTP_*\`, \`CTOOLS_*\`, \`COMM_TOOLS_*\`, \`PROJECT_KEY\`, \`CLIENT_ID\`, \`AUTH_URL\`, \`API_URL\`
3. **Never expose secrets** — do not print client secrets, access tokens, or Basic auth headers in chat or user-visible logs.
4. **Communicate progress** — briefly state what you are checking before each step (tool availability → credential paths → API call).

## Direct Product Search API fallback

When MCP tools are unavailable but credentials exist:

- **Token:** \`POST {authUrl}/oauth/token\` with \`grant_type=client_credentials\` and scope \`manage_project:{projectKey}\`
- **Search:** \`POST {apiUrl}/{projectKey}/products/search\`
- **Smallest match-all query (example, 5 products):**

\`\`\`json
{
  "query": { "exists": { "field": "id" } },
  "limit": 5,
  "productProjectionParameters": {}
}
\`\`\`

- Search results nest fields under \`productProjection\` — use \`item.productProjection.name\`, \`.slug\`, \`.key\`, \`.masterVariant.sku\`, not bare top-level keys.
- Return a compact summary: id, name, slug, key, masterVariantSku. Mention \`total\` when present.
- If projection is sparse, inspect raw \`productProjection\` keys once before enriching with follow-up reads.

## Example agent flow (product search)

"I'm checking whether the commercetools product-search tool is available in this workspace, then I'll run the smallest possible query to return 5 products."

→ Tool missing: "The dedicated commerce tool is not exposed here, so I'm checking the repo for an existing commercetools setup or credentials path…"

→ Found \`.env.mcp\` / \`mcp.json\`: "I have a configured commercetools connection. Before calling the API, I'm checking the product-search endpoint shape…"

→ Issue one search with \`limit: 5\`, summarize results without echoing credentials.`;

export function buildConnectionContextBlock(connection: MCPConnection): string {
  return `## Active connection

- **Name:** ${connection.name}
- **Project key:** ${connection.projectKey}
- **Workspace env:** \`.env.mcp\`
- **Workspace MCP:** \`.cursor/mcp.json\`, \`.vscode/settings.json\``;
}

export function buildCommerceMcpCursorRule(connection: MCPConnection): string {
  return `---
description: Commerce MCP agent playbook — tool discovery, credential lookup, and commercetools API fallback
alwaysApply: false
---

${buildConnectionContextBlock(connection)}

${COMMERCE_MCP_AGENT_PLAYBOOK}

Use \`@commerce-mcp\` in chat when MCP tools are loaded. Reload MCP after changing \`.env.mcp\` or \`.cursor/mcp.json\`.
`;
}

export function buildCommerceMcpChatContext(connection?: MCPConnection): string {
  const connectionBlock = connection ? `\n${buildConnectionContextBlock(connection)}\n` : "";
  return `${COMMERCE_MCP_AGENT_PLAYBOOK}${connectionBlock}`.trim();
}

export function buildProductSearchChatPrompt(limit = 5, connection?: MCPConnection): string {
  const projectHint = connection ? ` for project \`${connection.projectKey}\`` : "";
  return `Find ${limit} products${projectHint} using the smallest possible commercetools product search query.

Prefer the \`@commerce-mcp\` product search tool if available. If not, use credentials from \`.env.mcp\` or \`commerce-mcp\` in MCP config and call \`POST /{projectKey}/products/search\` with:

\`\`\`json
{
  "query": { "exists": { "field": "id" } },
  "limit": ${limit},
  "productProjectionParameters": {}
}
\`\`\`

Read names, slugs, keys, and SKUs from \`productProjection\`. Do not expose secrets.`;
}

export function resolveUserMcpJsonHint(): string {
  return USER_MCP_JSON_HINT;
}
