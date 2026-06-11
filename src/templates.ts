import { PromptTemplate } from "./types";
import { buildProductSearchChatPrompt } from "./mcpChatContext";

export const PROMPT_TEMPLATES: PromptTemplate[] = [
  {
    id: "product-search-sample",
    title: "Product Search (5 items)",
    description: "Smallest match-all product search with MCP or API fallback",
    toolName: "products.search",
    prompt: buildProductSearchChatPrompt(5),
  },
  {
    id: "product-discovery",
    title: "Product Discovery",
    description: "Find unpublished products",
    toolName: "products.read",
    prompt: "Find all unpublished products created within the last 30 days.",
  },
  {
    id: "catalog-audit",
    title: "Catalog Audit",
    description: "Find products missing images",
    toolName: "products.read",
    prompt: "Find products that are published but missing product images.",
  },
  {
    id: "inventory",
    title: "Inventory",
    description: "Find low stock inventory entries",
    toolName: "inventory.read",
    prompt: "Find inventory entries with available quantity below 5 units.",
  },
  {
    id: "channels",
    title: "Channels",
    description: "List supply channels",
    toolName: "channels.read",
    prompt: "List all supply channels in this project.",
  },
];
