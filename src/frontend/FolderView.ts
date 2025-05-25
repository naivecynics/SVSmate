import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { localize } from "../utils/i18n";

/**
 * Provides a tree view of files and folders in the current workspace.
 * Automatically refreshes when files are created, deleted, or modified.
 */
export class FolderViewProvider implements vscode.TreeDataProvider<FileItem>, vscode.Disposable {
    /** Event emitter for notifying VS Code about data changes */
    private _onDidChangeTreeData: vscode.EventEmitter<FileItem | undefined> =
        new vscode.EventEmitter<FileItem | undefined>();
    /** Event that fires when the tree data changes */
    readonly onDidChangeTreeData: vscode.Event<FileItem | undefined> =
        this._onDidChangeTreeData.event;

    /** File system watcher for monitoring file changes */
    private fileSystemWatcher: vscode.FileSystemWatcher;
    /** Flag to track if the provider is disposed */
    private _disposed: boolean = false;/**
     * Creates a FolderViewProvider for the given workspace root.
     * 
     * @param workspaceRoot - The root path of the currently open workspace.
     */
    constructor(private workspaceRoot: string | undefined) {
        if (workspaceRoot) {
            // Create a file system watcher to monitor file changes only in the workspace
            const pattern = new vscode.RelativePattern(workspaceRoot, '**/*');
            this.fileSystemWatcher = vscode.workspace.createFileSystemWatcher(pattern);

            // Watch for file creation, deletion, or change events
            this.fileSystemWatcher.onDidCreate(() => this.refresh());
            this.fileSystemWatcher.onDidDelete(() => this.refresh());
            this.fileSystemWatcher.onDidChange(() => this.refresh());
        } else {
            // Fallback: create a minimal watcher that does nothing
            this.fileSystemWatcher = vscode.workspace.createFileSystemWatcher('**/nonexistent');
        }
    }

    /**
     * Factory method to create a provider instance for the first workspace folder.
     * 
     * @returns A new FolderViewProvider, or undefined if no workspace is open.
     */
    static create(): FolderViewProvider | undefined {        const folders = vscode.workspace.workspaceFolders;
        if (!folders || folders.length === 0) {
            vscode.window.showWarningMessage(localize("folderView.noWorkspace", "No workspace folder is open."));
            return;
        }
        return new FolderViewProvider(folders[0].uri.fsPath);
    }    /**
     * Dispose the file system watcher and event emitter.
     */
    dispose(): void {
        if (this._disposed) {
            return;
        }
        
        try {
            this._disposed = true;
            this.fileSystemWatcher?.dispose();
            this._onDidChangeTreeData?.dispose();
        } catch (error) {
            console.error('Error disposing FolderViewProvider:', error);
        }
    }/**
     * Refresh the tree view.
     */
    refresh(): void {
        try {
            if (!this._disposed && this._onDidChangeTreeData) {
                this._onDidChangeTreeData.fire(undefined);
            }
        } catch (error) {
            console.error('Error refreshing FolderView:', error);
        }
    }

    /**
     * Gets the TreeItem representation of a file or folder.
     * 
     * @param element - The FileItem to convert to a TreeItem.
     * @returns A TreeItem configured for display.
     */
    getTreeItem(element: FileItem): vscode.TreeItem {
        return element;
    }

    /**
     * Gets children of the given folder, or the root folder if none provided.
     * 
     * @param element - The parent folder node, or undefined for the root.
     * @returns A list of FileItem instances.
     */
    getChildren(element?: FileItem): FileItem[] | Thenable<FileItem[]> {        if (!this.workspaceRoot) {
            vscode.window.showInformationMessage(localize("folderView.noWorkspaceRoot", "No workspace folder found"));
            return Promise.resolve([]);
        }

        const dirPath = element ? element.resourceUri.fsPath : this.workspaceRoot;
        return Promise.resolve(this.getFiles(dirPath));
    }

    /**
     * Reads the directory contents and returns file/folder nodes.
     * 
     * @param dir - The directory path to read.
     * @returns An array of FileItem nodes.
     */
    private getFiles(dir: string): FileItem[] {
        if (!fs.existsSync(dir)) {return [];}

        const items = fs.readdirSync(dir)
            .filter(file => !file.startsWith('.')) // Exclude hidden files
            .map((file) => {
                const filePath = path.join(dir, file);
                const isDirectory = fs.statSync(filePath).isDirectory();
                return {
                    name: file,
                    path: filePath,
                    isDirectory: isDirectory
                };
            });

        // Sort folders first, then files, both alphabetically
        return items
            .sort((a, b) => {
                if (a.isDirectory !== b.isDirectory) {
                    return a.isDirectory ? -1 : 1;
                }
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

/**
 * Represents a file or folder node in the folder tree.
 */
export class FileItem extends vscode.TreeItem {
    /**
     * Creates a FileItem tree node.
     * 
     * @param resourceUri - The file or folder URI.
     * @param collapsibleState - Determines if the node is expandable.
     */
    constructor(
        public readonly resourceUri: vscode.Uri,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState
    ) {
        super(resourceUri, collapsibleState);

        this.tooltip = this.resourceUri.fsPath;
        this.description = undefined;
        this.contextValue = collapsibleState === vscode.TreeItemCollapsibleState.Collapsed ? "folder" : "file";

        // Open file on click if it's not a folder
        if (collapsibleState === vscode.TreeItemCollapsibleState.None) {
            this.command = {                command: 'vscode.open',
                title: localize("folderView.openFile", "Open File"),
                arguments: [this.resourceUri]
            };
        }
    }
}
