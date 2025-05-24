import * as vscode from 'vscode';
import * as path from 'path';
import { CollabClient } from '../backend/collaboration/CollabClient';
import { outputChannel } from '../utils/OutputChannel';

/**
 * Represents a shared file in the tree view
 */
class SharedFileItem extends vscode.TreeItem {
    constructor(
        public readonly id: string,
        public readonly label: string,
        public readonly owner: string,
        public readonly isOwner: boolean,
        public readonly size: number,
        public readonly filePath: string,
        public readonly sharedAt: number
    ) {
        super(label, vscode.TreeItemCollapsibleState.None);

        // Set context value for context menu contributions
        this.contextValue = isOwner ? 'sharedFileOwner' : 'sharedFile';

        // Set description to show file size
        this.description = this.formatSize(size);

        // Set tooltip with additional information
        this.tooltip = `File: ${label}\nOwner: ${owner}${isOwner ? ' (You)' : ''}\nShared: ${new Date(sharedAt).toLocaleString()}`;

        // Set icon based on file type
        this.iconPath = this.getFileIcon(label);

        // Set command to open file when clicked
        this.command = {
            command: 'teamCollab.openSharedFile',
            title: 'Open Shared File',
            arguments: [id]
        };
    }

    private formatSize(bytes: number): string {
        if (bytes < 1024) {
            return `${bytes} B`;
        } else if (bytes < 1024 * 1024) {
            return `${(bytes / 1024).toFixed(1)} KB`;
        } else {
            return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
        }
    }

    private getFileIcon(fileName: string): vscode.ThemeIcon {
        const ext = path.extname(fileName).toLowerCase();

        switch (ext) {
            case '.js': case '.ts': case '.jsx': case '.tsx':
                return new vscode.ThemeIcon('file-code');
            case '.json':
                return new vscode.ThemeIcon('json');
            case '.md':
                return new vscode.ThemeIcon('markdown');
            case '.html':
                return new vscode.ThemeIcon('html');
            case '.css': case '.scss': case '.less':
                return new vscode.ThemeIcon('css');
            case '.jpg': case '.jpeg': case '.png': case '.gif': case '.svg':
                return new vscode.ThemeIcon('file-media');
            default:
                return new vscode.ThemeIcon('file');
        }
    }
}

/**
 * TreeDataProvider for shared files
 */
export class SharedFilesProvider implements vscode.TreeDataProvider<SharedFileItem> {
    private _onDidChangeTreeData = new vscode.EventEmitter<SharedFileItem | undefined | null | void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    private client: CollabClient | undefined;
    private connectionStatus = false;

    constructor() { }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: SharedFileItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: SharedFileItem): Thenable<SharedFileItem[]> {
        // If not connected or no client, show empty
        if (!this.client || !this.connectionStatus) {
            return Promise.resolve([]);
        }

        // Root level, show all shared files
        if (!element) {
            const sharedFiles = this.client.getSharedFiles();
            const clientId = this.client.getClientId();

            return Promise.resolve(
                sharedFiles.map(file => new SharedFileItem(
                    file.id,
                    file.name,
                    file.owner,
                    file.owner === clientId,
                    file.size,
                    file.path,
                    file.sharedAt
                ))
            );
        }

        // No children for individual files
        return Promise.resolve([]);
    }

    setClient(client: CollabClient | undefined): void {
        // Remove old listeners if client exists
        if (this.client) {
            this.client.removeAllListeners('fileShared');
            this.client.removeAllListeners('fileUnshared');
            this.client.removeAllListeners('connected');
            this.client.removeAllListeners('disconnected');
        }

        this.client = client;

        if (this.client) {
            // Listen to file events
            this.client.on('fileShared', () => this.refresh());
            this.client.on('fileUnshared', () => this.refresh());
            this.client.on('connected', () => {
                this.connectionStatus = true;
                this.refresh();
            });
            this.client.on('disconnected', () => {
                this.connectionStatus = false;
                this.refresh();
            });

            // Update initial connection status
            this.connectionStatus = this.client.isConnected();
        } else {
            this.connectionStatus = false;
        }

        this.refresh();
    }

    isConnected(): boolean {
        return this.connectionStatus;
    }
}

/**
 * Main class for shared files view
 */
export class SharedFilesView {
    private static instance: SharedFilesView | undefined;
    private treeDataProvider: SharedFilesProvider;
    private treeView: vscode.TreeView<SharedFileItem>;
    private disposables: vscode.Disposable[] = [];

    static getInstance(context: vscode.ExtensionContext): SharedFilesView {
        if (!SharedFilesView.instance) {
            SharedFilesView.instance = new SharedFilesView(context);
        }
        return SharedFilesView.instance;
    }

    private constructor(private context: vscode.ExtensionContext) {
        // Create tree data provider
        this.treeDataProvider = new SharedFilesProvider();

        // Register the tree view with drag & drop support
        this.treeView = vscode.window.createTreeView('teamCollab.sharedFiles', {
            treeDataProvider: this.treeDataProvider,
            showCollapseAll: false,
            dragAndDropController: this.createDragAndDropController(),
            canSelectMany: false
        });

        this.disposables.push(this.treeView);

        // Update the title based on connection status
        this.treeView.title = 'Shared Files (Disconnected)';

        // Register commands
        this.registerCommands();
    }

