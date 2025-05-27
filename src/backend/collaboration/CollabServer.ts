import * as vscode from 'vscode';
import * as path from 'path';
import * as net from 'net';
import * as dgram from 'dgram';
import * as fs from 'fs';
import * as os from 'os';
import { EventEmitter } from 'events';
import { outputChannel } from '../../utils/OutputChannel';
import { NetworkUtils } from './NetworkUtils';
import { SharedDocumentManager } from './SharedDocumentManager';

const TCP_PORT = 6789;
const UDP_PORT = 6790;

interface ClientConnection {
    socket: net.Socket;
    id: string;
    name: string;
    joinedAt: number;
}

interface ServerMessage {
    type: 'documentUpdate' | 'documentList' | 'clientJoined' | 'clientLeft' | 'error' | 'documentShared' | 'documentContent';
    payload: any;
    timestamp: number;
}

export class CollabServer extends EventEmitter {
    private tcpServer: net.Server | null = null;
    private udpServer: dgram.Socket | null = null;
    private clients: Map<string, ClientConnection> = new Map();
    public documentManager: SharedDocumentManager;
    private isRunning: boolean = false;
    private serverName: string;

    constructor() {
        super();
        this.documentManager = new SharedDocumentManager();
        this.serverName = `${os.hostname()}-SVSmate`;
        this.setupDocumentManager();
    }

    private setupDocumentManager() {
        this.documentManager.on('documentUpdate', (data) => {
            this.broadcastToClients({
                type: 'documentUpdate',
                payload: {
                    fileId: data.fileId,
                    update: Array.from(data.update),
                    origin: data.origin
                },
                timestamp: Date.now()
            });
        });
    }

    async startServer(): Promise<boolean> {
        if (this.isRunning) {
            vscode.window.showWarningMessage('Collaboration server is already running');
            return true;
        }

        try {
            await this.startTcpServer();
            await this.startUdpServer();
            this.isRunning = true;

            // Add server host as a special client
            this.addServerAsClient();

            const localIp = NetworkUtils.getLocalIp();
            vscode.window.showInformationMessage(
                `Collaboration server started on ${localIp}:${TCP_PORT}`
            );
            outputChannel.info('Server Started', `TCP: ${localIp}:${TCP_PORT}, UDP: ${UDP_PORT}`);
            return true;
        } catch (error) {
            outputChannel.error('Server Start Error', error instanceof Error ? error.message : String(error));
            vscode.window.showErrorMessage(`Failed to start collaboration server: ${error}`);
            return false;
        }
    }

    /**
     * Add server host as a special client for collaboration
     */
    private addServerAsClient(): void {
        const serverClientId = 'server_host';
        const serverClient: ClientConnection = {
            socket: null as any, // Server doesn't need a socket to itself
            id: serverClientId,
            name: `${this.serverName} (Host)`,
            joinedAt: Date.now()
        };

        this.clients.set(serverClientId, serverClient);
        outputChannel.info('Server Host Added', `Server host added as client: ${serverClient.name}`);

        // Emit event for UI update
        this.emit('clientJoined', {
            name: serverClient.name,
            id: serverClientId,
            isHost: true
        });
    }

    /**
     * Remove server host from clients when stopping
     */
    private removeServerAsClient(): void {
        const serverClientId = 'server_host';
        const serverClient = this.clients.get(serverClientId);

        if (serverClient) {
            this.clients.delete(serverClientId);
            outputChannel.info('Server Host Removed', `Server host removed from clients`);

            // Emit event for UI update
            this.emit('clientLeft', {
                name: serverClient.name,
                id: serverClientId,
                isHost: true
            });
        }
    }

    private startTcpServer(): Promise<void> {
        return new Promise((resolve, reject) => {
            this.tcpServer = net.createServer((socket) => {
                this.handleClientConnection(socket);
            });

            this.tcpServer.on('error', (error) => {
                reject(error);
            });

            this.tcpServer.listen(TCP_PORT, '0.0.0.0', () => {
                resolve();
            });
        });
    }

    private startUdpServer(): Promise<void> {
        return new Promise((resolve, reject) => {
            this.udpServer = dgram.createSocket('udp4');

            this.udpServer.on('message', (msg, rinfo) => {
                try {
                    const message = JSON.parse(msg.toString());
                    if (message.type === 'discover') {
                        this.handleDiscoveryRequest(rinfo);
                    }
                } catch (error) {
                    outputChannel.error('UDP Message Error', `Invalid message from ${rinfo.address}`);
                }
            });

            this.udpServer.on('error', (error) => {
                reject(error);
            });

            this.udpServer.bind(UDP_PORT, () => {
                resolve();
            });
        });
    }

