import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { outputChannel } from '../utils/OutputChannel';
import { ConnectionManager } from '../backend/collaboration/ConnectionManager';

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