import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as PathManager from '../utils/pathManager';

/**
 * Provides a tree view of parsed Blackboard course materials.
 * Watches `.json` files and course content folders for live updates.
 */
export class BBMaterialViewProvider implements vscode.TreeDataProvider<BBMaterialItem>, vscode.Disposable {
    /** Event emitter for notifying VS Code about data changes */
    private _onDidChangeTreeData = new vscode.EventEmitter<BBMaterialItem | undefined>();
    /** Event that fires when the tree data changes */
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    /** Root path for Blackboard materials */
    private rootPath: string = '';    /** File system watcher for monitoring changes */
    private watcher?: vscode.FileSystemWatcher;    /** Additional file system watcher for all files */
    private allWatcher?: vscode.FileSystemWatcher;
    /** Flag to track if the provider is disposed */
    private _disposed: boolean = false;

    private constructor() {}

    /**
     * Factory method to create and initialize the view provider.
     * Sets up file watchers for `.json` files and all other files/folders.
     * @returns A new instance of BBMaterialViewProvider
     */
    public static create(): BBMaterialViewProvider {
        const provider = new BBMaterialViewProvider();
        provider.rootPath = PathManager.getDir('bb');

        // Watch JSON file changes
        const pattern = new vscode.RelativePattern(provider.rootPath, '**/*.json');
        provider.watcher = vscode.workspace.createFileSystemWatcher(pattern);
        provider.watcher.onDidChange(() => provider.refresh());
        provider.watcher.onDidCreate(() => provider.refresh());
        provider.watcher.onDidDelete(() => provider.refresh());        // Watch all file/folder changes (for folders and subfiles)
        const allPattern = new vscode.RelativePattern(provider.rootPath, '**/*');
        provider.allWatcher = vscode.workspace.createFileSystemWatcher(allPattern);
        provider.allWatcher.onDidChange(() => provider.refresh());
        provider.allWatcher.onDidCreate(() => provider.refresh());
        provider.allWatcher.onDidDelete(() => provider.refresh());

        return provider;
    }    /**
     * Triggers a refresh of the entire tree view.
     */
    refresh(): void {
        try {
            if (!this._disposed && this._onDidChangeTreeData) {
                this._onDidChangeTreeData.fire(undefined);
            }
        } catch (error) {
            console.error('Error refreshing BBMaterialView:', error);
        }
    }

    /**
     * Gets the TreeItem representation of a Blackboard material item.
     * @param element - The Blackboard material item to convert to a TreeItem
     * @returns A TreeItem configured for display
     */
    getTreeItem(element: BBMaterialItem): vscode.TreeItem {
        return element;
    }

    /**
     * Gets the children for a given tree node. If the node is a JSON virtual folder,
     * it expands its embedded metadata. Otherwise, loads the file/folder structure from disk.
     * 
     * @param element - Optional tree item (if undefined, returns root level).
     * @returns A promise resolving to an array of child items
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
                item.command = {                    command: 'vscode.open',
                    title: "Open in Browser",
                    arguments: [vscode.Uri.parse(f.url)]
                };
                item.tooltip = f.url;
                item.description = "(remote)";
                return item;
            });
        }

        const targetPath = element?.realPath ?? this.rootPath;
        const result: BBMaterialItem[] = [];

        let stats: fs.Stats;
        try {
            stats = await fs.promises.stat(targetPath);
        } catch {            vscode.window.showWarningMessage(`Cannot access path: ${targetPath}`);
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

                    result.push(virtualFolder);                } catch {
                    vscode.window.showWarningMessage(`Failed to read json: ${name}`);
                }
            }
        }

        return result;
    }    /**
     * Disposes all file watchers and event emitter.
     */
    dispose(): void {
        if (this._disposed) {
            return;
        }
        
        try {
            this._disposed = true;
            this.watcher?.dispose();
            this.allWatcher?.dispose();
            this._onDidChangeTreeData?.dispose();
        } catch (error) {
            console.error('Error disposing BBMaterialViewProvider:', error);
        }
    }
}

/**
 * Represents a node in the Blackboard material tree view.
 * Can be a file, folder, or a virtual folder parsed from a JSON file.
 */
export class BBMaterialItem extends vscode.TreeItem {
    /** Metadata for virtual folders parsed from JSON */
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
