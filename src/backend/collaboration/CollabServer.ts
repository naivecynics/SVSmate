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

interface ClientConnection {
    socket: net.Socket;
    id: string;
    name: string;
    joinedAt: number;
}

interface ServerMessage {
    type: 'documentUpdate' | 'documentList' | 'clientJoined' | 'clientLeft' | 'error' | 'documentShared';
    payload: any;
    timestamp: number;
}

export class CollabServer {
    private tcpServer: net.Server | null = null;
    private udpServer: dgram.Socket | null = null;
    private clients: Map<string, ClientConnection> = new Map();
    private documentManager: SharedDocumentManager;
    private isRunning: boolean = false;
    private serverName: string;

    constructor() {
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

        // Send current document list
        this.sendToClient(clientId, {
            type: 'documentList',
            payload: this.documentManager.getAllDocumentMetadata(),
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
                case 'shareDocument':
                    this.handleShareDocument(clientId, message.payload);
                    break;
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

    private async handleDocumentUpdate(clientId: string, payload: any) {
        const { fileId, update } = payload;
        const updateArray = new Uint8Array(update);

        if (await this.documentManager.applyUpdate(fileId, updateArray, clientId)) {
            // Broadcast to other clients
            this.broadcastToClients({
                type: 'documentUpdate',
                payload: { fileId, update, origin: clientId },
                timestamp: Date.now()
            }, clientId);
        }
    }

    private async handleDocumentRequest(clientId: string, fileId: string) {
        const state = await this.documentManager.getDocumentState(fileId);
        if (state) {
            this.sendToClient(clientId, {
                type: 'documentUpdate',
                payload: { fileId, update: Array.from(state), origin: 'server' },
                timestamp: Date.now()
            });
        }
    }

    private async handleShareDocument(clientId: string, payload: any) {
        const { filePath, name } = payload;
        const fileId = `${clientId}_${Date.now()}_${name}`;
        const client = this.clients.get(clientId);

        if (client) {
            const doc = await this.documentManager.createDocument(fileId, filePath, client.name);
            if (doc) {
                this.broadcastToClients({
                    type: 'documentShared',
                    payload: this.documentManager.getDocumentMetadata(fileId),
                    timestamp: Date.now()
                });
            }
        }
    }

    private handleUnshareDocument(clientId: string, fileId: string) {
        if (this.documentManager.removeDocument(fileId)) {
            this.broadcastToClients({
                type: 'documentList',
                payload: this.documentManager.getAllDocumentMetadata(),
                timestamp: Date.now()
            });
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
        const client = this.clients.get(clientId);
        if (client && !client.socket.destroyed) {
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

        // Close all client connections
        for (const [clientId, client] of this.clients) {
            client.socket.end();
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