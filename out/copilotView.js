"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CopilotViewProvider = void 0;
class CopilotViewProvider {
    resolveWebviewView(webviewView) {
        webviewView.webview.options = { enableScripts: true };
        webviewView.webview.html = this.getHtml();
    }
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