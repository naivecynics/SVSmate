import * as vscode from 'vscode';
import * as path from 'path';
import * as net from 'net';
import * as dgram from 'dgram';
import * as fs from 'fs';
import * as os from 'os';
import { outputChannel } from '../../utils/OutputChannel';
import { NetworkUtils } from './NetworkUtils';
import { SharedDocumentManager } from './SharedDocumentManager';

const TCP_PORT = 6789;
const UDP_PORT = 6790;

type TCPMessageType = 'system' | 'register' | 'welcome' | 'chat' | 'shareFile' | 'unshareFile' | 'fileOperation' | 'error';
type UDPMessageType = 'discover' | 'serverInfo'

interface ClientInfo {
    id: string;
    name: string;
    ip: string;
    port: number;
    connectedAt: number;
    sharedFiles: string[]; // IDs of files shared by this client
}

interface SharedFile {
    id: string;
    name: string;
    path: string;
    owner: string; // Client ID of the file owner
    sharedAt: number;
    size: number;
    collaborators: string[]; // Client IDs of collaborators
}

export class CollabServer {
    private tcpServer: net.Server | null = null;
    private tcpClients: Map<string, net.Socket> = new Map();
    private clientInfo: Map<string, ClientInfo> = new Map();

    private udpServer: dgram.Socket | null = null;
    private sharedFiles: Map<string, SharedFile> = new Map();

    private sharedDocumentManager: SharedDocumentManager;
    private serverIp: string;

    constructor() {
        this.sharedDocumentManager = new SharedDocumentManager();
        this.serverIp = NetworkUtils.getLocalIp();
    }

    startServer(): Promise<void> {
        return new Promise((resolve, reject) => {
            try {
                // Start TCP server
                if (this.tcpServer) {
                    outputChannel.info('TCP Server', 'Server already running');
                } else {
                    this.initTcpServer();
                }

                // Start UDP server
                if (this.udpServer) {
                    outputChannel.info('UDP Server', 'Server already running');
                } else {
                    this.initUdpServer();
                }

                outputChannel.info('Collaboration Server',
                    `Server started on TCP port: ${TCP_PORT}, UDP port: ${UDP_PORT}`);

                resolve();
            } catch (error) {
                outputChannel.error('Server Start Error', error instanceof Error ? error.message : String(error));
                reject(error);
            }
        });
    }

    stopServer(): Promise<void> {
        return new Promise((resolve) => {
            for (const client of this.tcpClients.values()) {
                client.end();
            }
            this.tcpClients.clear();
            this.clientInfo.clear();

            // Close TCP server
            if (this.tcpServer) {
                this.tcpServer.close(() => {
                    outputChannel.info('TCP Server', 'Server stopped');
                    this.tcpServer = null;
                });
            }

            // Close UDP server
            if (this.udpServer) {
                this.udpServer.close(() => {
                    outputChannel.info('UDP Server', 'Server stopped');
                    this.udpServer = null;
                });
            }

            resolve();
        });
    }

    private initTcpServer(): void {
        this.tcpServer = net.createServer((socket) => {
            const clientId = `${socket.remoteAddress}:${socket.remotePort}`;
            this.tcpClients.set(clientId, socket);

            outputChannel.info('TCP Connection', `Client connected: ${clientId}`);

            // Handle data from clients
            socket.on('data', (data) => {
                try {
                    const message = JSON.parse(data.toString());
                    this.handleTcpMessage(clientId, socket, message);
                } catch (error) {
                    outputChannel.error('TCP Message Error',
                        error instanceof Error ? error.message : String(error));
                }
            });

            // Handle client disconnection
            socket.on('close', () => {
                this.handleClientDisconnect(clientId);
            });

            // Handle errors
            socket.on('error', (error) => {
                outputChannel.error('TCP Client Error', error.message);
                this.handleClientDisconnect(clientId);
            });
        });

        // this.tcpServer.listen(TCP_PORT, this.serverIp, () => {
        //     outputChannel.info('TCP Server', `Listening on ${this.serverIp}:${TCP_PORT}`);
        // });

        this.tcpServer.listen(TCP_PORT, () => {
            outputChannel.info('TCP Server', `Listening on Port:${TCP_PORT}`);
        });

        this.tcpServer.on('error', (error) => {
            outputChannel.error('TCP Server Error', error.message);
        });
    }