    private registerCommands(): void {
        // Command to open a shared file
        this.disposables.push(
            vscode.commands.registerCommand('teamCollab.openSharedFile', (fileId: string) => {
                this.openSharedFile(fileId);
            })
        );

        // Command to unshare a file
        this.disposables.push(
            vscode.commands.registerCommand('teamCollab.unshareFile', (item: SharedFileItem) => {
                if (item && item.isOwner) {
                    this.unshareFile(item.id);
                } else {
                    vscode.window.showWarningMessage('You can only unshare files that you own.');
                }
            })
        );

        // Command to share a new file via file picker
        this.disposables.push(
            vscode.commands.registerCommand('teamCollab.shareNewFile', () => {
                this.shareFileViaDialog();
            })
        );

        // Command to refresh the view
        this.disposables.push(
            vscode.commands.registerCommand('teamCollab.refreshSharedFiles', () => {
                this.treeDataProvider.refresh();
            })
        );
    }

    private createDragAndDropController(): vscode.TreeDragAndDropController<SharedFileItem> {
        return {
            dragMimeTypes: [],
            dropMimeTypes: ['application/vnd.code.file.uri-list'],
            // We don't handle dragging from the view
            handleDrag: () => undefined,

            // Handle dropping files into the view
            handleDrop: async (target: SharedFileItem | undefined, dataTransfer: vscode.DataTransfer) => {
                const filesData = dataTransfer.get('application/vnd.code.file.uri-list');

                if (filesData) {
                    try {
                        const fileUris: string[] = JSON.parse(filesData.value);

                        for (const fileUriStr of fileUris) {
                            const fileUri = vscode.Uri.parse(fileUriStr);
                            await this.shareFile(fileUri.fsPath);
                        }
                    } catch (error) {
                        outputChannel.error('Drag and drop error',
                            error instanceof Error ? error.message : String(error));
                    }
                }
            }
        };
    }

    connectToClient(client: CollabClient): void {
        this.treeDataProvider.setClient(client);

        // Update view title
        if (client.isConnected()) {
            const serverInfo = client.getServerInfo();
            this.treeView.title = serverInfo ?
                `Shared Files (${serverInfo.name})` : 'Shared Files (Connected)';
        } else {
            this.treeView.title = 'Shared Files (Disconnected)';
        }
    }

    disconnectFromClient(): void {
        this.treeDataProvider.setClient(undefined);
        this.treeView.title = 'Shared Files (Disconnected)';
    }

    async shareFile(filePath: string): Promise<boolean> {
        if (!this.treeDataProvider.isConnected()) {
            vscode.window.showErrorMessage('Cannot share file: Not connected to a server');
            return false;
        }

        try {
            const client = this.treeDataProvider.setClient as any;
            const result = await client.shareFile(filePath);

            if (result) {
                vscode.window.showInformationMessage(`File ${path.basename(filePath)} shared successfully`);
                return true;
            } else {
                vscode.window.showErrorMessage('Failed to share file');
                return false;
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Error sharing file: ${error instanceof Error ? error.message : String(error)}`);
            return false;
        }
    }

    async unshareFile(fileId: string): Promise<boolean> {
        if (!this.treeDataProvider.isConnected()) {
            vscode.window.showErrorMessage('Cannot unshare file: Not connected to a server');
            return false;
        }

        try {
            const client = this.treeDataProvider.setClient as any;
            const result = client.unshareFile(fileId);

            if (result) {
                vscode.window.showInformationMessage('File unshared successfully');
                return true;
            } else {
                vscode.window.showErrorMessage('Failed to unshare file');
                return false;
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Error unsharing file: ${error instanceof Error ? error.message : String(error)}`);
            return false;
        }
    }

    async openSharedFile(fileId: string): Promise<boolean> {
        if (!this.treeDataProvider.isConnected()) {
            vscode.window.showErrorMessage('Cannot open file: Not connected to a server');
            return false;
        }

        try {
            const client = this.treeDataProvider.setClient as any;
            return await client.openSharedFile(fileId);
        } catch (error) {
            vscode.window.showErrorMessage(`Error opening file: ${error instanceof Error ? error.message : String(error)}`);
            return false;
        }
    }

    async shareFileViaDialog(): Promise<void> {
        if (!this.treeDataProvider.isConnected()) {
            vscode.window.showErrorMessage('Cannot share file: Not connected to a server');
            return;
        }

        const fileUris = await vscode.window.showOpenDialog({
            canSelectMany: true,
            openLabel: 'Share Files',
            filters: {
                'All Files': ['*']
            }
        });

        if (fileUris && fileUris.length > 0) {
            for (const uri of fileUris) {
                await this.shareFile(uri.fsPath);
            }
        }
    }

    dispose(): void {
        SharedFilesView.instance = undefined;

        for (const disposable of this.disposables) {
            disposable.dispose();
        }
        this.disposables = [];
    }
}
