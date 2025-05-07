import * as net from 'net';
import * as dgram from 'dgram';
import * as os from 'os';
import * as vscode from 'vscode';
import { outputChannel } from '../../utils/OutputChannel';
import { YjsDocumentManager } from './YjsDocumentManager';

const TCP_PORT = 12345;
const UDP_PORT = 12346;

type MessageType = 'chat' | 'cursor' | 'fileShare' | 'fileUnshare' | 'fileList' | 'docUpdate' | 'requestDoc';

interface Message {
    type: MessageType;
    payload: any;
}

export class ConnectionManager {
    private tcpServer: net.Server | null = null;
    private tcpClients: net.Socket[] = [];
    private tcpConnection: net.Socket | null = null;
    private udpServer: dgram.Socket | null = null;
    private udpClient: dgram.Socket | null = null;
    private targetIp: string = '';
    private sharedFilesProvider: any = null;
    private sharedFiles: Set<string> = new Set();
    private yjsManager: YjsDocumentManager;

    constructor() {
        this.yjsManager = new YjsDocumentManager();

        // Listen for document changes
        vscode.commands.registerCommand('svsmate.documentChanged', (filePath: string, changes: vscode.TextDocumentContentChangeEvent[]) => {
            // Only handle changes for shared files
            if (this.sharedFiles.has(filePath)) {
                this.handleDocumentChanges(filePath, changes);
            }
        });
    }

    setSharedFilesProvider(provider: any) {
        this.sharedFilesProvider = provider;
    }

    getLocalIp(): string {
        const interfaces = os.networkInterfaces();
        for (const name of Object.keys(interfaces)) {
            for (const iface of interfaces[name] || []) {
                // Skip over non-IPv4 and internal (loopback) addresses
                if (iface.family === 'IPv4' && !iface.internal) {
                    return iface.address;
                }
            }
        }
        return 'Unknown';
    }

    startTcpServer() {
        if (this.tcpServer) {
            outputChannel.info('TCP Server', 'Server already running');
            return;
        }

        this.tcpServer = net.createServer((socket) => {
            outputChannel.info('TCP Server', `New connection: ${socket.remoteAddress}`);
            this.tcpClients.push(socket);

            // Send the list of shared files to the new client
            this.sendFileList(socket);

            socket.on('data', (data) => this.handleTcpMessage(data, socket));

            socket.on('close', () => {
                outputChannel.info('TCP Server', `Connection closed: ${socket.remoteAddress}`);
                const index = this.tcpClients.indexOf(socket);
                if (index !== -1) {
                    this.tcpClients.splice(index, 1);
                }
            });

            socket.on('error', (err) => {
                outputChannel.error('TCP Server', `Error: ${err.message}`);
                const index = this.tcpClients.indexOf(socket);
                if (index !== -1) {
                    this.tcpClients.splice(index, 1);
                }
            });
        });

        this.tcpServer.listen(TCP_PORT, () => {
            outputChannel.info('TCP Server', `Server listening on port ${TCP_PORT}`);
            vscode.window.showInformationMessage(`TCP Server started on port ${TCP_PORT}`);
        });

        this.tcpServer.on('error', (err) => {
            outputChannel.error('TCP Server', `Error: ${err.message}`);
            this.tcpServer = null;
        });
    }

    startUdpServer() {
        if (this.udpServer) {
            outputChannel.info('UDP Server', 'Server already running');
            return;
        }

        this.udpServer = dgram.createSocket('udp4');

        this.udpServer.on('message', (msg, rinfo) => {
            this.handleUdpMessage(msg);
        });

        this.udpServer.on('listening', () => {
            const address = this.udpServer?.address();
            outputChannel.info('UDP Server', `Server listening on port ${address?.port}`);
            vscode.window.showInformationMessage(`UDP Server started on port ${address?.port}`);
        });

        this.udpServer.on('error', (err) => {
            outputChannel.error('UDP Server', `Error: ${err.message}`);
            this.udpServer?.close();
            this.udpServer = null;
        });

        this.udpServer.bind(UDP_PORT);
    }

