import { CategorizedTool, ToolCategoryGroup } from "./toolCatalog";

export interface SearchableTool {
  name: string;
  description?: string;
  category: string;
  action: string;
}

const STOP_WORDS = new Set([
  "a",
  "an",
  "the",
  "and",
  "or",
  "for",
  "to",
  "in",
  "on",
  "with",
  "from",
  "by",
  "of",
  "all",
  "any",
  "some",
  "this",
  "that",
  "these",
  "those",
  "using",
  "use",
  "via",
  "mcp",
  "commerce",
  "commercetools",
  "tool",
  "tools",
]);

/** Commerce MCP concepts mapped to related terms users might say in natural language. */
const CONCEPT_TERMS: Record<string, string[]> = {
  product: [
    "product",
    "products",
    "catalog",
    "catalogue",
    "sku",
    "item",
    "items",
    "merchandise",
    "variant",
    "variants",
    "assortment",
    "listing",
  ],
  order: ["order", "orders", "purchase", "purchases", "checkout", "fulfillment", "fulfilment"],
  cart: ["cart", "carts", "basket", "shopping", "shopping-cart"],
  customer: ["customer", "customers", "buyer", "buyers", "shopper", "account", "accounts", "member"],
  inventory: [
    "inventory",
    "inventories",
    "stock",
    "availability",
    "quantity",
    "quantities",
    "warehouse",
    "supply",
    "restock",
  ],
  channel: ["channel", "channels", "distribution", "supply-channel"],
  store: ["store", "stores", "shop", "retail", "project"],
  price: ["price", "prices", "pricing", "discount", "discounts", "promotion", "promotions", "offer"],
  payment: ["payment", "payments", "pay", "transaction", "transactions", "refund"],
  shipping: ["shipping", "shipment", "shipments", "delivery", "freight", "carrier"],
  tax: ["tax", "taxes", "vat", "duty"],
  category: ["category", "categories", "taxonomy", "classification", "department"],
  review: ["review", "reviews", "rating", "ratings", "feedback"],
  subscription: ["subscription", "subscriptions", "recurring"],
  quote: ["quote", "quotes", "quotation"],
  return: ["return", "returns", "refund", "rma"],
  search: ["search", "find", "query", "lookup", "look", "discover", "filter", "browse", "show", "list"],
  read: ["read", "get", "fetch", "retrieve", "view", "inspect", "details"],
  write: ["create", "add", "new", "insert", "register"],
  update: ["update", "edit", "modify", "patch", "change", "set"],
  delete: ["delete", "remove", "archive", "destroy", "drop"],
  publish: ["publish", "published", "unpublish", "unpublished", "live", "draft", "staging"],
  image: ["image", "images", "photo", "media", "asset", "picture"],
  import: ["import", "upload", "bulk", "csv"],
  export: ["export", "download", "extract"],
  audit: ["audit", "missing", "broken", "invalid", "issue", "problem"],
};

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));
}

function expandQueryTerms(query: string): string[] {
  const tokens = tokenize(query);
  const expanded = new Set<string>(tokens);

  for (const token of tokens) {
    for (const terms of Object.values(CONCEPT_TERMS)) {
      const matchesConcept = terms.some(
        (term) => term === token || token.includes(term) || term.includes(token)
      );
      if (matchesConcept) {
        for (const term of terms) {
          expanded.add(term);
        }
      }
    }
  }

  return [...expanded];
}

function scoreTool(tool: SearchableTool, query: string, terms: string[]): number {
  const normalizedQuery = query.trim().toLowerCase();
  const name = tool.name.toLowerCase();
  const category = tool.category.toLowerCase();
  const action = tool.action.toLowerCase();
  const description = (tool.description ?? "").toLowerCase();
  const haystack = `${name} ${category} ${action} ${description}`;

  let score = 0;

  if (normalizedQuery && haystack.includes(normalizedQuery)) {
    score += 60;
  }

  if (normalizedQuery && name.includes(normalizedQuery)) {
    score += 40;
  }

  for (const term of terms) {
    if (name.includes(term)) {
      score += 14;
    }
    if (category.includes(term)) {
      score += 12;
    }
    if (action.includes(term)) {
      score += 10;
    }
    if (description.includes(term)) {
      score += 8;
    }
  }

  for (const token of tokenize(query)) {
    if (action.startsWith(token) || action.includes(`.${token}`) || action.includes(`${token}.`)) {
      score += 6;
    }
  }

  return score;
}

export function filterToolsBySemanticSearch<T extends SearchableTool>(
  tools: T[],
  query: string
): T[] {
  const trimmed = query.trim();
  if (!trimmed) {
    return tools;
  }

  const terms = expandQueryTerms(trimmed);
  const scored = tools
    .map((tool) => ({ tool, score: scoreTool(tool, trimmed, terms) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.tool.name.localeCompare(b.tool.name));

  return scored.map((item) => item.tool);
}

export function filterToolGroupsBySemanticSearch(
  groups: ToolCategoryGroup[],
  query: string
): ToolCategoryGroup[] {
  const trimmed = query.trim();
  if (!trimmed) {
    return groups;
  }

  return groups
    .map((group) => ({
      category: group.category,
      tools: filterToolsBySemanticSearch(group.tools, trimmed),
    }))
    .filter((group) => group.tools.length > 0);
}

export function filterCategorizedToolsBySemanticSearch(
  tools: CategorizedTool[],
  query: string
): CategorizedTool[] {
  return filterToolsBySemanticSearch(tools, query);
}
