import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";

export interface BundledConfig {
  defaultAuthUrl: string;
  defaultApiUrl: string;
  nativeMcpServerId: string;
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
