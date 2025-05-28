import * as vscode from 'vscode';
import * as net from 'net';
import * as dgram from 'dgram';

export interface ServerFile {
    id: string;
    name: string;
    content: string;
    lastTimestamp?: number;
}

export interface DiscoveredServer {
    ip: string;
    port: number;
    clientCount: number;
    sharedFilesCount: number;
    serverName: string;
    lastSeen: number;
}

export interface ChatMessage {
    id: string;
    sender: string;
    content: string;
    timestamp: number;
}

export interface OpenDocument {
    fileId: string;
    document: vscode.TextDocument;
    changeListener: vscode.Disposable;
    closeListener: vscode.Disposable;
    isUpdating: boolean;
}

export class CollaborationClient {
    private socket: net.Socket | null = null;
    private isConnected = false;
    private serverIP = '';
    private serverPort = 0;
    private serverFiles: Map<string, ServerFile> = new Map();
    private openDocuments: Map<string, OpenDocument> = new Map();
    private onFilesUpdatedCallback?: () => void;
    private updateInProgress = new Set<string>(); // Prevent update loops
    private discoveredServers: Map<string, DiscoveredServer> = new Map();
    private onServersUpdatedCallback?: () => void;
    private discoveryPort: number = 8889;
    private latestMessage?: ChatMessage;
    private onMessageReceivedCallback?: (message: ChatMessage) => void;
    private username: string = '';

    constructor() {
        this.loadUsername();
    }

    /**
     * Load username from VS Code settings
     */
    private loadUsername(): void {
        const config = vscode.workspace.getConfiguration('svsmate');
        this.username = config.get('collaboration.username', '') || require('os').hostname() || 'Unknown User';
    }

    /**
     * Set username and save to settings
     */
    async setUsername(newUsername: string): Promise<void> {
        if (!newUsername.trim()) {
            vscode.window.showErrorMessage('Username cannot be empty');
            return;
        }

        this.username = newUsername.trim();
        const config = vscode.workspace.getConfiguration('svsmate');
        await config.update('collaboration.username', this.username, vscode.ConfigurationTarget.Global);

        // If connected, notify server about username change
        if (this.isConnected && this.socket) {
            try {
                const message = {
                    type: 'usernameUpdate',
                    data: {
                        username: this.username
                    }
                };
                this.socket.write(JSON.stringify(message));
            } catch (error) {
                console.error('Failed to send username update:', error);
            }
        }

        vscode.window.showInformationMessage(`Username changed to: ${this.username}`);
    }

    /**
     * Get current username
     */
    getUsername(): string {
        return this.username;
    }

    /**
     * Connect to a collaboration server
     */
    async connect(ip: string, port: number): Promise<void> {
        if (this.isConnected) {
            await this.disconnect();
        }

        // Reload username before connecting
        this.loadUsername();

        return new Promise((resolve, reject) => {
            this.socket = new net.Socket();
            this.serverIP = ip;
            this.serverPort = port;

            this.socket.connect(port, ip, () => {
                this.isConnected = true;

                // Send initial username to server
                try {
                    const message = {
                        type: 'usernameUpdate',
                        data: {
                            username: this.username
                        }
                    };
                    this.socket!.write(JSON.stringify(message));
                } catch (error) {
                    console.error('Failed to send initial username:', error);
                }

                vscode.window.showInformationMessage(`Connected to server ${ip}:${port} as ${this.username}`);
                resolve();
            });

            this.socket.on('data', (data) => {
                try {
                    const message = JSON.parse(data.toString());
                    this.handleServerMessage(message);
                } catch (error) {
                    console.error('Failed to parse server message:', error);
                }
            });

            this.socket.on('error', (err) => {
                this.isConnected = false;
                vscode.window.showErrorMessage(`Connection error: ${err.message}`);
                reject(err);
            });

            this.socket.on('close', () => {
                this.isConnected = false;
                vscode.window.showInformationMessage('Disconnected from server');
            });
        });
    }

