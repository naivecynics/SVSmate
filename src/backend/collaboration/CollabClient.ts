import * as net from 'net';
import * as dgram from 'dgram';
import * as os from 'os';
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { EventEmitter } from 'events';
import { outputChannel } from '../../utils/OutputChannel';
import { SharedDocumentManager } from './SharedDocumentManager';
import { NetworkUtils } from './NetworkUtils';

export interface ServerInfo {
    name: string;
    ip: string;
    tcpPort: number;
    udpPort: number;
    clients: number;
    discoveredAt: number;
}

interface SharedFile {
    id: string;
    name: string;
    path: string;
    owner: string;
    sharedAt: number;
    size: number;
    collaborators: string[];
}

interface ClientMessage {
    type: 'documentUpdate' | 'requestDocument' | 'shareDocument' | 'unshareDocument';
    payload: any;
    timestamp: number;
}

export class CollabClient extends EventEmitter {
    private socket: net.Socket | null = null;
    private udpSocket: dgram.Socket | null = null;
    public documentManager: SharedDocumentManager;
    private isConnected: boolean = false;
    private currentServer: ServerInfo | null = null;
    private sharedFiles: Map<string, SharedFile> = new Map();
    private documentChangeListeners: Map<string, vscode.Disposable> = new Map();

    constructor() {
        super();
        this.documentManager = new SharedDocumentManager();
        this.setupDocumentManager();
    }

    private setupDocumentManager() {
        this.documentManager.on('documentUpdate', (data) => {
            if (this.isConnected && this.socket) {
                this.sendToServer({
                    type: 'documentUpdate',
                    payload: {
                        fileId: data.fileId,
                        update: Array.from(data.update)
                    },
                    timestamp: Date.now()
                });
            }
        });
    }

    async discoverServers(timeout: number = 3000): Promise<ServerInfo[]> {
        const servers: ServerInfo[] = [];
        const discoveredIPs = new Set<string>();

        return new Promise((resolve) => {
            this.udpSocket = dgram.createSocket('udp4');

            this.udpSocket.on('message', (msg, rinfo) => {
                try {
                    const message = JSON.parse(msg.toString());
                    if (message.type === 'serverInfo' && !discoveredIPs.has(rinfo.address)) {
                        discoveredIPs.add(rinfo.address);
                        servers.push({
                            ...message.payload,
                            discoveredAt: Date.now()
                        });
                    }
                } catch (error) {
                    outputChannel.error('UDP Response Error', `From ${rinfo.address}: ${error}`);
                }
            });

            this.udpSocket.bind(() => {
                const broadcastAddresses = NetworkUtils.getBroadcastAddresses();
                const discoveryMessage = JSON.stringify({
                    type: 'discover',
                    payload: { clientName: os.hostname() },
                    timestamp: Date.now()
                });

                // Send discovery message to all broadcast addresses
                broadcastAddresses.forEach(address => {
                    this.udpSocket?.send(discoveryMessage, 6790, address);
                });

                setTimeout(() => {
                    this.udpSocket?.close();
                    this.udpSocket = null;
                    resolve(servers);
                }, timeout);
            });
        });
    }

    async connectToServer(serverInfo: ServerInfo): Promise<boolean> {
        if (this.isConnected) {
            vscode.window.showWarningMessage('Already connected to a server');
            return false;
        }

        return new Promise((resolve) => {
            this.socket = new net.Socket();

            this.socket.connect(serverInfo.tcpPort, serverInfo.ip, () => {
                this.isConnected = true;
                this.currentServer = serverInfo;
                outputChannel.info('Connected to Server', `${serverInfo.name} (${serverInfo.ip}:${serverInfo.tcpPort})`);
                vscode.window.showInformationMessage(`Connected to ${serverInfo.name}`);
                this.emit('connected', serverInfo);
                resolve(true);
            });

            this.socket.on('data', (data) => {
                this.handleServerMsg(data);
            });

            this.socket.on('close', () => {
                this.handleDisconnection();
            });

            this.socket.on('error', (error) => {
                outputChannel.error('Connection Error', error.message);
                vscode.window.showErrorMessage(`Failed to connect to ${serverInfo.name}: ${error.message}`);
                resolve(false);
            });
        });
    }

    disconnectFromServer(): void {
        if (!this.isConnected) {
            return;
        }

        // Clean up document listeners
        this.documentChangeListeners.forEach(disposable => disposable.dispose());
        this.documentChangeListeners.clear();

        if (this.socket) {
            this.socket.end();
            this.socket = null;
        }

        this.handleDisconnection();
    }

