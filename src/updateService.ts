import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { spawn } from "child_process";
import * as vscode from "vscode";
import { resolveUpdateConfig } from "./config";
import { LatestRelease, RegistryClient } from "./registryClient";
import { isNewerVersion } from "./semver";

const CHECK_INTERVAL_MS = 12 * 60 * 60 * 1000;
const DISMISSED_VERSION_KEY = "ctMcp.dismissedUpdateVersion";

export class UpdateService implements vscode.Disposable {
  private readonly statusBarItem: vscode.StatusBarItem;
  private readonly registry: RegistryClient;
  private readonly currentVersion: string;
  private intervalId: ReturnType<typeof setInterval> | undefined;
  private latestRelease: LatestRelease | undefined;
  private checking = false;

  constructor(private readonly context: vscode.ExtensionContext) {
    this.currentVersion = context.extension.packageJSON.version as string;
    const config = resolveUpdateConfig();
    this.registry = new RegistryClient(config.registryApiUrl, config.pluginId);
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      50
    );
    this.statusBarItem.command = "ctMcp.checkForUpdates";
    this.renderStatusBar(false);
    this.statusBarItem.show();
  }

  start(): void {
    this.context.subscriptions.push(this.statusBarItem);
    void this.checkForUpdates({ notify: false });
    this.intervalId = setInterval(() => {
      void this.checkForUpdates({ notify: true });
    }, CHECK_INTERVAL_MS);
    this.context.subscriptions.push({
      dispose: () => {
        if (this.intervalId) clearInterval(this.intervalId);
      },
    });
  }

  dispose(): void {
    this.statusBarItem.dispose();
    if (this.intervalId) clearInterval(this.intervalId);
  }

  getLatestRelease(): LatestRelease | undefined {
    return this.latestRelease;
  }

  hasUpdateAvailable(): boolean {
    return Boolean(
      this.latestRelease &&
        isNewerVersion(this.latestRelease.version, this.currentVersion)
    );
  }

  async checkForUpdates(options: { notify?: boolean } = {}): Promise<LatestRelease | null> {
    const config = resolveUpdateConfig();
    if (!config.updateCheckEnabled) {
      this.renderStatusBar(false);
      return null;
    }
    if (this.checking) return this.latestRelease ?? null;
    this.checking = true;
    try {
      const release = await this.registry.fetchLatestRelease(config.updateChannel);
      this.latestRelease = release ?? undefined;
      const updateAvailable = Boolean(
        release && isNewerVersion(release.version, this.currentVersion)
      );
      this.renderStatusBar(updateAvailable);
      if (updateAvailable && options.notify !== false) {
        await this.maybeNotify(release!);
      }
      return release;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.renderStatusBar(false, message);
      return null;
    } finally {
      this.checking = false;
    }
  }

  async downloadAndInstallUpdate(): Promise<void> {
    const release = this.latestRelease ?? (await this.checkForUpdates({ notify: false }));
    if (!release) {
      void vscode.window.showInformationMessage("No release information available.");
      return;
    }
    if (!isNewerVersion(release.version, this.currentVersion)) {
      void vscode.window.showInformationMessage(
        `Commerce MCP Studio ${this.currentVersion} is already up to date.`
      );
      return;
    }

    const config = resolveUpdateConfig();
    const downloadsDir = path.join(os.homedir(), config.downloadDir);
    await fs.promises.mkdir(downloadsDir, { recursive: true });
    const fileName = path.basename(new URL(release.downloadUrl).pathname);
    const targetPath = path.join(downloadsDir, fileName);

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `Downloading Commerce MCP Studio ${release.version}`,
        cancellable: false,
      },
      async () => {
        const response = await fetch(release.downloadUrl);
        if (!response.ok) {
          throw new Error(`Download failed (${response.status})`);
        }
        const buffer = Buffer.from(await response.arrayBuffer());
        await fs.promises.writeFile(targetPath, buffer);
      }
    );

    await this.installVsix(targetPath, release.version);
  }

  private async installVsix(vsixPath: string, version: string): Promise<void> {
    const cliPath = process.platform === "win32" ? "code.cmd" : "code";
    await new Promise<void>((resolve, reject) => {
      const child = spawn(cliPath, ["--install-extension", vsixPath, "--force"], {
        stdio: "pipe",
        shell: process.platform === "win32",
      });
      let stderr = "";
      child.stderr.on("data", (chunk: Buffer) => {
        stderr += chunk.toString();
      });
      child.on("error", reject);
      child.on("close", (code) => {
        if (code === 0) resolve();
        else reject(new Error(stderr.trim() || `Install failed with exit code ${code}`));
      });
    });

    const restart = await vscode.window.showInformationMessage(
      `Commerce MCP Studio ${version} installed. Restart VS Code to use the new version?`,
      "Restart Now",
      "Later"
    );
    if (restart === "Restart Now") {
      await vscode.commands.executeCommand("workbench.action.reloadWindow");
    }
  }

  private renderStatusBar(updateAvailable: boolean, errorMessage?: string): void {
    if (errorMessage) {
      this.statusBarItem.text = "$(cloud-offline) CT MCP";
      this.statusBarItem.tooltip = `Update check failed: ${errorMessage}`;
      return;
    }
    if (updateAvailable && this.latestRelease) {
      this.statusBarItem.text = "$(arrow-up) CT MCP Studio";
      this.statusBarItem.tooltip = `Update available: ${this.latestRelease.version} (current ${this.currentVersion}). Click to check for updates.`;
      this.statusBarItem.backgroundColor = new vscode.ThemeColor(
        "statusBarItem.warningBackground"
      );
      return;
    }
    this.statusBarItem.backgroundColor = undefined;
    this.statusBarItem.text = "$(check) CT MCP Studio";
    this.statusBarItem.tooltip = `Commerce MCP Studio ${this.currentVersion} is up to date. Click to check for updates.`;
  }

  private async maybeNotify(release: LatestRelease): Promise<void> {
    if (release.mandatory) {
      await this.promptMandatoryUpdate(release);
      return;
    }

    const dismissed = this.context.globalState.get<string>(DISMISSED_VERSION_KEY);
    if (dismissed === release.version) return;

    await this.promptOptionalUpdate(release);
  }

  private buildUpdateMessage(release: LatestRelease): string {
    const headline = release.summary ?? `Commerce MCP Studio ${release.version} is available.`;
    const bullets =
      release.highlights?.slice(0, 3) ??
      release.releaseNotes?.slice(0, 3) ??
      [];
    if (!bullets.length) return headline;
    return `${headline}\n${bullets.map((item) => `• ${item}`).join("\n")}`;
  }

  private async promptMandatoryUpdate(release: LatestRelease): Promise<void> {
    const choice = await vscode.window.showWarningMessage(
      this.buildUpdateMessage(release),
      { modal: true },
      "Update Now",
      "View Release Notes",
      "View on Website"
    );

    if (choice === "Update Now") {
      await this.downloadAndInstallUpdate();
      return;
    }
    if (choice === "View Release Notes") {
      await vscode.commands.executeCommand("ctMcp.openReleaseNotes", release.version);
      return;
    }
    if (choice === "View on Website" && release.releaseNotesUrl) {
      await vscode.env.openExternal(vscode.Uri.parse(release.releaseNotesUrl));
    }
  }

  private async promptOptionalUpdate(release: LatestRelease): Promise<void> {
    const choice = await vscode.window.showInformationMessage(
      this.buildUpdateMessage(release),
      "Update Now",
      "View Release Notes",
      "View on Website",
      "Remind Me Later"
    );

    if (choice === "Update Now") {
      await this.downloadAndInstallUpdate();
      return;
    }
    if (choice === "View Release Notes") {
      await vscode.commands.executeCommand("ctMcp.openReleaseNotes", release.version);
      return;
    }
    if (choice === "View on Website" && release.releaseNotesUrl) {
      await vscode.env.openExternal(vscode.Uri.parse(release.releaseNotesUrl));
      return;
    }
    if (choice === "Remind Me Later") {
      await this.context.globalState.update(DISMISSED_VERSION_KEY, release.version);
    }
  }
}

let updateService: UpdateService | undefined;

export function getUpdateService(context: vscode.ExtensionContext): UpdateService {
  if (!updateService) {
    updateService = new UpdateService(context);
  }
  return updateService;
}

export function disposeUpdateService(): void {
  updateService?.dispose();
  updateService = undefined;
}
