import * as vscode from "vscode";

export function mediaRoot(extensionUri: vscode.Uri): vscode.Uri {
  return vscode.Uri.joinPath(extensionUri, "media");
}

export function logoUri(webview: vscode.Webview, extensionUri: vscode.Uri): string {
  return webview
    .asWebviewUri(vscode.Uri.joinPath(mediaRoot(extensionUri), "logo.png"))
    .toString();
}
