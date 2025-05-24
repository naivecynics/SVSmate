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

export class CollabClient extends EventEmitter {
    private tcpClient: net.Socket | null = null;
    private udpClient: dgram.Socket | null = null;
    private serverInfo: ServerInfo | null = null;
    private clientId: string | null = null;
    private clientName: string;

    private connected: boolean = false;
    private reconnectAttempts: number = 0;
    private reconnectTimeout: NodeJS.Timeout | null = null;

    private discoveryInterval: NodeJS.Timeout | null = null;
    private knownServers: Map<string, ServerInfo> = new Map();
    private messageQueue: any[] = [];
    private sharedFiles: Map<string, SharedFile> = new Map();

    private sharedDocumentManager: SharedDocumentManager;
    private readonly MAX_RECONNECT_ATTEMPTS = 5;
    private readonly RECONNECT_INTERVAL = 3000; // 3 seconds
    private readonly DISCOVERY_INTERVAL = 5000; // 5 seconds

    constructor(clientName: string = os.hostname()) {
        super();
        this.clientName = clientName;
        this.sharedDocumentManager = new SharedDocumentManager();

        // Initialize UDP for server discovery
        this.initUdpDiscovery();
    }

    /**
     * Discover collaboration servers on the network
     */
    startServerDiscovery(): Promise<void> {
        return new Promise<void>((resolve) => {
            if (this.udpClient) {
                // If already discovering, just resolve
                resolve();
                return;
            }

            this.initUdpDiscovery();

            // Start periodic discovery
            if (!this.discoveryInterval) {
                this.discoveryInterval = setInterval(() => {
                    this.discoverServers();
                }, this.DISCOVERY_INTERVAL);
            }

            // Discover immediately
            this.discoverServers();
            resolve();
        });
    }

    /**
     * Stop server discovery
     */
    stopServerDiscovery(): void {
        if (this.discoveryInterval) {
            clearInterval(this.discoveryInterval);
            this.discoveryInterval = null;
        }

        if (this.udpClient) {
            this.udpClient.close();
            this.udpClient = null;
        }
    }

    /**
     * Get list of discovered servers
     */
    getDiscoveredServers(): ServerInfo[] {
        return Array.from(this.knownServers.values());
    }

    /**
     * Connect to a collaboration server
     */
    connectToServer(serverIp: string, serverPort: number): Promise<boolean> {
        return new Promise<boolean>((resolve, reject) => {
            // Close existing connection if any
            if (this.connected && this.tcpClient) {
                this.disconnect();
            }

            try {
                this.tcpClient = new net.Socket();

                this.tcpClient.connect(serverPort, serverIp, () => {
                    outputChannel.info('TCP Client', `Connected to server at ${serverIp}:${serverPort}`);
                    this.connected = true;
                    this.reconnectAttempts = 0;

                    // Send registration message
                    this.register();

                    // Send any queued messages
                    this.flushMessageQueue();

                    resolve(true);
                });

                // Set up event handlers
                this.setupTcpClientEvents();

            } catch (error) {
                outputChannel.error('TCP Connection Error',
                    error instanceof Error ? error.message : String(error));
                reject(error);
            }
        });
    }

    /**
     * Manually connect to a server using IP and port
     */
    connectToServerManually(ip: string, port: number): Promise<boolean> {
        return this.connectToServer(ip, port);
    }

    /**
     * Disconnect from the server
     */
    disconnect(): Promise<void> {
        return new Promise<void>((resolve) => {
            if (this.tcpClient) {
                this.tcpClient.end();
                this.tcpClient.destroy();
                this.tcpClient = null;
            }

            this.connected = false;
            this.clientId = null;
            this.serverInfo = null;

            // Clear any reconnect timeout
            if (this.reconnectTimeout) {
                clearTimeout(this.reconnectTimeout);
                this.reconnectTimeout = null;
            }

            outputChannel.info('TCP Client', 'Disconnected from server');

            this.emit('disconnected');
            resolve();
        });
    }

    /**
     * Check if connected to a server
     */
    isConnected(): boolean {
        return this.connected && this.tcpClient !== null;
    }

