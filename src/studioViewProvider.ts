import * as vscode from "vscode";
import { logoUri, mediaRoot } from "./media";
import { CommerceMcpManager } from "./mcpManager";
import { renderStudioHtml, StudioUiController } from "./studioUi";
import { UpdateService } from "./updateService";

export class StudioViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewId = "ctMcp.studio";

  private controller: StudioUiController | undefined;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly manager: CommerceMcpManager,
    private readonly updateService: UpdateService
  ) {
    manager.onDidChange(() => {
      void this.controller?.pushState();
    });
    updateService.onDidChange(() => {
      void this.controller?.pushState();
    });
  }

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    const root = mediaRoot(this.context.extensionUri);
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [root],
    };

    this.controller = new StudioUiController(
      this.context,
      this.manager,
      this.updateService,
      {
        postMessage: (message) => webviewView.webview.postMessage(message),
      }
    );

    webviewView.webview.html = renderStudioHtml({
      logoUri: logoUri(webviewView.webview, this.context.extensionUri),
      cspSource: webviewView.webview.cspSource,
    });
    this.controller.bind(webviewView.webview);

    webviewView.onDidChangeVisibility(() => {
      if (webviewView.visible) {
        void this.updateService.checkOnPanelVisible();
        void this.controller?.pushState();
      }
    });
  }

  async refresh(): Promise<void> {
    await this.controller?.pushState();
  }
}
