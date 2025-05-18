import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as PathManager from '../utils/pathManager';

/**
 * Provides a tree view of parsed Blackboard course materials.
 * Watches `.json` files and course content folders for live updates.
 */
export class BBMaterialViewProvider implements vscode.TreeDataProvider<BBMaterialItem>, vscode.Disposable {
    private _onDidChangeTreeData = new vscode.EventEmitter<BBMaterialItem | undefined>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    private rootPath: string = '';
    private watcher?: vscode.FileSystemWatcher;

    private constructor() {}

    /**
     * Factory method to create and initialize the view provider.
     */
    public static create(): BBMaterialViewProvider {
        const provider = new BBMaterialViewProvider();
        provider.rootPath = PathManager.getDir('bb');

        // Watch JSON file changes
        const pattern = new vscode.RelativePattern(provider.rootPath, '**/*.json');
        provider.watcher = vscode.workspace.createFileSystemWatcher(pattern);
        provider.watcher.onDidChange(() => provider.refresh());
        provider.watcher.onDidCreate(() => provider.refresh());
        provider.watcher.onDidDelete(() => provider.refresh());

        // Watch all file/folder changes (for folders and subfiles)
        const allPattern = new vscode.RelativePattern(provider.rootPath, '**/*');
        const allWatcher = vscode.workspace.createFileSystemWatcher(allPattern);
        allWatcher.onDidChange(() => provider.refresh());
        allWatcher.onDidCreate(() => provider.refresh());
        allWatcher.onDidDelete(() => provider.refresh());

        // Attach watcher to instance to prevent GC (as a symbol-like private field)
        (provider as any)._extraWatcher = allWatcher;

        return provider;
    }

    /**
     * Triggers a refresh of the entire tree view.
     */
    refresh(): void {
        this._onDidChangeTreeData.fire(undefined);
    }

    getTreeItem(element: BBMaterialItem): vscode.TreeItem {
        return element;
    }

    /**
     * Gets the children for a given tree node. If the node is a JSON virtual folder,
     * it expands its embedded metadata. Otherwise, loads the file/folder structure from disk.
     * 
     * @param element - Optional tree item (if undefined, returns root level).
     */
    async getChildren(element?: BBMaterialItem): Promise<BBMaterialItem[]> {
        // Expand metadata if the item represents a parsed JSON node
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
        } catch {
            vscode.window.showWarningMessage(`Cannot access path: ${targetPath}`);
            return [];
        }

        if (!stats.isDirectory()) {return [];}

        const entries = await fs.promises.readdir(targetPath);
        for (const name of entries) {
            if (name.startsWith('.')) {continue;}

            const fullPath = path.join(targetPath, name);
            let stat: fs.Stats;
            try {
                stat = await fs.promises.stat(fullPath);
            } catch {
                continue;
            }

            // Handle directories
            if (stat.isDirectory()) {
                result.push(new BBMaterialItem(
                    name,
                    vscode.TreeItemCollapsibleState.Collapsed,
                    vscode.Uri.file(fullPath),
                    name,
                    fullPath
                ));
            }
            // Handle JSON virtual folders
            else if (name.endsWith('.json')) {
                try {
                    const raw = await fs.promises.readFile(fullPath, 'utf-8');
                    const parsed = JSON.parse(raw);
                    const label = path.basename(name, '.json');

                    const virtualFolder = new BBMaterialItem(
                        label,
                        vscode.TreeItemCollapsibleState.Collapsed,
                        vscode.Uri.file(fullPath),
                        name,
                        fullPath
                    );

                    if (parsed.description) {
                        virtualFolder.tooltip = parsed.description;
                    }

                    virtualFolder.contextValue = 'jsonFolder';
                    virtualFolder.meta = parsed.files || [];

                    result.push(virtualFolder);
                } catch {
                    vscode.window.showWarningMessage(`Failed to read json: ${name}`);
                }
            }
        }

        return result;
    }

    /**
     * Disposes all file watchers.
     */
    dispose(): void {
        this.watcher?.dispose();
        (this as any)._extraWatcher?.dispose();
    }
}

/**
 * Represents a node in the Blackboard material tree view.
 * Can be a file, folder, or a virtual folder parsed from a JSON file.
 */
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
        // Use folder icon for all items
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

    /**
     * Gets a file-specific icon name based on its extension.
     * (Currently unused, but can be enabled for more specific visuals.)
     */
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