    /**
     * Send a chat message to all clients
     */
    sendChatMessage(message: string): boolean {
        return this.sendMessage({
            type: 'chat',
            message: message
        });
    }

    /**
     * Share a file with others
     */
    shareFile(filePath: string): Promise<boolean> {
        return new Promise<boolean>((resolve, reject) => {
            try {
                // Check if file exists
                if (!fs.existsSync(filePath)) {
                    outputChannel.error('File Share Error', `File does not exist: ${filePath}`);
                    resolve(false);
                    return;
                }

                // Get file stats
                const stats = fs.statSync(filePath);
                const fileName = path.basename(filePath);
                const fileId = `file-${Date.now().toString(36)}`;

                // Send share file message
                const success = this.sendMessage({
                    type: 'shareFile',
                    fileId: fileId,
                    name: fileName,
                    path: filePath,
                    size: stats.size
                });

                resolve(success);
            } catch (error) {
                outputChannel.error('File Share Error',
                    error instanceof Error ? error.message : String(error));
                reject(error);
            }
        });
    }

    /**
     * Unshare a previously shared file
     */
    unshareFile(fileId: string): boolean {
        return this.sendMessage({
            type: 'unshareFile',
            fileId: fileId
        });
    }

    /**
     * Send a file operation
     */
    sendFileOperation(fileId: string, operation: string, data: any): boolean {
        return this.sendMessage({
            type: 'fileOperation',
            fileId: fileId,
            operation: operation,
            ...data
        });
    }

    /**
     * Get list of shared files available for collaboration
     */
    getSharedFiles(): SharedFile[] {
        return Array.from(this.sharedFiles.values());
    }

    /**
     * Get client's unique ID
     */
    getClientId(): string | null {
        return this.clientId;
    }

    /**
     * Get client name
     */
    getClientName(): string {
        return this.clientName;
    }

    /**
     * Set client name
     */
    setClientName(name: string): void {
        this.clientName = name;

        // If already connected, update registration
        if (this.connected) {
            this.register();
        }
    }

    /**
     * Get current server information
     */
    getServerInfo(): ServerInfo | null {
        return this.serverInfo;
    }

    /**
     * Initialize UDP client for server discovery
     */
    private initUdpDiscovery(): void {
        if (!this.udpClient) {
            this.udpClient = dgram.createSocket('udp4');

            this.udpClient.on('error', (err) => {
                outputChannel.error('UDP Client Error', err.message);
                this.udpClient?.close();
                this.udpClient = null;
            });

            this.udpClient.on('message', (msg, rinfo) => {
                try {
                    const message = JSON.parse(msg.toString());

                    if (message.type === 'serverInfo') {
                        const serverKey = `${rinfo.address}:${message.tcpPort}`;
                        const serverInfo: ServerInfo = {
                            name: message.name,
                            ip: rinfo.address,
                            tcpPort: message.tcpPort,
                            udpPort: message.udpPort,
                            clients: message.clients,
                            discoveredAt: Date.now()
                        };

                        this.knownServers.set(serverKey, serverInfo);
                        this.emit('serverDiscovered', serverInfo);

                        outputChannel.info('Server Discovered',
                            `Server found at ${serverInfo.ip}:${serverInfo.tcpPort} (${serverInfo.name})`);
                    }
                } catch (error) {
                    outputChannel.error('UDP Message Parse Error',
                        error instanceof Error ? error.message : String(error));
                }
            });

            this.udpClient.on('listening', () => {
                this.udpClient?.setBroadcast(true);
                outputChannel.info('UDP Client', 'Ready to discover servers');
            });

            this.udpClient.bind();
        }
    }

    /**
     * Send broadcast to discover servers
     */
    private discoverServers(): void {
        if (!this.udpClient) {
            this.initUdpDiscovery();
        }

        try {
            const message = {
                type: 'discover',
                client: this.clientName
            };

            const broadcastAddresses = NetworkUtils.getLocalIp();
            const messageBuffer = Buffer.from(JSON.stringify(message));

            // Send discovery message to all broadcast addresses
            for (const broadcastAddress of broadcastAddresses) {
                this.udpClient?.send(messageBuffer, 3001, broadcastAddress, (error) => {
                    if (error) {
                        outputChannel.error('UDP Send Error', error.message);
                    }
                });
            }

            // Cleanup old servers (older than 30 seconds)
            const now = Date.now();
            for (const [key, server] of this.knownServers.entries()) {
                if (now - server.discoveredAt > 30000) {
                    this.knownServers.delete(key);
                }
            }

        } catch (error) {
            outputChannel.error('Server Discovery Error',
                error instanceof Error ? error.message : String(error));
        }
    }

