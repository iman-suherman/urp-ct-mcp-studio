export function formatMcpResultJson(result: unknown): string {
  try {
    return JSON.stringify(result, null, 2);
  } catch {
    return String(result);
  }
}

export function formatMcpResultReadable(result: unknown): string {
  if (typeof result === "string") {
    return result;
  }

  if (result && typeof result === "object") {
    const record = result as Record<string, unknown>;
    if (Array.isArray(record.results)) {
      const count = record.count ?? record.results.length;
      return `Returned ${count} result(s).`;
    }
    if ("error" in record && typeof record.error === "string") {
      return record.error;
    }
  }

  return formatMcpResultJson(result);
}
