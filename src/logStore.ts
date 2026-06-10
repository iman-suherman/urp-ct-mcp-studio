import { LogEntry } from "./types";

function createLogId(): string {
  return `log_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export class LogStore {
  private readonly entries: LogEntry[] = [];
  private readonly maxEntries = 500;

  add(level: LogEntry["level"], message: string, toolName?: string): LogEntry {
    const entry: LogEntry = {
      id: createLogId(),
      timestamp: Date.now(),
      level,
      message,
      toolName,
    };
    this.entries.unshift(entry);
    if (this.entries.length > this.maxEntries) {
      this.entries.length = this.maxEntries;
    }
    return entry;
  }

  info(message: string, toolName?: string): LogEntry {
    return this.add("info", message, toolName);
  }

  success(message: string, toolName?: string): LogEntry {
    return this.add("success", message, toolName);
  }

  error(message: string, toolName?: string): LogEntry {
    return this.add("error", message, toolName);
  }

  list(limit = 100): LogEntry[] {
    return this.entries.slice(0, limit);
  }

  clear(): void {
    this.entries.length = 0;
  }
}

export function formatLogTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  const pad = (value: number, width = 2): string => String(value).padStart(width, "0");
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}