    /**
     * Setup TCP client event handlers
     */
    private setupTcpClientEvents(): void {
        if (!this.tcpClient) {
            return;
        }

        this.tcpClient.on('data', (data) => {
            try {
                const messages = this.parseMessages(data.toString());

                for (const message of messages) {
                    this.handleServerMessage(message);
                }
            } catch (error) {
                outputChannel.error('TCP Message Parse Error',
                    error instanceof Error ? error.message : String(error));
            }
        });

        this.tcpClient.on('close', () => {
            this.connected = false;
            outputChannel.info('TCP Client', 'Connection closed');

            this.emit('disconnected');

            // Try to reconnect automatically
            this.attemptReconnect();
        });

        this.tcpClient.on('error', (error) => {
            outputChannel.error('TCP Client Error', error.message);

            if (this.tcpClient) {
                this.tcpClient.destroy();
                this.tcpClient = null;
            }

            this.connected = false;
            this.emit('error', error);
        });
    }

    /**
     * Parse incoming messages (handles multiple messages in one data packet)
     */
    private parseMessages(data: string): any[] {
        const messages: any[] = [];

        try {
            // Try to parse as a single JSON object first
            messages.push(JSON.parse(data));
        } catch (e) {
            // If that fails, try to split by newline or other delimiters
            try {
                // Try splitting by newlines
                const parts = data.split('\n').filter(p => p.trim().length > 0);

                for (const part of parts) {
                    try {
                        const message = JSON.parse(part);
                        messages.push(message);
                    } catch (innerError) {
                        outputChannel.error('Message Parse Error',
                            `Failed to parse message part: ${part.substring(0, 50)}`);
                    }
                }
            } catch (error) {
                outputChannel.error('Message Split Error',
                    error instanceof Error ? error.message : String(error));
            }
        }

        return messages;
    }

    /**
     * Handle messages from the server
     */
    private handleServerMessage(message: any): void {
        switch (message.type) {
            case 'welcome':
                this.clientId = message.clientId;
                this.emit('connected', {
                    clientId: this.clientId,
                    serverInfo: message.serverInfo
                });
                outputChannel.info('Connected',
                    `Connected to server as ${this.clientName} (${this.clientId})`);
                break;

            case 'chat':
                this.emit('chatMessage', {
                    from: message.from,
                    fromName: message.fromName,
                    message: message.message,
                    timestamp: message.timestamp
                });
                break;

            case 'shareFile':
                this.sharedFiles.set(message.file.id, message.file);
                this.emit('fileShared', message.file);
                break;

            case 'unshareFile':
                this.sharedFiles.delete(message.fileId);
                this.emit('fileUnshared', {
                    fileId: message.fileId,
                    reason: message.reason
                });
                break;

            case 'fileOperation':
                this.handleFileOperation(message);
                break;

            case 'system':
                this.handleSystemMessage(message);
                break;

            case 'error':
                outputChannel.error('Server Error', message.message);
                this.emit('error', new Error(message.message));
                break;

            default:
                outputChannel.warn('Unknown Message',
                    `Received unknown message type: ${message.type}`);
        }
    }

    /**
     * Handle system messages
     */
    private handleSystemMessage(message: any): void {
        switch (message.action) {
            case 'clientJoined':
                this.emit('clientJoined', message.client);
                break;

            case 'clientLeft':
                this.emit('clientLeft', {
                    clientId: message.clientId,
                    clientName: message.clientName
                });
                break;

            default:
                outputChannel.warn('Unknown System Action',
                    `Received unknown system action: ${message.action}`);
        }
    }