    private handleDiscoveryRequest(rinfo: dgram.RemoteInfo) {
        const response = {
            type: 'serverInfo',
            payload: {
                name: this.serverName,
                ip: NetworkUtils.getLocalIp(),
                tcpPort: TCP_PORT,
                udpPort: UDP_PORT,
                clients: this.clients.size
            },
            timestamp: Date.now()
        };

        const responseBuffer = Buffer.from(JSON.stringify(response));
        this.udpServer?.send(responseBuffer, rinfo.port, rinfo.address);
    }

    private handleClientConnection(socket: net.Socket) {
        const clientId = `${socket.remoteAddress}:${socket.remotePort}_${Date.now()}`;
        const clientConnection: ClientConnection = {
            socket,
            id: clientId,
            name: `Client-${this.clients.size + 1}`,
            joinedAt: Date.now()
        };

        this.clients.set(clientId, clientConnection);
        outputChannel.info('Client Connected', `${clientConnection.name} (${clientId})`);

        // Send current document list with content
        const documents = this.documentManager.getAllDocumentMetadata();
        const documentsWithContent = documents.map(doc => ({
            ...doc,
            content: this.documentManager.getDocumentContent(doc.id)
        }));

        this.sendToClient(clientId, {
            type: 'documentList',
            payload: documentsWithContent,
            timestamp: Date.now()
        });

        // Notify other clients
        this.broadcastToClients({
            type: 'clientJoined',
            payload: { name: clientConnection.name, id: clientId },
            timestamp: Date.now()
        }, clientId);

        socket.on('data', (data) => {
            this.handleClientMsg(clientId, data);
        });

        socket.on('close', () => {
            this.handleClientDisconnection(clientId);
        });

        socket.on('error', (error) => {
            outputChannel.error('Client Socket Error', `${clientId}: ${error.message}`);
            this.handleClientDisconnection(clientId);
        });
    }

    handleClientMsg(clientId: string, data: Buffer) {
        try {
            const message = JSON.parse(data.toString());

            switch (message.type) {
                case 'documentUpdate':
                    this.handleDocumentUpdate(clientId, message.payload);
                    break;
                case 'requestDocument':
                    this.handleDocumentRequest(clientId, message.payload.fileId);
                    break;
                // Remove shareDocument case - clients can't share documents
                case 'unshareDocument':
                    this.handleUnshareDocument(clientId, message.payload.fileId);
                    break;
                default:
                    outputChannel.warn('Unknown Message Type', `${message.type} from ${clientId}`);
            }
        } catch (error) {
            outputChannel.error('Message Parse Error', `From ${clientId}: ${error}`);
        }
    }

    /**
     * Get existing document by ID
     */
    getDocument(fileId: string): any | null {
        return this.documentManager.getDocument(fileId);
    }

    /**
     * Create a new document
     */
    async createDocument(fileId: string, filePath: string, owner: string): Promise<any | null> {
        return await this.documentManager.createDocument(fileId, filePath, owner, true);
    }

    /**
     * Apply editor change to document
     */
    applyEditorChange(fileId: string, change: vscode.TextDocumentContentChangeEvent): boolean {
        return this.documentManager.applyEditorChange(fileId, change);
    }

    /**
     * Get all shared documents metadata
     */
    getAllDocuments() {
        return this.documentManager.getAllDocumentMetadata();
    }

    /**
     * Register an editor with a shared document
     */
    registerEditor(fileId: string, editor: vscode.TextEditor): boolean {
        return this.documentManager.registerEditor(fileId, editor);
    }

    /**
     * Get document content
     */
    getDocumentContent(fileId: string): string {
        return this.documentManager.getDocumentContent(fileId);
    }

    /**
     * Share a file from the server side (ONLY server can share)
     */
    async shareFile(filePath: string): Promise<boolean> {
        try {
            const fileName = path.basename(filePath);
            const fileId = `server_${Date.now()}_${fileName}`;

            // Server owns this document
            const doc = await this.documentManager.createDocument(fileId, filePath, 'Server', true);
            if (!doc) {
                return false;
            }

            const metadata = this.documentManager.getDocumentMetadata(fileId);
            const content = this.documentManager.getDocumentContent(fileId);

            if (metadata) {
                // Broadcast to all clients with content
                this.broadcastToClients({
                    type: 'documentShared',
                    payload: {
                        ...metadata,
                        content: content
                    },
                    timestamp: Date.now()
                });

                // Send updated document list with content to all clients
                const documents = this.documentManager.getAllDocumentMetadata();
                const documentsWithContent = documents.map(doc => ({
                    ...doc,
                    content: this.documentManager.getDocumentContent(doc.id)
                }));

                this.broadcastToClients({
                    type: 'documentList',
                    payload: documentsWithContent,
                    timestamp: Date.now()
                });

                // Emit event for local UI update
                this.emit('documentShared', metadata);

                vscode.window.showInformationMessage(`File "${fileName}" is now being shared from server`);
                outputChannel.info('Server File Shared', `${fileName} shared from server with ${content.length} chars`);
                return true;
            }
            return false;
        } catch (error) {
            outputChannel.error('Server Share File Error', error instanceof Error ? error.message : String(error));
            vscode.window.showErrorMessage(`Failed to share file: ${error}`);
            return false;
        }
    }

