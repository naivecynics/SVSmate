import * as vscode from "vscode";

/**
 * Provides a webview for interacting with GitHub Copilot.
 * Implements WebviewViewProvider to integrate the webview into VS Code.
 */
export class CopilotViewProvider implements vscode.WebviewViewProvider, vscode.Disposable {
  /**
   * Private constructor to enforce the use of the static create method.
   */
  private constructor() {}

  /**
   * Factory method to create a new instance of CopilotViewProvider.
   * @returns A new instance of CopilotViewProvider.
   */
  public static create(): CopilotViewProvider {
    return new CopilotViewProvider();
  }

  /**
   * Resolves the webview view by setting its options and HTML content.
   * @param webviewView - The webview view to resolve.
   */
  resolveWebviewView(webviewView: vscode.WebviewView) {
    webviewView.webview.options = { enableScripts: true };
    webviewView.webview.html = this.getHtml();
  }

  /**
   * Generates the HTML content for the webview.
   * @returns A string containing the HTML content.
   */
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

  /**
   * Disposes of any resources used by the provider.
   * Currently, no resources need to be released, but the method is included for completeness.
   */
  public dispose(): void {
    // 目前无资源需要释放，但保持结构完整
  }
}
