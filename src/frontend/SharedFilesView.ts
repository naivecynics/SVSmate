import * as vscode from 'vscode';
import { collaborationServer } from '../backend/collaboration/collaborationServer';
import { collaborationClient } from '../backend/collaboration/collaborationClient';

export interface SharedFilesItem {
    id: string;
    label: string;
    type: 'server' | 'client' | 'serverFile' | 'clientFile' | 'serverStatus' | 'clientStatus' | 'discoveredServers' | 'discoveredServer';
    resourceUri?: vscode.Uri;
    description?: string;
    fileId?: string;
    serverInfo?: any; // For discovered server info
}

/**
 * Provides a tree view for collaboration features including server management,
 * client connections, and shared files.
 */
export class SharedFilesViewProvider implements vscode.TreeDataProvider<SharedFilesItem>, vscode.Disposable {
    /** Event emitter for notifying VS Code about data changes */
    private _onDidChangeTreeData = new vscode.EventEmitter<SharedFilesItem | undefined>();
    /** Event that fires when the tree data changes */
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    /** Flag to track if the provider is disposed */
    private _disposed = false;

    constructor() {
        // Listen for server/client updates
        collaborationClient.onFilesUpdated(() => {
            this.refresh();
        });

        // Listen for discovered servers updates
        collaborationClient.onServersUpdated(() => {
            this.refresh();
        });
    }

    /**
     * Refresh the tree view
     */
    refresh(): void {
        try {
            if (!this._disposed && this._onDidChangeTreeData) {
                this._onDidChangeTreeData.fire(undefined);
            }
        } catch (error) {
            console.error('Error refreshing SharedFilesView:', error);
        }
    }

    /**
     * Gets the TreeItem representation of a shared files item
     */
    getTreeItem(element: SharedFilesItem): vscode.TreeItem {
        const item = new vscode.TreeItem(
            element.label,
            element.type.includes('Status') || element.type.includes('File') || element.type === 'discoveredServer'
                ? vscode.TreeItemCollapsibleState.None
                : vscode.TreeItemCollapsibleState.Expanded
        );

        item.description = element.description;
        item.contextValue = element.type;

        // Set icons
        switch (element.type) {
            case 'server':
                item.iconPath = new vscode.ThemeIcon('server');
                break;
            case 'client':
                item.iconPath = new vscode.ThemeIcon('device-desktop');
                break;
            case 'discoveredServers':
                item.iconPath = new vscode.ThemeIcon('search');
                break;
            case 'discoveredServer':
                item.iconPath = new vscode.ThemeIcon('globe');
                item.command = {
                    command: 'svsmate.COLLAB-connectToDiscoveredServer',
                    title: 'Connect to Server',
                    arguments: [element]
                };
                break;
            case 'serverFile':
            case 'clientFile':
                item.iconPath = new vscode.ThemeIcon('file');
                item.command = {
                    command: 'svsmate.COLLAB-openSharedFile',
                    title: 'Open Shared File',
                    arguments: [element]
                };
                break;
            case 'serverStatus':
            case 'clientStatus':
                item.iconPath = new vscode.ThemeIcon('info');
                break;
        }

        return item;
    }

    /**
     * Gets the children for a given tree node
     */
    getChildren(element?: SharedFilesItem): SharedFilesItem[] {
        if (!element) {
            // Root level - show server and client sections
            return [
                {
                    id: 'server-section',
                    label: 'Server',
                    type: 'server'
                },
                {
                    id: 'client-section',
                    label: 'Client',
                    type: 'client'
                }
            ];
        }

        if (element.type === 'server') {
            const serverInfo = collaborationServer.getServerInfo();
            const items: SharedFilesItem[] = [];

            // Server status
            items.push({
                id: 'server-status',
                label: serverInfo.isRunning ? 'Running' : 'Stopped',
                type: 'serverStatus',
                description: serverInfo.isRunning
                    ? `${serverInfo.ip}:${serverInfo.port} (${serverInfo.clientCount} clients)`
                    : 'Click to start server'
            });

            // Shared files
            if (serverInfo.isRunning) {
                const sharedFiles = collaborationServer.getSharedFiles();
                for (const file of sharedFiles) {
                    items.push({
                        id: `server-file-${file.id}`,
                        label: file.name,
                        type: 'serverFile',
                        description: 'Shared file',
                        fileId: file.id
                    });
                }
            }

            return items;
        }

        if (element.type === 'client') {
            const clientInfo = collaborationClient.getConnectionInfo();
            const items: SharedFilesItem[] = [];

            // Client status
            items.push({
                id: 'client-status',
                label: clientInfo.isConnected ? 'Connected' : 'Disconnected',
                type: 'clientStatus',
                description: clientInfo.isConnected
                    ? `${clientInfo.serverIP}:${clientInfo.serverPort}`
                    : 'Click to connect to server'
            });

            // Discovered servers section
            items.push({
                id: 'discovered-servers',
                label: 'Discovered Servers',
                type: 'discoveredServers',
                description: 'Available servers on network'
            });

            // Available files from server
            if (clientInfo.isConnected) {
                const serverFiles = collaborationClient.getServerFiles();
                for (const file of serverFiles) {
                    items.push({
                        id: `client-file-${file.id}`,
                        label: file.name,
                        type: 'clientFile',
                        description: 'Available from server',
                        fileId: file.id
                    });
                }
            }

            return items;
        }

        if (element.type === 'discoveredServers') {
            const discoveredServers = collaborationClient.getDiscoveredServers();
            return discoveredServers.map(server => ({
                id: `discovered-${server.ip}-${server.port}`,
                label: `${server.serverName}`,
                type: 'discoveredServer' as const,
                description: `${server.ip}:${server.port} (${server.clientCount} clients, ${server.sharedFilesCount} files)`,
                serverInfo: server
            }));
        }

        return [];
    }

    /**
     * Dispose resources
     */
    dispose(): void {
        if (this._disposed) {
            return;
        }

        try {
            this._disposed = true;
            this._onDidChangeTreeData?.dispose();
        } catch (error) {
            console.error('Error disposing SharedFilesViewProvider:', error);
        }
    }
}