    /**
     * Unshare a file from the server side
     */
    async unshareFile(fileId: string): Promise<boolean> {
        if (this.documentManager.removeDocument(fileId)) {
            // Send updated document list with content to all clients
            const documents = this.documentManager.getAllDocumentMetadata();
            const documentsWithContent = documents.map(doc => ({
                ...doc,
                content: this.documentManager.getDocumentContent(doc.id)
            }));

            this.broadcastToClients({
                type: 'documentList',
                payload: documentsWithContent,
                timestamp: Date.now()
            });

            this.emit('documentRemoved', fileId);
            return true;
        }
        return false;
    }

    private async handleDocumentUpdate(clientId: string, payload: any) {
        const { fileId, update } = payload;
        const updateArray = new Uint8Array(update);
        const client = this.clients.get(clientId);

        outputChannel.info('Document Update Received',
            `Update from ${client?.name || clientId} for document ${fileId}`);

        if (await this.documentManager.applyUpdate(fileId, updateArray, clientId)) {
            // Always save to disk since server owns all shared documents
            const saved = this.documentManager.saveDocument(fileId);
            outputChannel.info('Document Saved',
                `Document ${fileId} saved to disk: ${saved}`);

            // Broadcast to other clients (excluding sender)
            this.broadcastToClients({
                type: 'documentUpdate',
                payload: { fileId, update, origin: clientId },
                timestamp: Date.now()
            }, clientId);

            outputChannel.info('Update Broadcasted',
                `Broadcasted update for ${fileId} to ${this.clients.size - 1} other clients`);
        }
    }

    private async handleDocumentRequest(clientId: string, fileId: string) {
        const doc = this.documentManager.getDocument(fileId);
        if (doc) {
            const content = this.documentManager.getDocumentContent(fileId);
            this.sendToClient(clientId, {
                type: 'documentContent',
                payload: { fileId, content, origin: 'server' },
                timestamp: Date.now()
            });
        } else {
            // If document doesn't exist, send empty content
            this.sendToClient(clientId, {
                type: 'documentContent',
                payload: { fileId, content: '', origin: 'server' },
                timestamp: Date.now()
            });
        }
    }

    private handleUnshareDocument(clientId: string, fileId: string) {
        if (this.documentManager.removeDocument(fileId)) {
            // Send updated document list with content to all clients
            const documents = this.documentManager.getAllDocumentMetadata();
            const documentsWithContent = documents.map(doc => ({
                ...doc,
                content: this.documentManager.getDocumentContent(doc.id)
            }));

            this.broadcastToClients({
                type: 'documentList',
                payload: documentsWithContent,
                timestamp: Date.now()
            });

            this.emit('documentRemoved', fileId);
        }
    }

    private handleClientDisconnection(clientId: string) {
        const client = this.clients.get(clientId);
        if (client) {
            this.clients.delete(clientId);
            outputChannel.info('Client Disconnected', `${client.name} (${clientId})`);

            this.broadcastToClients({
                type: 'clientLeft',
                payload: { name: client.name, id: clientId },
                timestamp: Date.now()
            });
        }
    }

    private sendToClient(clientId: string, message: ServerMessage) {
        // Skip sending messages to server host (itself)
        if (clientId === 'server_host') {
            return;
        }

        const client = this.clients.get(clientId);
        if (client && client.socket && !client.socket.destroyed) {
            try {
                client.socket.write(JSON.stringify(message) + '\n');
            } catch (error) {
                outputChannel.error('Send Message Error', `To ${clientId}: ${error}`);
            }
        }
    }

    private broadcastToClients(message: ServerMessage, excludeClientId?: string) {
        for (const [clientId, client] of this.clients) {
            if (clientId !== excludeClientId) {
                this.sendToClient(clientId, message);
            }
        }
    }

    stopServer(): void {
        if (!this.isRunning) {
            return;
        }

        // Remove server host from clients
        this.removeServerAsClient();

        // Close all client connections (excluding server host)
        for (const [clientId, client] of this.clients) {
            if (client.socket) {
                client.socket.end();
            }
        }
        this.clients.clear();

        // Close servers
        if (this.tcpServer) {
            this.tcpServer.close();
            this.tcpServer = null;
        }

        if (this.udpServer) {
            this.udpServer.close();
            this.udpServer = null;
        }

        this.isRunning = false;
        vscode.window.showInformationMessage('Collaboration server stopped');
        outputChannel.info('Server Stopped', 'Collaboration server stopped');
    }

    isServerRunning(): boolean {
        return this.isRunning;
    }

    getConnectedClients(): ClientConnection[] {
        return Array.from(this.clients.values());
    }
}