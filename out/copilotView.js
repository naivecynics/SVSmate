"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CopilotViewProvider = void 0;
class CopilotViewProvider {
    resolveWebviewView(webviewView) {
        webviewView.webview.options = { enableScripts: true };
        webviewView.webview.html = this.getHtml();
    }
    /**
     * AI-generated-content
     * tool: vscode-copilot
     * version: 1.98.0
     * usage: create tree items for the copilot view
     **/
    getHtml() {
        return `
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
}
exports.CopilotViewProvider = CopilotViewProvider;
//# sourceMappingURL=copilotView.js.map