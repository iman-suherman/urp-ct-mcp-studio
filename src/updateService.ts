import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import { resolveUpdateConfig } from "./config";
import { LatestRelease, RegistryClient } from "./registryClient";
import { isNewerVersion } from "./semver";

export const AUTO_UPDATE_CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000;
export const LAST_SUGGESTED_UPDATE_VERSION_KEY = "ctMcp.lastSuggestedUpdateVersion";
export const PENDING_RELOAD_VERSION_KEY = "ctMcp.pendingReloadVersion";

export type UpdatePhase = "idle" | "checking" | "downloading" | "installing" | "installed";

export interface ExtensionUpdateState {
  currentVersion: string;
  latestVersion?: string;
  updateAvailable: boolean;
  updateNotes: string[];
  updatePhase: UpdatePhase;
  updateProgress?: number;
  updateError?: string;
  autoUpdateExtension: boolean;
}

export interface UpdateProgress {
  phase: "downloading" | "installing";
  percent: number;
}

const DOWNLOAD_PROGRESS_MAX = 90;
const INSTALL_PROGRESS = 95;
const VISIBILITY_CHECK_THROTTLE_MS = 5 * 60 * 1000;

function downloadProgressPercent(downloaded: number, totalBytes?: number): number {
  if (totalBytes && totalBytes > 0) {
    return Math.min(
      DOWNLOAD_PROGRESS_MAX,
      Math.round((downloaded / totalBytes) * DOWNLOAD_PROGRESS_MAX)
    );
  }
  return Math.min(85, Math.floor(downloaded / 200_000));
}

export class UpdateService implements vscode.Disposable {
  private readonly registry: RegistryClient;
  private readonly currentVersion: string;
  private readonly changeEmitter = new vscode.EventEmitter<void>();
  readonly onDidChange = this.changeEmitter.event;

  private intervalId: ReturnType<typeof setInterval> | undefined;
  private latestRelease: LatestRelease | undefined;
  private checking = false;
  private installing = false;
  private phase: UpdatePhase = "idle";
  private updateProgress: number | undefined;
  private updateError: string | undefined;
  private lastCheckAt = 0;

  constructor(private readonly context: vscode.ExtensionContext) {
    this.currentVersion = context.extension.packageJSON.version as string;
    const config = resolveUpdateConfig();
    this.registry = new RegistryClient(config.registryApiUrl, config.pluginId);
  }

  start(): void {
    void this.initializePhase();
    void this.runAutoUpdateCheck();
    this.intervalId = setInterval(() => {
      void this.runAutoUpdateCheck();
    }, AUTO_UPDATE_CHECK_INTERVAL_MS);
    this.context.subscriptions.push({
      dispose: () => {
        if (this.intervalId) clearInterval(this.intervalId);
      },
    });
  }

  dispose(): void {
    this.changeEmitter.dispose();
    if (this.intervalId) clearInterval(this.intervalId);
  }

  getLatestRelease(): LatestRelease | undefined {
    return this.latestRelease;
  }

  hasUpdateAvailable(): boolean {
    return Boolean(
      this.latestRelease &&
        isNewerVersion(this.latestRelease.version, this.currentVersion) &&
        this.resolvePhase() !== "installed"
    );
  }

  isAutoUpdateEnabled(): boolean {
    const config = vscode.workspace.getConfiguration("ctMcp");
    if (config.has("autoUpdateExtension")) {
      return config.get<boolean>("autoUpdateExtension", true);
    }
    return config.get<boolean>("updateCheckEnabled", true);
  }

  async setAutoUpdateEnabled(enabled: boolean): Promise<void> {
    const config = vscode.workspace.getConfiguration("ctMcp");
    await config.update("autoUpdateExtension", enabled, vscode.ConfigurationTarget.Global);
    this.notifyChanged();
    if (enabled) {
      await this.checkForUpdates({ force: true, suggestUpgrade: true });
    }
  }

