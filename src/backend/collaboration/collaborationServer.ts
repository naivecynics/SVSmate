import * as vscode from 'vscode';
import * as net from 'net';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface SharedFile {
    id: string;
    name: string;
    path: string;
    content: string;
    lastModified: number;
}

export interface ConnectedClient {
    id: string;
    socket: net.Socket;
    name: string;
    ip: string;
}

export class CollaborationServer {
    private server: net.Server | null = null;
    private clients: Map<string, ConnectedClient> = new Map();
    private sharedFiles: Map<string, SharedFile> = new Map();
    private port: number = 0;
    private isRunning = false;

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

                const localIP = this.getLocalIP();
                vscode.window.showInformationMessage(
                    `Collaboration server started on ${localIP}:${this.port}`
                );
                resolve();
            });
        });
    }

    /**
     * Stop the collaboration server
     */
    stop(): void {
        if (!this.isRunning) {
            return;
        }

        // Disconnect all clients
        for (const client of this.clients.values()) {
            client.socket.destroy();
        }
        this.clients.clear();

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

            const sharedFile: SharedFile = {
                id: fileId,
                name: fileName,
                path: filePath,
                content: content,
                lastModified: Date.now()
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
     * Update file content and sync with clients
     */
    updateFileContent(fileId: string, content: string): void {
        const sharedFile = this.sharedFiles.get(fileId);
        if (!sharedFile) {
            return;
        }

        sharedFile.content = content;
        sharedFile.lastModified = Date.now();

        // Broadcast update to all clients
        this.broadcastToClients({
            type: 'fileUpdated',
            data: {
                id: fileId,
                content: content
            }
        });
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
                this.updateFileContent(message.data.fileId, message.data.content);
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