    private initUdpServer(): void {
        this.udpServer = dgram.createSocket('udp4');

        // Handle incoming UDP messages
        this.udpServer.on('message', (msg, rinfo) => {
            try {
                const message = JSON.parse(msg.toString());
                this.handleUdpMessage(message, rinfo);
            } catch (error) {
                outputChannel.error('UDP Message Error',
                    error instanceof Error ? error.message : String(error));
            }
        });

        this.udpServer.on('error', (error) => {
            outputChannel.error('UDP Server Error', error.message);
        });

        this.udpServer.bind(UDP_PORT, () => {
            outputChannel.info('UDP Server', `Listening on Port:${UDP_PORT}`);
        });
    }

    private handleTcpMessage(clientId: string, socket: net.Socket, message: any): void {
        const messageType: TCPMessageType = message.type;

        switch (messageType) {
            case 'register':
                // Register a new client
                const clientInfo: ClientInfo = {
                    id: clientId,
                    name: message.name || `User-${Date.now().toString(36)}`,
                    ip: socket.remoteAddress || '',
                    port: socket.remotePort || 0,
                    connectedAt: Date.now(),
                    sharedFiles: []
                };

                this.clientInfo.set(clientId, clientInfo);

                // Send welcome message back to the client
                const welcomeMessage = {
                    type: 'welcome',
                    message: `Welcome to the collaboration server, ${clientInfo.name}!`,
                    clientId: clientId,
                    serverInfo: {
                        name: os.hostname(),
                        clients: Array.from(this.clientInfo.keys()),
                        sharedFiles: Array.from(this.sharedFiles.keys())
                    }
                };
                socket.write(JSON.stringify(welcomeMessage));

                // Broadcast new client to all other clients
                this.broadcastMessage({
                    type: 'system',
                    action: 'clientJoined',
                    client: clientInfo
                }, clientId);

                outputChannel.info('Client Registered', `${clientInfo.name} (${clientId}) registered`);
                break;

            case 'chat':
                // Validate if client is registered
                if (!this.clientInfo.has(clientId)) {
                    socket.write(JSON.stringify({
                        type: 'error',
                        message: 'Not registered. Please register first.'
                    }));
                    return;
                }

                const client = this.clientInfo.get(clientId);
                const chatMessage = {
                    type: 'chat',
                    from: clientId,
                    fromName: client?.name,
                    message: message.message,
                    timestamp: Date.now()
                };

                // Broadcast chat message to all clients
                this.broadcastMessage(chatMessage);
                outputChannel.info('Chat Message',
                    `From ${client?.name}: ${message.message.substring(0, 50)}${message.message.length > 50 ? '...' : ''}`);
                break;

            case 'shareFile':
                // Validate client
                if (!this.clientInfo.has(clientId)) {
                    socket.write(JSON.stringify({
                        type: 'error',
                        message: 'Not registered. Please register first.'
                    }));
                    return;
                }

                // Create a shared file entry
                const fileId = message.fileId || `file-${Date.now().toString(36)}`;
                const sharedFile: SharedFile = {
                    id: fileId,
                    name: message.name,
                    path: message.path,
                    owner: clientId,
                    sharedAt: Date.now(),
                    size: message.size || 0,
                    collaborators: []
                };

                this.sharedFiles.set(fileId, sharedFile);

                // Add file to client's shared files
                const clientData = this.clientInfo.get(clientId);
                if (clientData) {
                    clientData.sharedFiles.push(fileId);
                }

                // Create document in shared document manager
                this.sharedDocumentManager.createDocument(fileId, message.path, clientId);

                // Broadcast file sharing to all clients
                this.broadcastMessage({
                    type: 'shareFile',
                    file: sharedFile
                });

                outputChannel.info('File Shared',
                    `${clientData?.name} shared file: ${message.name}`);
                break;

            case 'unshareFile':
                // Validate client
                if (!this.clientInfo.has(clientId)) {
                    socket.write(JSON.stringify({
                        type: 'error',
                        message: 'Not registered. Please register first.'
                    }));
                    return;
                }

                const fileToRemove = this.sharedFiles.get(message.fileId);

                // Check if file exists and client is the owner
                if (!fileToRemove || fileToRemove.owner !== clientId) {
                    socket.write(JSON.stringify({
                        type: 'error',
                        message: 'Cannot unshare file. File not found or you are not the owner.'
                    }));
                    return;
                }

                // Remove file from shared files
                this.sharedFiles.delete(message.fileId);

                // Remove file from client's shared files
                const client2 = this.clientInfo.get(clientId);
                if (client2) {
                    client2.sharedFiles = client2.sharedFiles.filter(id => id !== message.fileId);
                }

                // Remove from document manager
                this.sharedDocumentManager.removeDocument(message.fileId);

                // Broadcast file unsharing to all clients
                this.broadcastMessage({
                    type: 'unshareFile',
                    fileId: message.fileId
                });

                outputChannel.info('File Unshared',
                    `${client2?.name} unshared file: ${fileToRemove.name}`);
                break;

            case 'fileOperation':
                // Handle file operations (edit, save, etc.)
                if (!this.clientInfo.has(clientId)) {
                    socket.write(JSON.stringify({
                        type: 'error',
                        message: 'Not registered. Please register first.'
                    }));
                    return;
                }

                const file = this.sharedFiles.get(message.fileId);
                if (!file) {
                    socket.write(JSON.stringify({
                        type: 'error',
                        message: 'File not found.'
                    }));
                    return;
                }

                // Process different file operations
                switch (message.operation) {
                    case 'update':
                        // Apply document update
                        if (message.update) {
                            const update = Buffer.from(message.update);
                            this.sharedDocumentManager.applyUpdate(message.fileId, update, clientId);

                            // Broadcast update to all clients except sender
                            this.broadcastMessage({
                                type: 'fileOperation',
                                fileId: message.fileId,
                                operation: 'update',
                                update: message.update
                            }, clientId);
                        }
                        break;

                    case 'save':
                        // Save document to disk
                        this.sharedDocumentManager.saveDocument(message.fileId);

                        // Broadcast save notification
                        this.broadcastMessage({
                            type: 'fileOperation',
                            fileId: message.fileId,
                            operation: 'save',
                            savedBy: clientId
                        });
                        break;

                    default:
                        outputChannel.error('Unknown File Operation',
                            `Received unknown file operation: ${message.operation}`);
                }
                break;

            default:
                outputChannel.error('Unknown TCP Message Type', `Received unknown message type: ${messageType}`);
        }
    }

