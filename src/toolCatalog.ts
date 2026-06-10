import { MCPTool } from "./types";

export interface CategorizedTool extends MCPTool {
  category: string;
  action: string;
}

export interface ToolCategoryGroup {
  category: string;
  tools: CategorizedTool[];
}

export function parseToolName(name: string): { category: string; action: string } {
  const dotIndex = name.indexOf(".");
  if (dotIndex === -1) {
    return { category: "other", action: name };
  }
  return {
    category: name.slice(0, dotIndex),
    action: name.slice(dotIndex + 1),
  };
}

export function categorizeTools(tools: MCPTool[]): CategorizedTool[] {
  return tools
    .map((tool) => {
      const parsed = parseToolName(tool.name);
      return {
        ...tool,
        category: parsed.category,
        action: parsed.action,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function groupToolsByCategory(tools: CategorizedTool[]): ToolCategoryGroup[] {
  const groups = new Map<string, CategorizedTool[]>();
  for (const tool of tools) {
    const list = groups.get(tool.category) ?? [];
    list.push(tool);
    groups.set(tool.category, list);
  }

  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([category, categoryTools]) => ({
      category,
      tools: categoryTools.sort((a, b) => a.name.localeCompare(b.name)),
    }));
}

export function defaultArgsFromSchema(schema?: Record<string, unknown>): string {
  if (!schema || typeof schema !== "object") {
    return "{}";
  }

  const props = (schema as { properties?: Record<string, unknown> }).properties;
  if (!props) {
    return "{}";
  }

  const required = new Set(
    ((schema as { required?: string[] }).required ?? []).filter(Boolean)
  );
  const args: Record<string, unknown> = {};

  for (const [key, prop] of Object.entries(props)) {
    const field = prop as { type?: string; default?: unknown };
    if (field.default !== undefined) {
      args[key] = field.default;
      continue;
    }
    if (!required.has(key)) {
      continue;
    }
    switch (field.type) {
      case "number":
      case "integer":
        args[key] = 0;
        break;
      case "boolean":
        args[key] = false;
        break;
      case "array":
        args[key] = [];
        break;
      case "object":
        args[key] = {};
        break;
      default:
        args[key] = "";
    }
  }

  return JSON.stringify(args, null, 2);
}
