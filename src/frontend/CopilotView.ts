import * as vscode from "vscode";

export class CopilotViewProvider implements vscode.WebviewViewProvider, vscode.Disposable {
  private constructor() {}

  public static create(): CopilotViewProvider {
    return new CopilotViewProvider();
  }

  resolveWebviewView(webviewView: vscode.WebviewView) {
    webviewView.webview.options = { enableScripts: true };
    webviewView.webview.html = this.getHtml();
  }

  private getHtml(): string {
    return `
      <!DOCTYPE html>
      <html>
        <body>
          <h2>GitHub Copilot</h2>
          <button onclick="openCopilot()">Open Copilot</button>
          <script>
            function openCopilot() {
              window.open("https://github.com/features/copilot");
            }
          </script>
        </body>
      </html>
    `;
  }

  public dispose(): void {
    // 目前无资源需要释放，但保持结构完整
  }
}