  getState(): ExtensionUpdateState {
    const resolvedPhase = this.resolvePhase();
    const latestVersion = this.latestRelease?.version;
    const updateAvailable =
      resolvedPhase === "installed"
        ? false
        : Boolean(latestVersion && isNewerVersion(latestVersion, this.currentVersion));

    let progress: number | undefined;
    if (resolvedPhase === "installed") {
      progress = 100;
    } else if (resolvedPhase === "downloading" || resolvedPhase === "installing") {
      progress = this.updateProgress;
    }

    return {
      currentVersion: this.currentVersion,
      latestVersion,
      updateAvailable,
      updateNotes: this.buildReleaseNotes(this.latestRelease),
      updatePhase: resolvedPhase,
      updateProgress: progress,
      updateError: this.updateError,
      autoUpdateExtension: this.isAutoUpdateEnabled(),
    };
  }

  async checkOnPanelVisible(force = false): Promise<void> {
    if (!this.isAutoUpdateEnabled()) {
      return;
    }
    await this.checkForUpdates({
      force,
      suggestUpgrade: true,
      throttleMs: VISIBILITY_CHECK_THROTTLE_MS,
    });
  }

  async runAutoUpdateCheck(): Promise<void> {
    if (!this.isAutoUpdateEnabled()) {
      return;
    }
    await this.checkForUpdates({ force: true, suggestUpgrade: true });
  }

  async checkForUpdates(
    options: {
      notify?: boolean;
      force?: boolean;
      suggestUpgrade?: boolean;
      throttleMs?: number;
    } = {}
  ): Promise<LatestRelease | null> {
    const config = resolveUpdateConfig();
    if (!config.updateCheckEnabled && !this.isAutoUpdateEnabled()) {
      return null;
    }
    if (this.checking) {
      return this.latestRelease ?? null;
    }

    const now = Date.now();
    const throttleMs = options.throttleMs ?? 0;
    if (!options.force && throttleMs > 0 && now - this.lastCheckAt < throttleMs) {
      return this.latestRelease ?? null;
    }

    this.checking = true;
    if (this.resolvePhase() !== "installed") {
      this.setPhase("checking");
    }

    try {
      this.lastCheckAt = now;
      const release = await this.registry.fetchLatestRelease(config.updateChannel);
      this.latestRelease = release ?? undefined;
      this.updateError = undefined;

      const updateAvailable = Boolean(
        release && isNewerVersion(release.version, this.currentVersion)
      );

      if (this.resolvePhase() !== "installed") {
        this.setPhase("idle");
      }

      if (updateAvailable && options.suggestUpgrade !== false) {
        await this.maybeSuggestUpgrade(release!, options.notify !== false);
      }

      this.notifyChanged();
      return release;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.updateError = message;
      if (this.resolvePhase() !== "installed") {
        this.setPhase("idle", message);
      } else {
        this.notifyChanged();
      }
      return null;
    } finally {
      this.checking = false;
    }
  }