    /**
     * Disconnect from the server
     */
    async disconnect(): Promise<void> {
        // Clean up all open documents
        for (const [fileId] of this.openDocuments) {
            this.cleanupDocument(fileId);
        }

        if (this.socket) {
            this.socket.destroy();
            this.socket = null;
        }
        this.isConnected = false;
        this.serverFiles.clear();
        if (this.onFilesUpdatedCallback) {
            this.onFilesUpdatedCallback();
        }
    }

    /**
     * Open a shared file from the server
     */
    async openSharedFile(fileId: string): Promise<void> {
        const serverFile = this.serverFiles.get(fileId);
        if (!serverFile) {
            vscode.window.showErrorMessage('File not found');
            return;
        }

        // Check if file is already open
        if (this.openDocuments.has(fileId)) {
            const openDoc = this.openDocuments.get(fileId)!;
            await vscode.window.showTextDocument(openDoc.document);
            return;
        }

        try {
            // Create a new untitled document with the file content
            const document = await vscode.workspace.openTextDocument({
                content: serverFile.content,
                language: this.getLanguageFromFileName(serverFile.name)
            });

            // Show the document in the editor
            await vscode.window.showTextDocument(document);

            // Listen for changes to sync back to server
            const changeListener = vscode.workspace.onDidChangeTextDocument((event) => {
                const openDoc = this.openDocuments.get(fileId);
                if (event.document === document && openDoc && !openDoc.isUpdating) {
                    this.sendFileUpdate(fileId, event.document.getText());
                }
            });

            // Clean up listener when document is closed
            const closeListener = vscode.workspace.onDidCloseTextDocument((closedDoc) => {
                if (closedDoc === document) {
                    this.cleanupDocument(fileId);
                }
            });

            // Track the open document
            this.openDocuments.set(fileId, {
                fileId,
                document,
                changeListener,
                closeListener,
                isUpdating: false
            });

        } catch (error) {
            vscode.window.showErrorMessage(`Failed to open file: ${error}`);
        }
    }

    /**
     * Clean up document tracking when file is closed
     */
    private cleanupDocument(fileId: string): void {
        const openDoc = this.openDocuments.get(fileId);
        if (openDoc) {
            openDoc.changeListener.dispose();
            openDoc.closeListener.dispose();
            this.openDocuments.delete(fileId);
        }
    }

    /**
     * Get connection status
     */
    getConnectionInfo(): { isConnected: boolean; serverIP: string; serverPort: number } {
        return {
            isConnected: this.isConnected,
            serverIP: this.serverIP,
            serverPort: this.serverPort
        };
    }

    /**
     * Get available server files
     */
    getServerFiles(): ServerFile[] {
        return Array.from(this.serverFiles.values());
    }

    /**
     * Set callback for when files are updated
     */
    onFilesUpdated(callback: () => void): void {
        this.onFilesUpdatedCallback = callback;
    }