    connectToServer(ip: string) {
        this.targetIp = ip;

        // TCP connection
        this.tcpConnection = new net.Socket();

        this.tcpConnection.connect(TCP_PORT, ip, () => {
            outputChannel.info('TCP Client', `Connected to ${ip}:${TCP_PORT}`);
            vscode.window.showInformationMessage(`Connected to ${ip}:${TCP_PORT}`);

            // Request file list when connected
            const message: Message = {
                type: 'fileList',
                payload: { action: 'request' }
            };
            this.tcpConnection?.write(JSON.stringify(message));
        });

        this.tcpConnection.on('data', (data) => this.handleTcpMessage(data));

        this.tcpConnection.on('close', () => {
            outputChannel.info('TCP Client', 'Connection closed');
            this.tcpConnection = null;
            this.targetIp = '';
        });

        this.tcpConnection.on('error', (err) => {
            outputChannel.error('TCP Client', `Error: ${err.message}`);
            this.tcpConnection?.destroy();
            this.tcpConnection = null;
        });

        // UDP connection
        this.udpClient = dgram.createSocket('udp4');

        this.udpClient.on('error', (err) => {
            outputChannel.error('UDP Client', `Error: ${err.message}`);
            this.udpClient?.close();
            this.udpClient = null;
        });
    }

    disconnect() {
        if (this.tcpConnection) {
            this.tcpConnection.destroy();
            this.tcpConnection = null;
        }

        if (this.udpClient) {
            this.udpClient.close();
            this.udpClient = null;
        }

        outputChannel.info('Client', 'Disconnected');
        vscode.window.showInformationMessage('Disconnected');
    }

    sendMessage(message: string) {
        if (!this.isConnected()) {
            vscode.window.showErrorMessage('Not connected to any server');
            return;
        }

        const messageObj: Message = {
            type: 'chat',
            payload: { text: message }
        };

        if (this.tcpConnection) {
            this.tcpConnection.write(JSON.stringify(messageObj));
            outputChannel.info('TCP Client', `Sent: ${message}`);
        }
    }

    sendCursorPosition(position: vscode.Position, filePath: string) {
        if (!this.isConnected() || !this.sharedFiles.has(filePath)) {
            return;
        }

        const cursorMessage: Message = {
            type: 'cursor',
            payload: {
                line: position.line,
                character: position.character,
                filePath: filePath
            }
        };

        if (this.udpClient && this.targetIp) {
            const data = Buffer.from(JSON.stringify(cursorMessage));
            this.udpClient.send(data, UDP_PORT, this.targetIp, (err) => {
                if (err) {
                    outputChannel.error('UDP Client', `Error sending cursor position: ${err.message}`);
                }
            });
        }
    }

    shareFile(filePath: string) {
        this.sharedFiles.add(filePath);

        // Notify all connected clients about the newly shared file
        const message: Message = {
            type: 'fileShare',
            payload: { path: filePath }
        };

        this.broadcastTcpMessage(message);

        // Initialize Yjs document for this file - now async
        this.yjsManager.getDocument(filePath).catch(err => {
            outputChannel.error('ConnectionManager', `Error initializing Yjs document: ${err}`);
        });
    }

    unshareFile(filePath: string) {
        this.sharedFiles.delete(filePath);

        // Notify all connected clients about the unshared file
        const message: Message = {
            type: 'fileUnshare',
            payload: { path: filePath }
        };

        this.broadcastTcpMessage(message);
    }

    private sendFileList(socket?: net.Socket) {
        const message: Message = {
            type: 'fileList',
            payload: { files: Array.from(this.sharedFiles) }
        };

        if (socket) {
            socket.write(JSON.stringify(message));
        } else if (this.tcpConnection) {
            this.tcpConnection.write(JSON.stringify(message));
        } else {
            this.broadcastTcpMessage(message);
        }
    }

