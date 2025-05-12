import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { outputChannel } from '../utils/OutputChannel';
import { ConnectionManager } from '../backend/collaboration/ConnectionManager';
import * as PathManager from '../utils/pathManager';

export class SharedFilesProvider implements vscode.TreeDataProvider<string> {
    private _onDidChangeTreeData = new vscode.EventEmitter<string | void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    private sharedFiles: string[] = [];
    private connectionManager: ConnectionManager;

    constructor(connectionManager: ConnectionManager) {
        this.connectionManager = connectionManager;
    }

    static create(connectionManager: ConnectionManager): SharedFilesProvider {
        return new SharedFilesProvider(connectionManager);
    }

    async handleDrop(event: vscode.DataTransfer) {
        const item = event.get('text/uri-list');
        if (item) {
            const uriString = await item.value;
            const uris: vscode.Uri[] = uriString.split('\r\n').filter(Boolean).map((uri: string) => vscode.Uri.parse(uri));

            for (const uri of uris) {
                if (fs.statSync(uri.fsPath).isFile()) {
                    this.addFile(uri.fsPath);
                    this.connectionManager.shareFile(uri.fsPath);
                }
            }
        }
    }

    addFile(filePath: string) {
        if (!this.sharedFiles.includes(filePath)) {
            this.sharedFiles.push(filePath);
            this._onDidChangeTreeData.fire();
            outputChannel.info('SharedFiles', `Added shared file: ${filePath}`);
        }
    }

    removeFile(filePath: string) {
        const index = this.sharedFiles.indexOf(filePath);
        if (index !== -1) {
            this.sharedFiles.splice(index, 1);
            this._onDidChangeTreeData.fire();
            this.connectionManager.unshareFile(filePath);
            outputChannel.info('SharedFiles', `Removed shared file: ${filePath}`);
        }
    }

    syncWithManager(files: string[]) {
        this.sharedFiles = [...files];
        this._onDidChangeTreeData.fire();
    }

    // Store a remote file in the collaboration directory
    async storeRemoteFile(filePath: string, content: string): Promise<string> {
        const collabDir = PathManager.getDir('collab');
        // Normalize path separators to handle both Windows and Linux formats
        const normalizedPath = filePath.replace(/\\/g, '/');
        const fileName = path.basename(normalizedPath);
        const localPath = path.join(collabDir, fileName);

        // Create a unique name if file already exists
        let uniquePath = localPath;
        let counter = 1;
        while (fs.existsSync(uniquePath)) {
            const ext = path.extname(fileName);
            const baseName = path.basename(fileName, ext);
            uniquePath = path.join(collabDir, `${baseName}_${counter}${ext}`);
            counter++;
        }

        fs.writeFileSync(uniquePath, content, 'utf8');
        outputChannel.info('SharedFiles', `Stored remote file: ${uniquePath}`);

        // Add to shared files list
        this.addFile(uniquePath);

        return uniquePath;
    }

    getTreeItem(element: string): vscode.TreeItem {
        const treeItem = new vscode.TreeItem(
            path.basename(element),
            vscode.TreeItemCollapsibleState.None
        );

        treeItem.tooltip = element;
        treeItem.resourceUri = vscode.Uri.file(element);
        treeItem.command = {
            command: 'vscode.open',
            arguments: [vscode.Uri.file(element)],
            title: 'Open File'
        };

        treeItem.contextValue = 'sharedFile';

        return treeItem;
    }

    getChildren(): Thenable<string[]> {
        return Promise.resolve(this.sharedFiles);
    }
}