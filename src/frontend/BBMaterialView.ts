import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as PathManager from '../utils/pathManager';

/**
 * A tree data provider for parsed Blackboard course materials.
 * Watches for live updates in `.json` files and course content folders.
 */
export class BBMaterialViewProvider implements vscode.TreeDataProvider<BBMaterialItem>, vscode.Disposable {
  private _onDidChangeTreeData = new vscode.EventEmitter<BBMaterialItem | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private rootPath = PathManager.getDir('bb');
  private watcher?: vscode.FileSystemWatcher;
  private extraWatcher?: vscode.FileSystemWatcher;

  private constructor() { }

  /**
   * Factory method to initialize the view provider and file watchers.
   * @returns Initialized BBMaterialViewProvider instance
   */
  public static create(): BBMaterialViewProvider {
    const provider = new BBMaterialViewProvider();

    const jsonPattern = new vscode.RelativePattern(provider.rootPath, '**/*.json');
    provider.watcher = vscode.workspace.createFileSystemWatcher(jsonPattern);
    provider.watcher.onDidChange(() => provider.refresh());
    provider.watcher.onDidCreate(() => provider.refresh());
    provider.watcher.onDidDelete(() => provider.refresh());

    const allPattern = new vscode.RelativePattern(provider.rootPath, '**/*');
    provider.extraWatcher = vscode.workspace.createFileSystemWatcher(allPattern);
    provider.extraWatcher.onDidChange(() => provider.refresh());
    provider.extraWatcher.onDidCreate(() => provider.refresh());
    provider.extraWatcher.onDidDelete(() => provider.refresh());

    return provider;
  }

  /**
   * Triggers a full refresh of the view.
   */
  refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }

  getTreeItem(element: BBMaterialItem): vscode.TreeItem {
    return element;
  }

  /**
   * Provides children for a given tree item.
   * @param element Optional tree item. If undefined, returns root-level items.
   * @returns List of tree items representing subfolders or JSON content.
   */
  async getChildren(element?: BBMaterialItem): Promise<BBMaterialItem[]> {
    if (element?.meta && element.realPath) {
      return element.meta.map((f) => {
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

    const dirPath = element?.realPath ?? this.rootPath;
    try {
      const stats = await fs.promises.stat(dirPath);
      if (!stats.isDirectory()) { return []; }
    } catch {
      vscode.window.showWarningMessage(`Cannot access path: ${dirPath}`);
      return [];
    }

    const entries = await fs.promises.readdir(dirPath);
    const result: BBMaterialItem[] = [];

    for (const name of entries) {
      if (name.startsWith('.')) { continue; }
      const fullPath = path.join(dirPath, name);
      try {
        const stat = await fs.promises.stat(fullPath);

        if (stat.isDirectory()) {
          result.push(new BBMaterialItem(
            name,
            vscode.TreeItemCollapsibleState.Collapsed,
            vscode.Uri.file(fullPath),
            name,
            fullPath
          ));
        } else if (name.endsWith('.json')) {
          const raw = await fs.promises.readFile(fullPath, 'utf-8');
          const parsed = JSON.parse(raw);
          const label = path.basename(name, '.json');

          const virtualItem = new BBMaterialItem(
            label,
            vscode.TreeItemCollapsibleState.Collapsed,
            vscode.Uri.file(fullPath),
            name,
            fullPath
          );

          virtualItem.tooltip = parsed.description || undefined;
          virtualItem.contextValue = 'jsonFolder';
          virtualItem.meta = parsed.files || [];

          result.push(virtualItem);
        }
      } catch {
        continue;
      }
    }

    return result;
  }

  /**
   * Disposes file watchers to prevent memory leaks.
   */
  dispose(): void {
    this.watcher?.dispose();
    this.extraWatcher?.dispose();
  }
}

/**
 * Represents a node in the Blackboard material tree view.
 */
export class BBMaterialItem extends vscode.TreeItem {
  meta?: any[];

  constructor(
    label: string,
    collapsibleState: vscode.TreeItemCollapsibleState,
    resourceUri: vscode.Uri,
    filename: string,
    public readonly realPath?: string
  ) {
    super(label, collapsibleState);
    this.resourceUri = vscode.Uri.file(realPath ?? resourceUri.fsPath);
    const ext = path.extname(filename || label).toLowerCase();

    if (collapsibleState === vscode.TreeItemCollapsibleState.None) {
      this.iconPath = BBMaterialItem.getFileIconByExt(ext);
    }

    /* ── contextValue（右键菜单用）────────────────────────── */
    try {
      const bbRoot = PathManager.getDir('bb');
      const rel = path.relative(bbRoot, realPath ?? resourceUri.fsPath);
      const depth = rel.split(path.sep).length;

      this.contextValue =
        collapsibleState === vscode.TreeItemCollapsibleState.None
          ? 'file'
          : depth === 1
            ? 'termFolder'
            : depth === 2
              ? 'courseFolder'
              : 'folder';
    } catch {
      this.contextValue =
        collapsibleState === vscode.TreeItemCollapsibleState.None ? 'file' : 'folder';
    }
  }

  /**
  * Returns a VS Code ThemeIcon name based on file extension.
  * Used to visually distinguish different file types in the tree view.
  */
  static getFileIconByExt(ext: string): vscode.ThemeIcon {
    switch (ext) {
      case '.md': return new vscode.ThemeIcon('markdown');
      case '.pdf': return new vscode.ThemeIcon('file-pdf');
      case '.doc':
      case '.docx': return new vscode.ThemeIcon('file-word');
      case '.xls':
      case '.xlsx': return new vscode.ThemeIcon('file-excel');
      case '.ppt':
      case '.pptx': return new vscode.ThemeIcon('file-powerpoint');
      case '.ipynb': return new vscode.ThemeIcon('notebook');
      case '.zip':
      case '.rar':
      case '.7z':
      case '.tar':
      case '.gz': return new vscode.ThemeIcon('file-zip');
      case '.json': return new vscode.ThemeIcon('code');
      case '.txt':
      case '.log': return new vscode.ThemeIcon('file-text');
      case '.png':
      case '.jpg':
      case '.jpeg':
      case '.gif':
      case '.svg': return new vscode.ThemeIcon('file-media');
      case '.py': return new vscode.ThemeIcon('symbol-function');
      case '.c':
      case '.cpp':
      case '.h':
      case '.hpp': return new vscode.ThemeIcon('symbol-namespace');
      default: return new vscode.ThemeIcon('file');
    }
  }
}