    private handleUdpMessage(message: any, rinfo: dgram.RemoteInfo): void {
        const messageType: UDPMessageType = message.type;

        switch (messageType) {
            case 'discover':
                const response = {
                    type: 'serverInfo',
                    name: os.hostname(),
                    tcpPort: TCP_PORT,
                    udpPort: UDP_PORT,
                    ip: this.serverIp,
                    clients: this.clientInfo.size
                };

                const responseBuffer = Buffer.from(JSON.stringify(response));
                this.udpServer?.send(responseBuffer, rinfo.port, rinfo.address, (error) => {
                    if (error) {
                        outputChannel.error('UDP Response Error', error.message);
                    } else {
                        outputChannel.info('UDP Response', `Sent server info to ${rinfo.address}:${rinfo.port}`);
                    }
                });
                break;

            default:
                outputChannel.error('Unknown UDP Message Type', `Received unknown message type: ${messageType}`);
        }
    }

    private handleClientDisconnect(clientId: string): void {
        const client = this.clientInfo.get(clientId);

        if (client) {
            // Remove client from client info
            this.clientInfo.delete(clientId);
            this.tcpClients.delete(clientId);

            // Remove or reassign ownership of shared files
            for (const [fileId, file] of this.sharedFiles.entries()) {
                if (file.owner === clientId) {
                    // If owner disconnects, unshare the file
                    this.sharedFiles.delete(fileId);
                    this.sharedDocumentManager.removeDocument(fileId);

                    // Broadcast file unsharing to all clients
                    this.broadcastMessage({
                        type: 'unshareFile',
                        fileId: fileId,
                        reason: 'ownerDisconnected'
                    });
                } else {
                    // Remove client from collaborators if they were one
                    file.collaborators = file.collaborators.filter(id => id !== clientId);
                }
            }

            // Broadcast client disconnection to all clients
            this.broadcastMessage({
                type: 'system',
                action: 'clientLeft',
                clientId: clientId,
                clientName: client.name
            });

            outputChannel.info('TCP Connection', `Client disconnected: ${clientId}`);
        } else {
            outputChannel.error('TCP Connection', `Client not found: ${clientId}`);
        }
    }

    public broadcastMessage(message: any, excludeClientId?: string): void {
        const messageJson = JSON.stringify(message);

        for (const [clientId, socket] of this.tcpClients.entries()) {
            // Don't send message back to the sender if excludeClientId is provided
            if (excludeClientId && clientId === excludeClientId) {
                continue;
            }

            try {
                socket.write(messageJson);
            } catch (error) {
                outputChannel.error('Broadcast Error',
                    `Failed to send message to ${clientId}: ${error instanceof Error ? error.message : String(error)}`);

                // Handle disconnected client
                this.handleClientDisconnect(clientId);
            }
        }
    }

    public getServerInfo(): any {
        return {
            ip: this.serverIp,
            tcpPort: TCP_PORT,
            udpPort: UDP_PORT,
            clients: Array.from(this.clientInfo.values()),
            sharedFiles: Array.from(this.sharedFiles.values()),
            isRunning: this.tcpServer !== null && this.udpServer !== null
        };
    }
}