    private broadcastTcpMessage(message: Message) {
        const data = JSON.stringify(message);

        // Send to all clients if we're a server
        if (this.tcpClients.length > 0) {
            for (const client of this.tcpClients) {
                client.write(data);
            }
        }

        // Send to the server if we're a client
        if (this.tcpConnection) {
            this.tcpConnection.write(data);
        }
    }

    private handleTcpMessage(data: Buffer, socket?: net.Socket) {
        try {
            const messages = this.parseJsonMessages(data.toString());

            for (const message of messages) {
                switch (message.type) {
                    case 'chat':
                        this.handleChatMessage(message.payload);
                        break;
                    case 'fileShare':
                        this.handleFileShare(message.payload);
                        break;
                    case 'fileUnshare':
                        this.handleFileUnshare(message.payload);
                        break;
                    case 'fileList':
                        this.handleFileList(message.payload, socket);
                        break;
                    case 'docUpdate':
                        this.handleDocUpdate(message.payload);
                        break;
                    case 'requestDoc':
                        this.handleDocRequest(message.payload, socket);
                        break;
                }
            }
        } catch (err) {
            outputChannel.error('TCP Message', `Error parsing message: ${err}`);
        }
    }

    private handleUdpMessage(data: Buffer) {
        try {
            const message = JSON.parse(data.toString()) as Message;

            if (message.type === 'cursor') {
                const { line, character, filePath } = message.payload;
                this.handleCursorPosition(line, character, filePath);
            }
        } catch (err) {
            outputChannel.error('UDP Message', `Error parsing message: ${err}`);
        }
    }

    private parseJsonMessages(data: string): Message[] {
        // Handle potentially multiple JSON objects concatenated in a single packet
        const messages: Message[] = [];
        let remaining = data;

        while (remaining.length > 0) {
            try {
                const message = JSON.parse(remaining) as Message;
                messages.push(message);
                break;
            } catch (e) {
                // Find the position of the first complete JSON object
                let depth = 0;
                let inString = false;
                let escape = false;

                for (let i = 0; i < remaining.length; i++) {
                    const char = remaining[i];

                    if (inString) {
                        if (char === '\\' && !escape) {
                            escape = true;
                        } else if (char === '"' && !escape) {
                            inString = false;
                        } else {
                            escape = false;
                        }
                    } else if (char === '{') {
                        depth++;
                    } else if (char === '}') {
                        depth--;
                        if (depth === 0) {
                            const messageStr = remaining.substring(0, i + 1);
                            try {
                                const message = JSON.parse(messageStr) as Message;
                                messages.push(message);
                                remaining = remaining.substring(i + 1).trim();
                                break;
                            } catch (err) {
                                // Not a valid JSON object, continue
                            }
                        }
                    } else if (char === '"') {
                        inString = true;
                    }
                }

                // If we reach here without breaking, we couldn't parse the data
                // This might happen with incomplete message fragments
                break;
            }
        }

        return messages;
    }

    private handleChatMessage(payload: any) {
        const { text } = payload;
        outputChannel.info('Chat', `Received: ${text}`);
        vscode.window.showInformationMessage(`Message: ${text}`);
    }

    private handleCursorPosition(line: number, character: number, filePath: string) {
        // Handle cursor position updates
        // This could show a remote cursor in the editor
        outputChannel.info('Cursor', `Remote cursor at ${line}:${character} in ${filePath}`);

        // TODO: Implement showing remote cursor in editor
    }

    private handleFileShare(payload: any) {
        const { path } = payload;
        this.sharedFiles.add(path);

        // Update the shared files view
        if (this.sharedFilesProvider) {
            this.sharedFilesProvider.addFile(path);
        }

        outputChannel.info('Files', `New shared file: ${path}`);

        // Request the initial document state
        if (this.tcpConnection) {
            const requestMessage: Message = {
                type: 'requestDoc',
                payload: { path }
            };
            this.tcpConnection.write(JSON.stringify(requestMessage));
        }
    }