  async installUpdate(): Promise<void> {
    if (this.installing) {
      return;
    }

    let release = this.latestRelease;
    if (!release) {
      release = (await this.checkForUpdates({ notify: false, force: true })) ?? undefined;
    }
    if (!release) {
      this.updateError = "Could not find a release to install.";
      this.setPhase("idle", this.updateError);
      return;
    }
    if (!isNewerVersion(release.version, this.currentVersion)) {
      this.setPhase("idle");
      return;
    }

    this.installing = true;
    this.updateError = undefined;
    this.setPhase("downloading", undefined, 0);

    try {
      const vsixPath = await this.downloadVsix(release, (progress) => {
        this.setPhase(progress.phase, undefined, progress.percent);
      });

      this.setPhase("installing", undefined, INSTALL_PROGRESS);
      await vscode.commands.executeCommand(
        "workbench.extensions.installExtension",
        vscode.Uri.file(vsixPath)
      );
      this.setPhase("installing", undefined, 100);

      await this.context.globalState.update(PENDING_RELOAD_VERSION_KEY, release.version);
      await this.context.globalState.update(LAST_SUGGESTED_UPDATE_VERSION_KEY, release.version);
      this.setPhase("installed");

      const restart = await vscode.window.showInformationMessage(
        `Commerce MCP Studio updated to v${release.version}. Reload the window to finish.`,
        "Reload window",
        "Later"
      );
      if (restart === "Reload window") {
        await this.reloadWindow();
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.setPhase("idle", message);
    } finally {
      this.installing = false;
    }
  }

  async reloadWindow(): Promise<void> {
    await this.context.globalState.update(PENDING_RELOAD_VERSION_KEY, undefined);
    await vscode.commands.executeCommand("workbench.action.reloadWindow");
  }

  /** @deprecated Use installUpdate() from the Studio panel. */
  async downloadAndInstallUpdate(): Promise<void> {
    await this.installUpdate();
  }

  private async initializePhase(): Promise<void> {
    const pending = await this.getPendingReloadVersion();
    if (pending) {
      this.phase = "installed";
      this.updateProgress = 100;
    }
  }

  private resolvePhase(): UpdatePhase {
    if (this.phase === "installed") {
      return "installed";
    }
    const pending = this.context.globalState.get<string>(PENDING_RELOAD_VERSION_KEY);
    if (pending?.trim()) {
      return "installed";
    }
    return this.phase;
  }

  private async getPendingReloadVersion(): Promise<string | undefined> {
    const value = this.context.globalState.get<string>(PENDING_RELOAD_VERSION_KEY);
    return value?.trim() || undefined;
  }

  private setPhase(phase: UpdatePhase, error?: string, progress?: number): void {
    this.phase = phase;
    this.updateError = error;
    this.updateProgress = progress;
    this.notifyChanged();
  }

  private notifyChanged(): void {
    this.changeEmitter.fire();
  }

  private buildReleaseNotes(release?: LatestRelease): string[] {
    if (!release) {
      return [];
    }
    if (release.highlights?.length) {
      return release.highlights.slice(0, 5);
    }
    if (release.releaseNotes?.length) {
      return release.releaseNotes.slice(0, 5);
    }
    if (release.summary?.trim()) {
      return [release.summary.trim()];
    }
    return [];
  }

  private async maybeSuggestUpgrade(
    release: LatestRelease,
    showNotification: boolean
  ): Promise<void> {
    if (!showNotification || !this.isAutoUpdateEnabled()) {
      return;
    }

    const lastSuggested = this.context.globalState.get<string>(LAST_SUGGESTED_UPDATE_VERSION_KEY);
    if (lastSuggested === release.version) {
      return;
    }

    await this.context.globalState.update(LAST_SUGGESTED_UPDATE_VERSION_KEY, release.version);

    const headline = release.summary ?? `Commerce MCP Studio ${release.version} is available.`;
    const choice = await vscode.window.showInformationMessage(
      headline,
      "Install update",
      "Later"
    );
    if (choice === "Install update") {
      await this.installUpdate();
    }
  }

  private async downloadVsix(
    release: LatestRelease,
    onProgress?: (progress: UpdateProgress) => void
  ): Promise<string> {
    const storageDir = this.context.globalStorageUri.fsPath;
    await fs.promises.mkdir(storageDir, { recursive: true });
    const fileName = `ct-mcp-studio-${release.version}.vsix`;
    const targetPath = path.join(storageDir, fileName);

    const response = await fetch(release.downloadUrl);
    if (!response.ok) {
      throw new Error(`Download failed (${response.status})`);
    }

    const contentLength = response.headers.get("content-length");
    const totalBytes = contentLength ? Number.parseInt(contentLength, 10) : undefined;
    const validTotal =
      totalBytes && Number.isFinite(totalBytes) && totalBytes > 0 ? totalBytes : undefined;

    const reportDownload = (downloaded: number): void => {
      onProgress?.({
        phase: "downloading",
        percent: downloadProgressPercent(downloaded, validTotal),
      });
    };

    const body = response.body;
    if (!body) {
      reportDownload(0);
      const buffer = Buffer.from(await response.arrayBuffer());
      reportDownload(buffer.byteLength);
      await fs.promises.writeFile(targetPath, buffer);
      return targetPath;
    }

    const reader = body.getReader();
    const chunks: Uint8Array[] = [];
    let downloaded = 0;
    reportDownload(0);

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      chunks.push(value);
      downloaded += value.byteLength;
      reportDownload(downloaded);
    }

    await fs.promises.writeFile(
      targetPath,
      Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)))
    );
    return targetPath;
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
