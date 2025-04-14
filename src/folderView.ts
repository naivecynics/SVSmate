import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";

export class FolderViewProvider implements vscode.TreeDataProvider<FileItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<FileItem | undefined> =
    new vscode.EventEmitter<FileItem | undefined>();
  readonly onDidChangeTreeData: vscode.Event<FileItem | undefined> =
    this._onDidChangeTreeData.event;

  private fileSystemWatcher: vscode.FileSystemWatcher;

  /**
   * AI-generated-content
   * tool: vscode-copilot
   * version: 1.98.0
   * usage: can refresh the tree view when files are created, deleted or changed
   */
  constructor(private workspaceRoot: string) {
    // 创建文件系统监听器
    this.fileSystemWatcher = vscode.workspace.createFileSystemWatcher('**/*');
    
    // 监听文件变化
    this.fileSystemWatcher.onDidCreate(() => this.refresh());
    this.fileSystemWatcher.onDidDelete(() => this.refresh());
    this.fileSystemWatcher.onDidChange(() => this.refresh());
  }

  dispose() {
    // 清理文件系统监听器
    this.fileSystemWatcher.dispose();
  }

  refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }

  getTreeItem(element: FileItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: FileItem): FileItem[] | Thenable<FileItem[]> {
    if (!this.workspaceRoot) {
      vscode.window.showInformationMessage("No workspace folder found");
      return Promise.resolve([]);
    }

    const dirPath = element ? element.resourceUri.fsPath : this.workspaceRoot;
    return Promise.resolve(this.getFiles(dirPath));
  }

  private getFiles(dir: string): FileItem[] {
    if (!fs.existsSync(dir)) return [];

    const items = fs.readdirSync(dir)
      .filter(file => !file.startsWith('.')) // 过滤掉隐藏文件
      .map((file) => {
        const filePath = path.join(dir, file);
        const isDirectory = fs.statSync(filePath).isDirectory();
        return {
          name: file,
          path: filePath,
          isDirectory: isDirectory
        };
      });

    // 先按文件夹在前，文件在后排序
    // 然后在各自组内按名称排序
    return items
      .sort((a, b) => {
        // 首先按文件夹在前排序
        if (a.isDirectory !== b.isDirectory) {
          return a.isDirectory ? -1 : 1;
        }
        // 然后在各自组内按名称排序
        return a.name.localeCompare(b.name);
      })
      .map(item => new FileItem(
        vscode.Uri.file(item.path),
        item.isDirectory
          ? vscode.TreeItemCollapsibleState.Collapsed
          : vscode.TreeItemCollapsibleState.None
      ));
  }
}

export class FileItem extends vscode.TreeItem {
    constructor(
        public readonly resourceUri: vscode.Uri,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState
    ) {
        super(resourceUri, collapsibleState);
        this.tooltip = this.resourceUri.fsPath;
        this.description = undefined;  // 设置为 undefined 来移除 description 的显示
        this.contextValue = collapsibleState === vscode.TreeItemCollapsibleState.Collapsed ? "folder" : "file";

        // 如果不是文件夹，添加点击打开文件的功能
        if (collapsibleState === vscode.TreeItemCollapsibleState.None) {
            this.command = {
                command: 'vscode.open',
                title: '打开文件',
                arguments: [this.resourceUri]
            };
        }
    }
}
