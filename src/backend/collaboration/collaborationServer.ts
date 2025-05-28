import * as vscode from 'vscode';
import * as net from 'net';
import * as dgram from 'dgram';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface SharedFile {
    id: string;
    name: string;
    path: string;
    content: string;
    lastModified: number;
    watcher?: vscode.FileSystemWatcher;
}

export interface ConnectedClient {
    id: string;
    socket: net.Socket;
    name: string;
    ip: string;
}

export class CollaborationServer {
    private server: net.Server | null = null;
    private discoveryServer: dgram.Socket | null = null;
    private clients: Map<string, ConnectedClient> = new Map();
    private sharedFiles: Map<string, SharedFile> = new Map();
    private port: number = 0;
    private discoveryPort: number = 8889; // Fixed port for discovery
    private isRunning = false;
    private fileUpdateInProgress = new Set<string>(); // Prevent update loops

    constructor() { }

    /**
     * Start the collaboration server
     */
    async start(): Promise<void> {
        if (this.isRunning) {
            return;
        }

        return new Promise((resolve, reject) => {
            this.server = net.createServer();

            this.server.on('connection', (socket) => {
                this.handleClientConnection(socket);
            });

            this.server.on('error', (err) => {
                vscode.window.showErrorMessage(`Server error: ${err.message}`);
                reject(err);
            });

            // Listen on a random available port
            this.server.listen(0, '0.0.0.0', () => {
                const address = this.server!.address() as net.AddressInfo;
                this.port = address.port;
                this.isRunning = true;

                // Start discovery server
                this.startDiscoveryServer();

                const localIP = this.getLocalIP();
                vscode.window.showInformationMessage(
                    `Collaboration server started on ${localIP}:${this.port}`
                );
                resolve();
            });
        });
    }

    /**
     * Start UDP discovery server
     */
    private startDiscoveryServer(): void {
        try {
            this.discoveryServer = dgram.createSocket('udp4');

            this.discoveryServer.on('message', (msg, rinfo) => {
                try {
                    const request = JSON.parse(msg.toString());
                    if (request.type === 'discover') {
                        // Respond with server information
                        const response = {
                            type: 'server_info',
                            data: {
                                ip: this.getLocalIP(),
                                port: this.port,
                                clientCount: this.clients.size,
                                sharedFilesCount: this.sharedFiles.size,
                                serverName: os.hostname() || 'Unknown Server'
                            }
                        };

                        const responseBuffer = Buffer.from(JSON.stringify(response));
                        this.discoveryServer?.send(responseBuffer, rinfo.port, rinfo.address);
                    }
                } catch (error) {
                    console.error('Failed to handle discovery request:', error);
                }
            });

            this.discoveryServer.on('error', (err) => {
                console.error('Discovery server error:', err);
            });

            this.discoveryServer.bind(this.discoveryPort, () => {
                console.log(`Discovery server listening on port ${this.discoveryPort}`);
            });
        } catch (error) {
            console.error('Failed to start discovery server:', error);
        }
    }

    /**
     * Stop the collaboration server
     */
    stop(): void {
        if (!this.isRunning) {
            return;
        }

        // Stop discovery server
        if (this.discoveryServer) {
            this.discoveryServer.close();
            this.discoveryServer = null;
        }

        // Disconnect all clients
        for (const client of this.clients.values()) {
            client.socket.destroy();
        }
        this.clients.clear();

        // Dispose file watchers
        for (const file of this.sharedFiles.values()) {
            if (file.watcher) {
                file.watcher.dispose();
            }
        }
        this.sharedFiles.clear();

        if (this.server) {
            this.server.close();
            this.server = null;
        }

        this.isRunning = false;
        vscode.window.showInformationMessage('Collaboration server stopped');
    }