    private handleDisconnection() {
        this.isConnected = false;
        this.currentServer = null;
        this.sharedFiles.clear();

        outputChannel.info('Disconnected', 'Disconnected from collaboration server');
        vscode.window.showInformationMessage('Disconnected from collaboration server');
        this.emit('disconnected');
    }

    /**
     * Get existing document by ID
     */
    getDocument(fileId: string): any | null {
        return this.documentManager.getDocument(fileId);
    }

    /**
     * Apply editor change to document
     */
    applyEditorChange(fileId: string, change: vscode.TextDocumentContentChangeEvent): boolean {
        return this.documentManager.applyEditorChange(fileId, change);
    }

    /**
     * Clients cannot share files - only server can share
     */
    async shareFile(filePath: string): Promise<boolean> {
        vscode.window.showErrorMessage('Only the server can share files. Please ask the server host to share this file.');
        return false;
    }

    /**
     * Request document content from server
     */
    async requestDocument(fileId: string): Promise<boolean> {
        if (!this.isConnected || !this.socket) {
            return false;
        }

        try {
            this.sendToServer({
                type: 'requestDocument',
                payload: { fileId },
                timestamp: Date.now()
            });
            return true;
        } catch (error) {
            outputChannel.error('Request Document Error', error instanceof Error ? error.message : String(error));
            return false;
        }
    }

    /**
     * Register an editor with a shared document
     */
    registerEditor(fileId: string, editor: vscode.TextEditor): boolean {
        const success = this.documentManager.registerEditor(fileId, editor);
        if (success) {
            // Set up document change listener for this specific file
            this.setupDocumentListener(editor.document.uri.fsPath, fileId);
        }
        return success;
    }

    /**
     * Get document content
     */
    getDocumentContent(fileId: string): string {
        return this.documentManager.getDocumentContent(fileId);
    }

    /**
     * Create or get document for collaboration
     */
    async getOrCreateDocument(fileId: string, filePath: string): Promise<any | null> {
        let doc = this.documentManager.getDocument(fileId);
        if (!doc) {
            // Create document locally
            doc = await this.documentManager.createDocument(fileId, filePath, 'remote');
            if (doc) {
                // Request latest state from server
                await this.requestDocument(fileId);
            }
        }
        return doc;
    }

    async unshareFile(fileId: string): Promise<boolean> {
        if (!this.isConnected || !this.socket) {
            return false;
        }

        const sharedFile = this.sharedFiles.get(fileId);
        if (!sharedFile) {
            return false;
        }

        // Remove document change listener
        const listener = this.documentChangeListeners.get(fileId);
        if (listener) {
            listener.dispose();
            this.documentChangeListeners.delete(fileId);
        }

        // Remove local document
        this.documentManager.removeDocument(fileId);

        // Send unshare request to server
        this.sendToServer({
            type: 'unshareDocument',
            payload: { fileId },
            timestamp: Date.now()
        });

        this.sharedFiles.delete(fileId);
        this.emit('fileUnshared', fileId);

        vscode.window.showInformationMessage(`File "${sharedFile.name}" is no longer shared`);
        return true;
    }

    private setupDocumentListener(filePath: string, fileId: string) {
        const document = vscode.workspace.textDocuments.find(doc => doc.uri.fsPath === filePath);
        if (!document) {
            return;
        }

        const listener = vscode.workspace.onDidChangeTextDocument((event) => {
            if (event.document.uri.fsPath === filePath) {
                event.contentChanges.forEach(change => {
                    this.documentManager.applyEditorChange(fileId, change);
                });
            }
        });

        this.documentChangeListeners.set(fileId, listener);
    }

    updateFile(fileId: string, content: string): boolean {
        const sharedFile = this.sharedFiles.get(fileId);
        if (!sharedFile) {
            return false;
        }

        try {
            // Update the file on disk
            fs.writeFileSync(sharedFile.path, content, 'utf-8');

            // Update the document in VS Code if it's open
            const document = vscode.workspace.textDocuments.find(doc =>
                doc.uri.fsPath === sharedFile.path
            );

            if (document) {
                const edit = new vscode.WorkspaceEdit();
                edit.replace(
                    document.uri,
                    new vscode.Range(0, 0, document.lineCount, 0),
                    content
                );
                vscode.workspace.applyEdit(edit);
            }

            return true;
        } catch (error) {
            outputChannel.error('Update File Error', error instanceof Error ? error.message : String(error));
            return false;
        }
    }