    /**
     * Discover available servers on the network
     */
    async discoverServers(): Promise<DiscoveredServer[]> {
        return new Promise((resolve) => {
            const client = dgram.createSocket('udp4');
            const discoveredServers = new Map<string, DiscoveredServer>();

            // Clear old discoveries
            this.discoveredServers.clear();

            const request = {
                type: 'discover'
            };

            const requestBuffer = Buffer.from(JSON.stringify(request));

            // Listen for responses
            client.on('message', (msg, rinfo) => {
                try {
                    const response = JSON.parse(msg.toString());
                    if (response.type === 'server_info') {
                        const serverKey = `${response.data.ip}:${response.data.port}`;
                        const server: DiscoveredServer = {
                            ip: response.data.ip,
                            port: response.data.port,
                            clientCount: response.data.clientCount,
                            sharedFilesCount: response.data.sharedFilesCount,
                            serverName: response.data.serverName,
                            lastSeen: Date.now()
                        };

                        discoveredServers.set(serverKey, server);
                        this.discoveredServers.set(serverKey, server);
                    }
                } catch (error) {
                    console.error('Failed to parse discovery response:', error);
                }
            });

            client.on('error', (err) => {
                console.error('Discovery client error:', err);
            });

            // Bind to any available port
            client.bind(() => {
                // Enable broadcast
                client.setBroadcast(true);

                // Send broadcast to common network ranges
                const networkRanges = this.getNetworkRanges();

                for (const range of networkRanges) {
                    client.send(requestBuffer, this.discoveryPort, range, (err) => {
                        if (err) {
                            console.error(`Failed to send discovery to ${range}:`, err);
                        }
                    });
                }

                // Also try localhost
                client.send(requestBuffer, this.discoveryPort, '127.0.0.1');
            });

            // Wait for responses and then resolve
            setTimeout(() => {
                client.close();
                const servers = Array.from(discoveredServers.values());

                if (this.onServersUpdatedCallback) {
                    this.onServersUpdatedCallback();
                }

                if (servers.length > 0) {
                    vscode.window.showInformationMessage(`Found ${servers.length} collaboration server(s)`);
                } else {
                    vscode.window.showInformationMessage('No collaboration servers found on the network');
                }

                resolve(servers);
            }, 3000); // Wait 3 seconds for responses
        });
    }

    /**
     * Get discovered servers
     */
    getDiscoveredServers(): DiscoveredServer[] {
        return Array.from(this.discoveredServers.values());
    }

    /**
     * Set callback for when discovered servers are updated
     */
    onServersUpdated(callback: () => void): void {
        this.onServersUpdatedCallback = callback;
    }

    /**
     * Connect to a discovered server
     */
    async connectToDiscoveredServer(server: DiscoveredServer): Promise<void> {
        await this.connect(server.ip, server.port);
    }

    /**
     * Get network broadcast addresses for discovery
     */
    private getNetworkRanges(): string[] {
        const ranges: string[] = [];
        const interfaces = require('os').networkInterfaces();

        for (const interfaceName in interfaces) {
            const addresses = interfaces[interfaceName];
            if (addresses) {
                for (const address of addresses) {
                    if (address.family === 'IPv4' && !address.internal) {
                        // Calculate broadcast address
                        const ip = address.address.split('.').map(Number);
                        const netmask = address.netmask.split('.').map(Number);

                        const broadcast = ip.map((octet: number, i: number) => {
                            return octet | (~netmask[i] & 255);
                        });

                        ranges.push(broadcast.join('.'));
                    }
                }
            }
        }

        // Add common broadcast addresses if none found
        if (ranges.length === 0) {
            ranges.push('192.168.1.255', '192.168.0.255', '10.0.0.255');
        }

        return ranges;
    }

    private handleServerMessage(message: any): void {
        switch (message.type) {
            case 'welcome':
                // Handle welcome message with initial shared files
                const sharedFiles = message.data.sharedFiles || [];
                this.serverFiles.clear();
                for (const file of sharedFiles) {
                    this.serverFiles.set(file.id, {
                        id: file.id,
                        name: file.name,
                        content: file.content,
                        lastTimestamp: file.lastModified
                    });
                }
                if (this.onFilesUpdatedCallback) {
                    this.onFilesUpdatedCallback();
                }
                break;

            case 'fileShared':
                // Handle new file shared
                const newFile = message.data;
                this.serverFiles.set(newFile.id, {
                    id: newFile.id,
                    name: newFile.name,
                    content: newFile.content,
                    lastTimestamp: Date.now()
                });
                if (this.onFilesUpdatedCallback) {
                    this.onFilesUpdatedCallback();
                }
                vscode.window.showInformationMessage(`New file shared: ${newFile.name}`);
                break;

            case 'fileUpdated':
                // Handle file content update
                const updateData = message.data;
                this.handleFileUpdate(updateData.id, updateData.content, updateData.timestamp);
                break;

            case 'pong':
                // Handle ping response
                break;
            case 'chatMessage':
                // Handle chat message from server
                const chatMessage: ChatMessage = {
                    id: message.data.id || `msg_${Date.now()}`,
                    sender: message.data.sender || 'Unknown',
                    content: message.data.content,
                    timestamp: message.data.timestamp || Date.now()
                };
                this.latestMessage = chatMessage;
                if (this.onMessageReceivedCallback) {
                    this.onMessageReceivedCallback(chatMessage);
                }
                break;
        }
    }