    /**
     * Share a file with connected clients
     */
    shareFile(filePath: string): boolean {
        try {
            if (!fs.existsSync(filePath)) {
                vscode.window.showErrorMessage('File does not exist');
                return false;
            }

            const content = fs.readFileSync(filePath, 'utf-8');
            const fileName = path.basename(filePath);
            const fileId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

            // Create file watcher to monitor changes
            const watcher = vscode.workspace.createFileSystemWatcher(filePath);
            watcher.onDidChange(() => {
                this.handleFileSystemChange(fileId, filePath);
            });

            const sharedFile: SharedFile = {
                id: fileId,
                name: fileName,
                path: filePath,
                content: content,
                lastModified: Date.now(),
                watcher: watcher
            };

            this.sharedFiles.set(fileId, sharedFile);

            // Notify all clients about the new shared file
            this.broadcastToClients({
                type: 'fileShared',
                data: {
                    id: fileId,
                    name: fileName,
                    content: content
                }
            });

            vscode.window.showInformationMessage(`File "${fileName}" shared successfully`);
            return true;
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to share file: ${error}`);
            return false;
        }
    }

    /**
     * Update file content and sync with clients and disk
     */
    updateFileContent(fileId: string, content: string, fromClient: boolean = false): void {
        const sharedFile = this.sharedFiles.get(fileId);
        if (!sharedFile) {
            return;
        }

        // Prevent update loops
        if (this.fileUpdateInProgress.has(fileId)) {
            return;
        }

        this.fileUpdateInProgress.add(fileId);

        try {
            sharedFile.content = content;
            sharedFile.lastModified = Date.now();

            // Save to disk if the update came from a client
            if (fromClient) {
                try {
                    fs.writeFileSync(sharedFile.path, content, 'utf-8');
                } catch (error) {
                    console.error('Failed to save file to disk:', error);
                }
            }

            // Broadcast update to all clients
            this.broadcastToClients({
                type: 'fileUpdated',
                data: {
                    id: fileId,
                    content: content,
                    timestamp: sharedFile.lastModified
                }
            });

            // Update open VS Code documents on server side
            this.updateServerDocument(sharedFile);

        } finally {
            // Remove from progress tracking after a short delay
            setTimeout(() => {
                this.fileUpdateInProgress.delete(fileId);
            }, 100);
        }
    }

    /**
     * Handle file system changes (when file is edited outside of collaboration)
     */
    private async handleFileSystemChange(fileId: string, filePath: string): Promise<void> {
        if (this.fileUpdateInProgress.has(fileId)) {
            return;
        }

        try {
            const content = fs.readFileSync(filePath, 'utf-8');
            this.updateFileContent(fileId, content, false);
        } catch (error) {
            console.error('Failed to read file system change:', error);
        }
    }

    /**
     * Update open VS Code document on server side
     */
    private async updateServerDocument(sharedFile: SharedFile): Promise<void> {
        try {
            // Find if the file is currently open in VS Code
            const openDocuments = vscode.workspace.textDocuments;
            const document = openDocuments.find(doc => doc.fileName === sharedFile.path);

            if (document && document.getText() !== sharedFile.content) {
                // Apply edit to the document
                const edit = new vscode.WorkspaceEdit();
                const fullRange = new vscode.Range(
                    document.positionAt(0),
                    document.positionAt(document.getText().length)
                );
                edit.replace(document.uri, fullRange, sharedFile.content);
                await vscode.workspace.applyEdit(edit);
            }
        } catch (error) {
            console.error('Failed to update server document:', error);
        }
    }

    /**
     * Get server info
     */
    getServerInfo(): { isRunning: boolean; port: number; ip: string; clientCount: number } {
        return {
            isRunning: this.isRunning,
            port: this.port,
            ip: this.getLocalIP(),
            clientCount: this.clients.size
        };
    }

    /**
     * Get shared files
     */
    getSharedFiles(): SharedFile[] {
        return Array.from(this.sharedFiles.values());
    }

    /**
     * Get connected clients
     */
    getConnectedClients(): ConnectedClient[] {
        return Array.from(this.clients.values());
    }

    private handleClientConnection(socket: net.Socket): void {
        const clientId = `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const clientIP = socket.remoteAddress || 'unknown';

        const client: ConnectedClient = {
            id: clientId,
            socket: socket,
            name: `Client-${clientIP}`,
            ip: clientIP
        };

        this.clients.set(clientId, client);

        // Send welcome message and current shared files
        this.sendToClient(socket, {
            type: 'welcome',
            data: {
                clientId: clientId,
                sharedFiles: this.getSharedFiles()
            }
        });

        // Handle client messages
        socket.on('data', (data) => {
            try {
                const message = JSON.parse(data.toString());
                this.handleClientMessage(clientId, message);
            } catch (error) {
                console.error('Failed to parse client message:', error);
            }
        });

        // Handle client disconnect
        socket.on('close', () => {
            this.clients.delete(clientId);
            vscode.window.showInformationMessage(`Client ${clientIP} disconnected`);
        });

        socket.on('error', (err) => {
            console.error('Client socket error:', err);
            this.clients.delete(clientId);
        });

        vscode.window.showInformationMessage(`Client ${clientIP} connected`);
    }

    private handleClientMessage(clientId: string, message: any): void {
        switch (message.type) {
            case 'fileContentUpdate':
                // Handle file content updates from clients
                this.updateFileContent(message.data.fileId, message.data.content, true);
                break;
            case 'ping':
                // Respond to ping
                const client = this.clients.get(clientId);
                if (client) {
                    this.sendToClient(client.socket, { type: 'pong' });
                }
                break;
        }
    }

    private broadcastToClients(message: any): void {
        const messageStr = JSON.stringify(message);
        for (const client of this.clients.values()) {
            try {
                client.socket.write(messageStr);
            } catch (error) {
                console.error('Failed to send message to client:', error);
            }
        }
    }

    private sendToClient(socket: net.Socket, message: any): void {
        try {
            socket.write(JSON.stringify(message));
        } catch (error) {
            console.error('Failed to send message to client:', error);
        }
    }

    private getLocalIP(): string {
        const interfaces = os.networkInterfaces();
        for (const interfaceName in interfaces) {
            const addresses = interfaces[interfaceName];
            if (addresses) {
                for (const address of addresses) {
                    if (address.family === 'IPv4' && !address.internal) {
                        return address.address;
                    }
                }
            }
        }
        return '127.0.0.1';
    }
}

// Global server instance
export const collaborationServer = new CollaborationServer();
