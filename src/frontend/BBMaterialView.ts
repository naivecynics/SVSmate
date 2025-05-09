import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as PathManager from '../utils/pathManager';

export class BBMaterialViewProvider implements vscode.TreeDataProvider<BBMaterialItem>, vscode.Disposable {
  private _onDidChangeTreeData = new vscode.EventEmitter<BBMaterialItem | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;
  private rootPath: string = '';
  private watcher?: vscode.FileSystemWatcher;

  private constructor() {}

  public static create(): BBMaterialViewProvider {
    const provider = new BBMaterialViewProvider();
    provider.rootPath = PathManager.getDir('bb');

    const pattern = new vscode.RelativePattern(provider.rootPath, '**/*.json');
    provider.watcher = vscode.workspace.createFileSystemWatcher(pattern);
    provider.watcher.onDidChange(() => provider.refresh());
    provider.watcher.onDidCreate(() => provider.refresh());
    provider.watcher.onDidDelete(() => provider.refresh());

    return provider;
  }

  refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }

  getTreeItem(element: BBMaterialItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: BBMaterialItem): Promise<BBMaterialItem[]> {
    // 展开虚拟 .json 节点的子项
    if (element?.meta && element.realPath) {
      return element.meta.map((f: any) => {
        const item = new BBMaterialItem(
          f.name,
          vscode.TreeItemCollapsibleState.None,
          vscode.Uri.parse(f.url),
          f.name,
          element.realPath
        );
        item.command = {
          command: 'vscode.open',
          title: 'Open in Browser',
          arguments: [vscode.Uri.parse(f.url)]
        };
        item.tooltip = f.url;
        item.description = '(remote)';
        return item;
      });
    }

    const targetPath = element?.realPath ?? this.rootPath;
    const result: BBMaterialItem[] = [];

    let stats: fs.Stats;
    try {
      stats = await fs.promises.stat(targetPath);
    } catch (err) {
      vscode.window.showWarningMessage(`Cannot access path: ${targetPath}`);
      return [];
    }

    if (!stats.isDirectory()) { return []; }

    const entries = await fs.promises.readdir(targetPath);
    for (const name of entries) {
      if (name.startsWith('.')) { continue; }

      const fullPath = path.join(targetPath, name);
      let stat: fs.Stats;
      try {
        stat = await fs.promises.stat(fullPath);
      } catch {
        continue;
      }

      if (stat.isDirectory()) {
        result.push(new BBMaterialItem(
          name,
          vscode.TreeItemCollapsibleState.Collapsed,
          vscode.Uri.file(fullPath),
          name,
          fullPath
        ));
      } else if (name.endsWith('.json')) {
        try {
          const raw = await fs.promises.readFile(fullPath, 'utf-8');
          const parsed = JSON.parse(raw);

          const label = path.basename(name, '.json');
          const virtualFolder = new BBMaterialItem(
            label,
            vscode.TreeItemCollapsibleState.Collapsed,
            vscode.Uri.file(fullPath),
            name,
            fullPath,
          );

          if (parsed.description) {
            virtualFolder.tooltip = parsed.description;
          }

          virtualFolder.contextValue = 'jsonFolder';
          virtualFolder.meta = parsed.files || [];

          result.push(virtualFolder);
        } catch (err) {
          vscode.window.showWarningMessage(`Failed to read json: ${name}`);
        }
      }
    }

    return result;
  }

  dispose(): void {
    this.watcher?.dispose();
  }
}

export class BBMaterialItem extends vscode.TreeItem {
  meta?: any[];

  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly resourceUri: vscode.Uri,
    filename?: string,
    public readonly realPath?: string
  ) {
    super(label, collapsibleState);

    const ext = path.extname(filename || label).toLowerCase();
    // this.iconPath = new vscode.ThemeIcon(
    //   collapsibleState === vscode.TreeItemCollapsibleState.None
    //     ? this.getFileIconName(ext)
    //     : 'folder'
    // );
    this.iconPath = vscode.ThemeIcon.Folder;

    const bbRoot = PathManager.getDir('bb');
    const fsPath = realPath ?? resourceUri.fsPath;

    try {
      const relPath = path.relative(bbRoot, fsPath);
      const depth = relPath.split(path.sep).length;

      if (collapsibleState !== vscode.TreeItemCollapsibleState.None) {
        if (depth === 1) {
          this.contextValue = 'termFolder';
        } else if (depth === 2) {
          this.contextValue = 'courseFolder';
        } else {
          this.contextValue = 'folder';
        }
      } else {
        this.contextValue = 'file';
      }
    } catch {
      this.contextValue = 'file';
    }
  }

  private getFileIconName(ext: string): string {
    switch (ext) {
      case '.md': return 'markdown';
      case '.pdf': return 'file-pdf';
      case '.doc':
      case '.docx': return 'file-word';
      case '.ppt':
      case '.pptx': return 'file-powerpoint';
      case '.json': return 'code';
      default: return 'file';
    }
  }
}