    /**
     * Handle file updates from server
     */
    private async handleFileUpdate(fileId: string, content: string, timestamp?: number): Promise<void> {
        // Prevent update loops
        if (this.updateInProgress.has(fileId)) {
            return;
        }

        // Update the stored file content
        const existingFile = this.serverFiles.get(fileId);
        if (existingFile) {
            // Check timestamp to avoid applying old updates
            if (timestamp && existingFile.lastTimestamp && timestamp < existingFile.lastTimestamp) {
                return;
            }

            existingFile.content = content;
            existingFile.lastTimestamp = timestamp || Date.now();
        }

        // Update open document if it exists
        const openDoc = this.openDocuments.get(fileId);
        if (openDoc && openDoc.document.getText() !== content) {
            this.updateInProgress.add(fileId);
            openDoc.isUpdating = true;

            try {
                // Apply edit to the document
                const edit = new vscode.WorkspaceEdit();
                const fullRange = new vscode.Range(
                    openDoc.document.positionAt(0),
                    openDoc.document.positionAt(openDoc.document.getText().length)
                );
                edit.replace(openDoc.document.uri, fullRange, content);
                await vscode.workspace.applyEdit(edit);

                // Show a subtle indication that the file was updated
                vscode.window.setStatusBarMessage('File updated from server', 2000);
            } catch (error) {
                console.error('Failed to update document:', error);
            } finally {
                openDoc.isUpdating = false;
                // Remove from progress tracking after a short delay
                setTimeout(() => {
                    this.updateInProgress.delete(fileId);
                }, 100);
            }
        }
    }

    private sendFileUpdate(fileId: string, content: string): void {
        if (!this.isConnected || !this.socket) {
            return;
        }

        try {
            const message = {
                type: 'fileContentUpdate',
                data: {
                    fileId: fileId,
                    content: content,
                    timestamp: Date.now()
                }
            };
            this.socket.write(JSON.stringify(message));
        } catch (error) {
            console.error('Failed to send file update:', error);
        }
    }

    /**
     * Send a chat message to the server
     */
    sendMessage(content: string): void {
        if (!this.isConnected || !this.socket) {
            vscode.window.showErrorMessage('Not connected to server');
            return;
        }

        try {
            const message = {
                type: 'chatMessage',
                data: {
                    content: content,
                    timestamp: Date.now(),
                    sender: this.username
                }
            };
            this.socket.write(JSON.stringify(message));
        } catch (error) {
            console.error('Failed to send message:', error);
            vscode.window.showErrorMessage('Failed to send message');
        }
    }

    /**
     * Get the latest chat message
     */
    getLatestMessage(): ChatMessage | undefined {
        return this.latestMessage;
    }

    /**
     * Set callback for when a message is received
     */
    onMessageReceived(callback: (message: ChatMessage) => void): void {
        this.onMessageReceivedCallback = callback;
    }

    private getLanguageFromFileName(fileName: string): string {
        const ext = fileName.split('.').pop()?.toLowerCase();
        const languageMap: { [key: string]: string } = {
            'ts': 'typescript',
            'js': 'javascript',
            'py': 'python',
            'java': 'java',
            'cpp': 'cpp',
            'c': 'c',
            'cs': 'csharp',
            'html': 'html',
            'css': 'css',
            'json': 'json',
            'xml': 'xml',
            'md': 'markdown',
            'txt': 'plaintext'
        };
        return languageMap[ext || ''] || 'plaintext';
    }
}

// Global client instance
export const collaborationClient = new CollaborationClient();
