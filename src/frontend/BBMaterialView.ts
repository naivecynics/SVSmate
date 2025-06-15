import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as PathManager from '../utils/pathManager';

/**
 * Provides a tree view of parsed Blackboard course materials.
 * Watches `.json` files and folders for live updates.
 */
export class BBMaterialViewProvider implements vscode.TreeDataProvider<BBMaterialItem>, vscode.Disposable {
  private _onDidChangeTreeData = new vscode.EventEmitter<BBMaterialItem | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private rootPath = PathManager.getDir('bb');
  private watcher?: vscode.FileSystemWatcher;
  private extraWatcher?: vscode.FileSystemWatcher;

  private constructor() {}

  /**
   * Initializes file watchers and returns the view provider instance.
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
   * Triggers a UI refresh of the tree view.
   */
  refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }

  getTreeItem(element: BBMaterialItem): vscode.TreeItem {
    return element;
  }

  /**
   * Returns the children of a given node.
   * If `element` is undefined, root-level items are returned.
   */
  async getChildren(element?: BBMaterialItem): Promise<BBMaterialItem[]> {
    if (element?.meta && element.realPath) {
      // Leaf nodes (remote file entries in .json metadata)
      return element.meta.map((f) => {
        const item = new BBMaterialItem(
          f.name,
          vscode.TreeItemCollapsibleState.None,
          vscode.Uri.parse(f.url), // used only for display, not file access
          f.name,
          element.realPath
        );
        item.command = {
          command: 'vscode.open',
          title: 'Open in Browser',
          arguments: [vscode.Uri.parse(f.url)],
        };
        item.tooltip = f.url;
        item.description = '(remote)';
        item.contextValue = 'file';
        item.fileUrl = f.url;
        return item;
      });
    }

    // Folder or .json file with nested data
    const dirPath = element?.realPath ?? this.rootPath;
    try {
      const stats = await fs.promises.stat(dirPath);
      if (!stats.isDirectory()) {return [];}
    } catch {
      vscode.window.showWarningMessage(`Cannot access path: ${dirPath}`);
      return [];
    }

    const entries = await fs.promises.readdir(dirPath);
    const result: BBMaterialItem[] = [];

    for (const name of entries) {
      if (name.startsWith('.')) {continue;}

      const fullPath = path.join(dirPath, name);
      try {
        const stat = await fs.promises.stat(fullPath);

        if (stat.isDirectory()) {
          result.push(
            new BBMaterialItem(
              name,
              vscode.TreeItemCollapsibleState.Collapsed,
              vscode.Uri.file(fullPath),
              name,
              fullPath
            )
          );
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
   * Cleanup method to stop file watchers.
   */
  dispose(): void {
    this.watcher?.dispose();
    this.extraWatcher?.dispose();
  }
}

/**
 * Represents a single node (folder or file) in the Blackboard view.
 */
export class BBMaterialItem extends vscode.TreeItem {
  meta?: any[];
  fileUrl?: string;

  constructor(
    label: string,
    collapsibleState: vscode.TreeItemCollapsibleState,
    resourceUri: vscode.Uri,
    filename: string,
    public readonly realPath?: string
  ) {
    super(label, collapsibleState);

    const ext = path.extname(filename || label).toLowerCase();

    if (collapsibleState === vscode.TreeItemCollapsibleState.None) {
      this.iconPath = BBMaterialItem.getFileIconByExt(ext);
    }

    // Context key for right-click menu logic
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

    // 🆕 attach raw path for use in download
    this.resourceUri = resourceUri;
  }

  /**
   * Returns an icon based on file extension.
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