    /**
     * Handle file operations
     */
    private handleFileOperation(message: any): void {
        switch (message.operation) {
            case 'update':
                if (message.update) {
                    // Apply update to local document
                    const update = Buffer.from(message.update);
                    this.sharedDocumentManager.applyUpdate(
                        message.fileId,
                        update,
                        'remote' // Mark as remote source
                    );

                    this.emit('documentUpdated', {
                        fileId: message.fileId,
                        source: 'remote'
                    });
                }
                break;

            case 'save':
                this.emit('documentSaved', {
                    fileId: message.fileId,
                    savedBy: message.savedBy
                });
                break;

            default:
                outputChannel.warn('Unknown File Operation',
                    `Received unknown file operation: ${message.operation}`);
        }
    }

    /**
     * Register client with the server
     */
    private register(): boolean {
        return this.sendMessage({
            type: 'register',
            name: this.clientName,
            version: '1.0.0'
        });
    }

    /**
     * Send a message to the server
     */
    private sendMessage(message: any): boolean {
        if (!this.connected || !this.tcpClient) {
            // Queue the message for later
            this.messageQueue.push(message);
            return false;
        }

        try {
            const messageJson = JSON.stringify(message);
            this.tcpClient.write(messageJson);
            return true;
        } catch (error) {
            outputChannel.error('Message Send Error',
                error instanceof Error ? error.message : String(error));
            return false;
        }
    }

    /**
     * Send queued messages
     */
    private flushMessageQueue(): void {
        if (!this.connected || !this.tcpClient) {
            return;
        }

        while (this.messageQueue.length > 0) {
            const message = this.messageQueue.shift();
            this.sendMessage(message);
        }
    }

    /**
     * Attempt to reconnect to the server
     */
    private attemptReconnect(): void {
        if (this.reconnectAttempts >= this.MAX_RECONNECT_ATTEMPTS || this.reconnectTimeout || !this.serverInfo) {
            return;
        }

        this.reconnectAttempts++;

        outputChannel.info('Reconnect',
            `Attempting to reconnect (${this.reconnectAttempts}/${this.MAX_RECONNECT_ATTEMPTS})...`);

        this.reconnectTimeout = setTimeout(async () => {
            this.reconnectTimeout = null;

            try {
                if (this.serverInfo) {
                    await this.connectToServer(this.serverInfo.ip, this.serverInfo.tcpPort);
                }
            } catch (error) {
                // If connect failed, try again
                this.attemptReconnect();
            }
        }, this.RECONNECT_INTERVAL);
    }

    /**
     * Open a shared file in the editor
     */
    async openSharedFile(fileId: string): Promise<boolean> {
        const file = this.sharedFiles.get(fileId);
        if (!file) {
            return false;
        }

        try {
            // Get document state from server
            const documentState = await this.getDocumentState(fileId);

            // Create temporary file path
            const tempFolderPath = path.join(os.tmpdir(), 'vscode-collab');
            if (!fs.existsSync(tempFolderPath)) {
                fs.mkdirSync(tempFolderPath, { recursive: true });
            }

            const localFilePath = path.join(tempFolderPath, file.name);

            // Create local copy of the file
            fs.writeFileSync(localFilePath, documentState || '', 'utf-8');

            // Open file in VSCode
            const document = await vscode.workspace.openTextDocument(localFilePath);
            await vscode.window.showTextDocument(document);

            // Register editor with document manager
            this.sharedDocumentManager.registerEditor(fileId, vscode.window.activeTextEditor!);

            return true;
        } catch (error) {
            outputChannel.error('Open Shared File Error',
                error instanceof Error ? error.message : String(error));
            return false;
        }
    }

    /**
     * Get the current content of a document
     */
    private async getDocumentState(fileId: string): Promise<string | null> {
        return new Promise<string | null>((resolve) => {
            // Set up one-time handler for response
            const handler = (message: any) => {
                if (message.type === 'fileOperation' &&
                    message.operation === 'content' &&
                    message.fileId === fileId) {
                    resolve(message.content);
                    this.removeListener('message', handler);
                }
            };

            this.on('message', handler);

            // Send request for content
            this.sendMessage({
                type: 'fileOperation',
                fileId: fileId,
                operation: 'getContent'
            });

            // Set timeout to avoid hanging forever
            setTimeout(() => {
                this.removeListener('message', handler);
                resolve(null);
            }, 5000);
        });
    }
}