    private handleFileUnshare(payload: any) {
        const { path } = payload;
        this.sharedFiles.delete(path);

        // Update the shared files view
        if (this.sharedFilesProvider) {
            this.sharedFilesProvider.removeFile(path);
        }

        outputChannel.info('Files', `File unshared: ${path}`);
    }

    private handleFileList(payload: any, socket?: net.Socket) {
        if (payload.action === 'request') {
            // Client is requesting our file list
            this.sendFileList(socket);
            return;
        }

        const { files } = payload;

        if (Array.isArray(files)) {
            // Update our local list of shared files
            this.sharedFiles = new Set(files);

            // Update the UI
            if (this.sharedFilesProvider) {
                this.sharedFilesProvider.syncWithManager(files);
            }

            outputChannel.info('Files', `Received shared files list: ${files.join(', ')}`);

            // Request the initial state of each shared file
            if (this.tcpConnection) {
                for (const filePath of files) {
                    const requestMessage: Message = {
                        type: 'requestDoc',
                        payload: { path: filePath }
                    };
                    this.tcpConnection.write(JSON.stringify(requestMessage));
                }
            }
        }
    }

    private async handleDocumentChanges(filePath: string, changes: vscode.TextDocumentContentChangeEvent[]) {
        try {
            // Apply each change to the Yjs document - now async
            for (const change of changes) {
                await this.yjsManager.applyVSCodeChange(filePath, change);
            }

            // Get the update to send over the network - now async
            const update = await this.yjsManager.getUpdate(filePath);

            // Send the update to all connected clients
            const message: Message = {
                type: 'docUpdate',
                payload: {
                    path: filePath,
                    update: Array.from(update) // Convert Uint8Array to Array for JSON
                }
            };

            this.broadcastTcpMessage(message);
        } catch (err) {
            outputChannel.error('ConnectionManager', `Error handling document changes: ${err}`);
        }
    }

    private async handleDocUpdate(payload: any) {
        const { path, update } = payload;

        if (!path || !update || !Array.isArray(update)) {
            outputChannel.error('DocUpdate', 'Invalid update payload');
            return;
        }

        try {
            // Convert array back to Uint8Array
            const updateUint8 = new Uint8Array(update);

            // Apply the update to our local Yjs document - now async
            await this.yjsManager.applyUpdate(path, updateUint8);

            // Apply changes to the editor if the file is open
            vscode.workspace.textDocuments.forEach(doc => {
                if (doc.fileName === path) {
                    vscode.window.visibleTextEditors.forEach(editor => {
                        if (editor.document === doc) {
                            this.yjsManager.applyYjsChanges(path, editor).catch(err => {
                                outputChannel.error('ConnectionManager', `Error applying Yjs changes: ${err}`);
                            });
                        }
                    });
                }
            });
        } catch (err) {
            outputChannel.error('ConnectionManager', `Error handling doc update: ${err}`);
        }
    }

    private async handleDocRequest(payload: any, socket?: net.Socket) {
        const { path } = payload;

        if (!path) {
            return;
        }

        try {
            // If we have this file and are the server (or if we initiated the share)
            if (this.sharedFiles.has(path) && (socket || !this.tcpConnection)) {
                // Get the full document state - now async
                const update = await this.yjsManager.getUpdate(path);

                // Send it to the requesting client
                const response: Message = {
                    type: 'docUpdate',
                    payload: {
                        path,
                        update: Array.from(update)
                    }
                };

                if (socket) {
                    socket.write(JSON.stringify(response));
                } else {
                    this.broadcastTcpMessage(response);
                }
            }
        } catch (err) {
            outputChannel.error('ConnectionManager', `Error handling doc request: ${err}`);
        }
    }

    private isConnected(): boolean {
        return !!(this.tcpConnection || this.tcpClients.length > 0);
    }
}