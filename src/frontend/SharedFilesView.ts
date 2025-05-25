import * as vscode from 'vscode';
import * as path from 'path';

interface SharedFileItem {
    id: string;
    name: string;
    path: string;
    owner: string;
    sharedAt: number;
    collaborators: string[];
}

export class SharedFilesViewProvider implements vscode.TreeDataProvider<SharedFileTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<SharedFileTreeItem | undefined | null | void> = new vscode.EventEmitter<SharedFileTreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<SharedFileTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

    private sharedFiles: SharedFileItem[] = [];
    private collaborationStatus: 'disconnected' | 'connected' | 'hosting' = 'disconnected';

    constructor() { }

    static create(): SharedFilesViewProvider {
        return new SharedFilesViewProvider();
    }

    dispose(): void {
        this._onDidChangeTreeData.dispose();
        this.sharedFiles = [];
    }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: SharedFileTreeItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: SharedFileTreeItem): Thenable<SharedFileTreeItem[]> {
        if (!element) {
            return Promise.resolve(this.getRootItems());
        }
        return Promise.resolve([]);
    }

    private getRootItems(): SharedFileTreeItem[] {
        const items: SharedFileTreeItem[] = [];

        // Add status item
        items.push(new SharedFileTreeItem(
            this.getStatusText(),
            vscode.TreeItemCollapsibleState.None,
            'status'
        ));

        // Add shared files
        if (this.sharedFiles.length > 0) {
            this.sharedFiles.forEach(file => {
                const item = new SharedFileTreeItem(
                    file.name,
                    vscode.TreeItemCollapsibleState.None,
                    'sharedFile'
                );
                item.description = `by ${file.owner}`;
                item.tooltip = `File: ${file.name}\nOwner: ${file.owner}\nShared: ${new Date(file.sharedAt).toLocaleString()}\nCollaborators: ${file.collaborators.length}`;
                item.resourceUri = vscode.Uri.file(file.path);
                item.contextValue = 'sharedFile';
                item.id = file.id;

                // Make file clickable to open
                item.command = {
                    command: 'teamCollab.openSharedFile',
                    title: 'Open Shared File',
                    arguments: [file]
                };

                // Set icon based on file type
                const ext = path.extname(file.name).toLowerCase();
                if (ext === '.ts' || ext === '.js') {
                    item.iconPath = new vscode.ThemeIcon('file-code');
                } else if (ext === '.md') {
                    item.iconPath = new vscode.ThemeIcon('markdown');
                } else if (ext === '.json') {
                    item.iconPath = new vscode.ThemeIcon('json');
                } else {
                    item.iconPath = new vscode.ThemeIcon('file');
                }

                items.push(item);
            });
        } else if (this.collaborationStatus !== 'disconnected') {
            items.push(new SharedFileTreeItem(
                'No shared files',
                vscode.TreeItemCollapsibleState.None,
                'empty'
            ));
        }

        return items;
    }

    private getStatusText(): string {
        switch (this.collaborationStatus) {
            case 'hosting':
                return '🟢 Hosting collaboration session';
            case 'connected':
                return '🟡 Connected to collaboration session';
            case 'disconnected':
            default:
                return '🔴 Not connected';
        }
    }

    updateSharedFiles(files: SharedFileItem[]): void {
        this.sharedFiles = files;
        this.refresh();
    }

    updateCollaborationStatus(status: 'disconnected' | 'connected' | 'hosting'): void {
        this.collaborationStatus = status;
        this.refresh();
    }

    addSharedFile(file: SharedFileItem): void {
        const existingIndex = this.sharedFiles.findIndex(f => f.id === file.id);
        if (existingIndex >= 0) {
            this.sharedFiles[existingIndex] = file;
        } else {
            this.sharedFiles.push(file);
        }
        this.refresh();
    }

    removeSharedFile(fileId: string): void {
        this.sharedFiles = this.sharedFiles.filter(f => f.id !== fileId);
        this.refresh();
    }

    getSharedFile(fileId: string): SharedFileItem | undefined {
        return this.sharedFiles.find(f => f.id === fileId);
    }
}

export class SharedFileTreeItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly itemType: 'status' | 'sharedFile' | 'empty'
    ) {
        super(label, collapsibleState);
        this.tooltip = this.label;

        // Only set default iconPath for non-file items
        if (itemType !== 'sharedFile') {
            this.iconPath = {
                light: vscode.Uri.file(path.join(__filename, '..', '..', 'resources', 'light', 'dependency.svg')),
                dark: vscode.Uri.file(path.join(__filename, '..', '..', 'resources', 'dark', 'dependency.svg'))
            };
        }
    }
}