    handleServerMsg(data: Buffer) {
        try {
            const messages = data.toString().split('\n').filter(line => line.trim());

            messages.forEach(messageStr => {
                const message = JSON.parse(messageStr);

                switch (message.type) {
                    case 'documentUpdate':
                        this.handleDocumentUpdate(message.payload);
                        break;
                    case 'documentContent':
                        this.handleDocumentContent(message.payload);
                        break;
                    case 'documentList':
                        this.handleDocumentList(message.payload);
                        break;
                    case 'documentShared':
                        this.handleDocumentShared(message.payload);
                        break;
                    case 'clientJoined':
                        this.handleClientJoined(message.payload);
                        break;
                    case 'clientLeft':
                        this.handleClientLeft(message.payload);
                        break;
                    case 'error':
                        this.handleServerError(message.payload);
                        break;
                    default:
                        outputChannel.warn('Unknown Server Message', message.type);
                }
            });
        } catch (error) {
            outputChannel.error('Server Message Parse Error', error instanceof Error ? error.message : String(error));
        }
    }

    private handleDocumentContent(payload: any) {
        const { fileId, content } = payload;

        // Get metadata to find document name
        const sharedFile = this.sharedFiles.get(fileId);
        const fileName = sharedFile ? sharedFile.name : 'unknown';

        // Create or update document with received content
        this.documentManager.createDocumentFromContent(fileId, fileName, content, 'remote');

        outputChannel.info('Document Content Received',
            `Received content for ${fileName} (${content.length} chars)`);
    }

    private handleDocumentUpdate(payload: any) {
        const { fileId, update, origin } = payload;

        // Apply updates from server or other clients
        if (origin !== 'local') {
            outputChannel.info('Applying Remote Update',
                `Applying update from ${origin} for document ${fileId}`);

            const updateArray = new Uint8Array(update);
            this.documentManager.applyUpdate(fileId, updateArray, 'remote');

            // Update VS Code editor if it's open
            const updated = this.documentManager.updateEditor(fileId);
            outputChannel.info('Editor Updated',
                `VS Code editor updated for ${fileId}: ${updated}`);
        }
    }

    private handleDocumentShared(payload: any) {
        outputChannel.info('Document Shared', `${payload.name} by ${payload.owner}`);

        // Create local document from received content
        if (payload.content !== undefined) {
            this.documentManager.createDocumentFromContent(payload.id, payload.name, payload.content, payload.owner);
        }

        // Add to local shared files (clients can't own documents)
        const sharedFile: SharedFile = {
            id: payload.id,
            name: payload.name,
            path: `[Remote] ${payload.name}`, // Always show as remote for clients
            owner: payload.owner,
            sharedAt: payload.sharedAt,
            size: payload.content ? payload.content.length : 0,
            collaborators: []
        };
        this.sharedFiles.set(payload.id, sharedFile);

        this.emit('documentShared', payload);
        this.emit('fileShared', sharedFile);
    }

    private handleDocumentList(payload: any[]) {
        // Update local shared files map and create documents from content
        this.sharedFiles.clear();

        payload.forEach(doc => {
            // Create document with content if available (clients never own documents)
            if (doc.content !== undefined) {
                this.documentManager.createDocumentFromContent(doc.id, doc.name, doc.content, doc.owner);
            }

            const sharedFile: SharedFile = {
                id: doc.id,
                name: doc.name,
                path: `[Remote] ${doc.name}`, // Always show as remote for clients
                owner: doc.owner,
                sharedAt: doc.sharedAt,
                size: doc.content ? doc.content.length : 0,
                collaborators: []
            };
            this.sharedFiles.set(doc.id, sharedFile);
        });

        // Emit event for UI update
        this.emit('documentListUpdated', payload);

        outputChannel.info('Document List Updated',
            `Received ${payload.length} shared documents with content`);
    }

    private handleClientJoined(payload: any) {
        outputChannel.info('Client Joined', `${payload.name} joined the collaboration`);
    }

    private handleClientLeft(payload: any) {
        outputChannel.info('Client Left', `${payload.name} left the collaboration`);
    }

    private handleServerError(payload: any) {
        outputChannel.error('Server Error', payload.message || 'Unknown server error');
        vscode.window.showErrorMessage(`Server error: ${payload.message}`);
    }

    private sendToServer(message: ClientMessage) {
        if (this.socket && !this.socket.destroyed) {
            try {
                this.socket.write(JSON.stringify(message) + '\n');
            } catch (error) {
                outputChannel.error('Send to Server Error', error instanceof Error ? error.message : String(error));
            }
        }
    }

    isClientConnected(): boolean {
        return this.isConnected;
    }

    getCurrentServer(): ServerInfo | null {
        return this.currentServer;
    }

    getSharedFiles(): SharedFile[] {
        return Array.from(this.sharedFiles.values());
    }
}