import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";

export interface BundledConfig {
  defaultAuthUrl: string;
  defaultApiUrl: string;
  nativeMcpServerId: string;
  pluginId: string;
  registryApiUrl: string;
  websiteUrl: string;
  downloadDir: string;
}

export interface ResolvedStudioConfig {
  autoConnectOnStartup: boolean;
  openExplorerOnConnect: boolean;
  syncNativeMcpConfig: boolean;
  dynamicToolLoadingThreshold: number;
  commerceMcpPackage: string;
  defaultAuthUrl: string;
  defaultApiUrl: string;
  nativeMcpServerId: string;
}

export interface ResolvedUpdateConfig {
  pluginId: string;
  registryApiUrl: string;
  websiteUrl: string;
  downloadDir: string;
  updateCheckEnabled: boolean;
  updateChannel: "stable" | "insiders";
}

let bundledConfig: BundledConfig | undefined;

export function getBundledConfig(): BundledConfig {
  if (!bundledConfig) {
    const configPath = path.join(__dirname, "..", "ct-mcp-studio.json");
    bundledConfig = JSON.parse(fs.readFileSync(configPath, "utf-8")) as BundledConfig;
  }
  return bundledConfig;
}

export function resolveStudioConfig(): ResolvedStudioConfig {
  const bundled = getBundledConfig();
  const config = vscode.workspace.getConfiguration("ctMcp");

  return {
    autoConnectOnStartup: config.get<boolean>("autoConnectOnStartup", true),
    openExplorerOnConnect: config.get<boolean>("openExplorerOnConnect", true),
    syncNativeMcpConfig: config.get<boolean>("syncNativeMcpConfig", true),
    dynamicToolLoadingThreshold: config.get<number>("dynamicToolLoadingThreshold", 450),
    commerceMcpPackage: config.get<string>("commerceMcpPackage", "@commercetools/commerce-mcp@latest"),
    defaultAuthUrl: bundled.defaultAuthUrl,
    defaultApiUrl: bundled.defaultApiUrl,
    nativeMcpServerId: bundled.nativeMcpServerId,
  };
}

export function resolveUpdateConfig(): ResolvedUpdateConfig {
  const bundled = getBundledConfig();
  const config = vscode.workspace.getConfiguration("ctMcp");
  const channel = config.get<string>("updateChannel", "stable");

  return {
    pluginId: bundled.pluginId,
    registryApiUrl: config.get<string>("registryApiUrl", bundled.registryApiUrl),
    websiteUrl: config.get<string>("websiteUrl", bundled.websiteUrl),
    downloadDir: bundled.downloadDir,
    updateCheckEnabled: config.get<boolean>("updateCheckEnabled", true),
    updateChannel: channel === "insiders" ? "insiders" : "stable",
  };
}
