import * as vscode from 'vscode';
import * as os from 'os';
import { EventEmitter } from 'events';
import { CollabServer } from '../backend/collaboration/CollabServer';
import { CollabClient, ServerInfo } from '../backend/collaboration/CollabClient';
import { SharedFilesView } from './SharedFilesView';
import { ChatView } from './ChatView';
import { outputChannel } from '../utils/OutputChannel';

/**
 * CollaborationManager coordinates all collaboration functionality
 * It acts as a central hub connecting the server, client, and UI components
 */
export class CollaborationManager extends EventEmitter implements vscode.Disposable {
    private static instance: CollaborationManager | undefined;

    private server: CollabServer | undefined;
    private client: CollabClient;
    private isServerRunning = false;
    private isClientConnected = false;

    private statusBarItem: vscode.StatusBarItem;
    private discoveredServers: Map<string, ServerInfo> = new Map();
    private discoveryInterval: NodeJS.Timeout | undefined;

    private disposables: vscode.Disposable[] = [];

    /**
     * Get the singleton instance
     */
    static getInstance(context: vscode.ExtensionContext): CollaborationManager {
        if (!CollaborationManager.instance) {
            CollaborationManager.instance = new CollaborationManager(context);
        }
        return CollaborationManager.instance;
    }

    /**
     * Get the existing instance without creating a new one
     */
    static getExistingInstance(): CollaborationManager | undefined {
        return CollaborationManager.instance;
    }

    private constructor(private context: vscode.ExtensionContext) {
        super();

        // Create client with computer name
        this.client = new CollabClient(os.hostname());

        // Create status bar item
        this.statusBarItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Right,
            100
        );
        this.statusBarItem.command = 'teamCollab.showMenu';
        this.statusBarItem.text = '$(plug) Collab: Disconnected';
        this.statusBarItem.tooltip = 'Team Collaboration';
        this.statusBarItem.show();

        this.disposables.push(this.statusBarItem);

        // Register commands
        this.registerCommands();

        // Set up client event handlers
        this.setupClientEvents();

        // Start server discovery
        this.startServerDiscovery();

        // Update status bar to show initial state
        this.updateStatusBar();
    }

    private registerCommands(): void {
        // Server management commands
        this.disposables.push(
            vscode.commands.registerCommand('teamCollab.startServer', () => this.startServer())
        );

        this.disposables.push(
            vscode.commands.registerCommand('teamCollab.stopServer', () => this.stopServer())
        );

        // Client connection commands
        this.disposables.push(
            vscode.commands.registerCommand('teamCollab.connectToServer', () => this.showServerConnectDialog())
        );

        this.disposables.push(
            vscode.commands.registerCommand('teamCollab.disconnect', () => this.disconnect())
        );

        // UI commands
        this.disposables.push(
            vscode.commands.registerCommand('teamCollab.showMenu', () => this.showCollaborationMenu())
        );

        this.disposables.push(
            vscode.commands.registerCommand('teamCollab.openChat', () => this.openChatView())
        );

        this.disposables.push(
            vscode.commands.registerCommand('teamCollab.shareCurrentFile', () => this.shareCurrentFile())
        );

        this.disposables.push(
            vscode.commands.registerCommand('teamCollab.setUsername', () => this.setUsername())
        );
    }

    private setupClientEvents(): void {
        // Server discovery events
        this.client.on('serverDiscovered', (serverInfo: ServerInfo) => {
            const serverKey = `${serverInfo.ip}:${serverInfo.tcpPort}`;
            this.discoveredServers.set(serverKey, serverInfo);
            this.emit('serversUpdated', Array.from(this.discoveredServers.values()));
        });

        // Connection events
        this.client.on('connected', () => {
            this.isClientConnected = true;
            this.updateStatusBar();

            // Connect views
            SharedFilesView.getInstance(this.context).connectToClient(this.client);
            ChatView.getInstance(this.context).connectToClient(this.client);

            this.emit('clientConnected');
        });

        this.client.on('disconnected', () => {
            this.isClientConnected = false;
            this.updateStatusBar();

            // Disconnect views
            SharedFilesView.getInstance(this.context).disconnectFromClient();
            ChatView.getInstance(this.context).disconnectFromClient();

            this.emit('clientDisconnected');
        });
    }

    /**
     * Start the collaboration server
     */
    async startServer(): Promise<boolean> {
        if (this.isServerRunning) {
            vscode.window.showInformationMessage('Server is already running');
            return true;
        }

        try {
            if (!this.server) {
                this.server = new CollabServer();
            }

            await this.server.startServer();
            this.isServerRunning = true;
            this.updateStatusBar();

            vscode.window.showInformationMessage('Collaboration server started');

            // Also connect to our own server
            const serverInfo = this.server.getServerInfo();
            await this.client.connectToServer('localhost', serverInfo.tcpPort);

            return true;
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to start server: ${error instanceof Error ? error.message : String(error)}`);
            return false;
        }
    }

    /**
     * Stop the collaboration server
     */
    async stopServer(): Promise<boolean> {
        if (!this.isServerRunning || !this.server) {
            vscode.window.showInformationMessage('No server is running');
            return true;
        }

        try {
            // If we're connected to localhost, disconnect first
            if (this.isClientConnected) {
                const serverInfo = this.client.getServerInfo();
                if (serverInfo && ['localhost', '127.0.0.1'].includes(serverInfo.ip)) {
                    await this.disconnect();
                }
            }

            await this.server.stopServer();
            this.isServerRunning = false;
            this.updateStatusBar();

            vscode.window.showInformationMessage('Collaboration server stopped');
            return true;
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to stop server: ${error instanceof Error ? error.message : String(error)}`);
            return false;
        }
    }

    /**
     * Connect to a collaboration server
     */
    async connectToServer(ip: string, port: number): Promise<boolean> {
        if (this.isClientConnected) {
            await this.disconnect();
        }

        try {
            const success = await this.client.connectToServer(ip, port);

            if (success) {
                vscode.window.showInformationMessage(`Connected to server at ${ip}:${port}`);
                return true;
            }

            vscode.window.showErrorMessage(`Failed to connect to server at ${ip}:${port}`);
            return false;
        } catch (error) {
            vscode.window.showErrorMessage(`Connection error: ${error instanceof Error ? error.message : String(error)}`);
            return false;
        }
    }

    /**
     * Disconnect from the current server
     */
    async disconnect(): Promise<void> {
        if (!this.isClientConnected) {
            return;
        }

        await this.client.disconnect();
        vscode.window.showInformationMessage('Disconnected from server');
    }

    /**
     * Set the username for collaboration
     */
    async setUsername(): Promise<void> {
        const currentName = this.client.getClientName();

        const newName = await vscode.window.showInputBox({
            prompt: 'Enter your display name for collaboration',
            value: currentName,
            validateInput: (value) => {
                if (!value || !value.trim()) {
                    return 'Username cannot be empty';
                }
                return null;
            }
        });

        if (newName && newName !== currentName) {
            this.client.setClientName(newName);
            vscode.window.showInformationMessage(`Username set to "${newName}"`);
            this.updateStatusBar();
        }
    }

    /**
     * Share the current active file
     */
    async shareCurrentFile(): Promise<void> {
        if (!this.isClientConnected) {
            vscode.window.showErrorMessage('Cannot share file: Not connected to a server');
            return;
        }

        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('No active file to share');
            return;
        }

        const filePath = editor.document.uri.fsPath;
        const sharedFilesView = SharedFilesView.getInstance(this.context);
        await sharedFilesView.shareFile(filePath);
    }

    /**
     * Show the server connection dialog
     */
    private async showServerConnectDialog(): Promise<void> {
        // Create quick pick items from discovered servers
        const serverItems = Array.from(this.discoveredServers.values()).map(server => ({
            label: `${server.name} (${server.clients} client${server.clients !== 1 ? 's' : ''})`,
            description: `${server.ip}:${server.tcpPort}`,
            server: server as (ServerInfo | null)
        }));

        // Add manual connection option
        serverItems.push({
            label: '$(add) Connect manually...',
            description: 'Specify server IP and port',
            server: null
        });

        const selected = await vscode.window.showQuickPick(serverItems, {
            placeHolder: 'Select a server to connect to'
        });

        if (!selected) {
            return; // User cancelled
        }

        if (selected.server) {
            // Connect to selected server
            await this.connectToServer(selected.server.ip, selected.server.tcpPort);
        } else {
            // Show manual connection dialog
            await this.showManualConnectDialog();
        }
    }

    /**
     * Show dialog for manual server connection
     */
    private async showManualConnectDialog(): Promise<void> {
        const ip = await vscode.window.showInputBox({
            prompt: 'Enter server IP address',
            placeHolder: 'e.g., 192.168.1.100',
            validateInput: (value) => {
                if (!value || !value.trim()) {
                    return 'IP address is required';
                }
                return null;
            }
        });

        if (!ip) {
            return; // User cancelled
        }

        const portInput = await vscode.window.showInputBox({
            prompt: 'Enter server port',
            placeHolder: '6789',
            value: '6789',
            validateInput: (value) => {
                const port = parseInt(value);
                if (isNaN(port) || port < 1 || port > 65535) {
                    return 'Port must be a number between 1-65535';
                }
                return null;
            }
        });

        if (!portInput) {
            return; // User cancelled
        }

        const port = parseInt(portInput);
        await this.connectToServer(ip, port);
    }

    /**
     * Start server discovery
     */
    private startServerDiscovery(): void {
        this.client.startServerDiscovery();

        // Clean up old servers periodically
        if (!this.discoveryInterval) {
            this.discoveryInterval = setInterval(() => {
                const now = Date.now();
                let hasChanges = false;

                for (const [key, server] of this.discoveredServers.entries()) {
                    if (now - server.discoveredAt > 30000) { // 30 seconds
                        this.discoveredServers.delete(key);
                        hasChanges = true;
                    }
                }

                if (hasChanges) {
                    this.emit('serversUpdated', Array.from(this.discoveredServers.values()));
                }
            }, 15000); // Check every 15 seconds
        }
    }

    /**
     * Stop server discovery
     */
    private stopServerDiscovery(): void {
        this.client.stopServerDiscovery();

        if (this.discoveryInterval) {
            clearInterval(this.discoveryInterval);
            this.discoveryInterval = undefined;
        }
    }

    /**
     * Open the chat view
     */
    private openChatView(): void {
        const chatView = ChatView.getInstance(this.context);
        chatView.show();
    }

    /**
     * Show collaboration menu with options
     */
    private async showCollaborationMenu(): Promise<void> {
        const items = [
            {
                label: this.isServerRunning ? '$(stop-circle) Stop Server' : '$(server) Start Server',
                description: this.isServerRunning ? 'Stop hosting a collaboration server' : 'Start hosting a collaboration server',
                command: this.isServerRunning ? 'teamCollab.stopServer' : 'teamCollab.startServer'
            },
            {
                label: this.isClientConnected ? '$(debug-disconnect) Disconnect' : '$(plug) Connect to Server',
                description: this.isClientConnected ? 'Disconnect from the current server' : 'Connect to a collaboration server',
                command: this.isClientConnected ? 'teamCollab.disconnect' : 'teamCollab.connectToServer'
            },
            {
                label: '$(account) Set Username',
                description: `Current: ${this.client.getClientName()}`,
                command: 'teamCollab.setUsername'
            },
            {
                label: '$(comment-discussion) Open Chat',
                description: 'Open the collaboration chat view',
                command: 'teamCollab.openChat'
            },
            {
                label: '$(file) Share Current File',
                description: 'Share the currently open file',
                command: 'teamCollab.shareCurrentFile',
                disabled: !this.isClientConnected
            }
        ];

        const selection = await vscode.window.showQuickPick(
            items.filter(item => !item.disabled),
            { placeHolder: 'Choose a collaboration action' }
        );

        if (selection) {
            vscode.commands.executeCommand(selection.command);
        }
    }

    /**
     * Update the status bar based on current state
     */
    private updateStatusBar(): void {
        if (this.isClientConnected) {
            const serverInfo = this.client.getServerInfo();
            const serverName = serverInfo ? serverInfo.name : 'Server';

            this.statusBarItem.text = `$(sync) Collab: ${serverName}`;
            this.statusBarItem.tooltip = `Connected to ${serverName}`;
        } else if (this.isServerRunning) {
            this.statusBarItem.text = '$(broadcast) Collab: Hosting';
            this.statusBarItem.tooltip = 'Hosting a collaboration server';
        } else {
            this.statusBarItem.text = '$(plug) Collab: Disconnected';
            this.statusBarItem.tooltip = 'Team Collaboration (Disconnected)';
        }
    }

    /**
     * Get the client instance
     */
    getClient(): CollabClient {
        return this.client;
    }

    /**
     * Check if connected to a server
     */
    isConnected(): boolean {
        return this.isClientConnected;
    }

    /**
     * Check if server is running
     */
    isHosting(): boolean {
        return this.isServerRunning;
    }

    /**
     * Dispose all resources
     */
    dispose(): void {
        CollaborationManager.instance = undefined;

        // Stop discovery
        this.stopServerDiscovery();

        // Disconnect if connected
        if (this.isClientConnected) {
            this.client.disconnect();
        }

        // Stop server if running
        if (this.isServerRunning && this.server) {
            this.server.stopServer();
        }

        // Dispose all resources
        this.disposables.forEach(d => d.dispose());
        this.disposables = [];
    }
}

/**
 * Initialize the collaboration manager
 */
export function initializeCollaborationManager(context: vscode.ExtensionContext): CollaborationManager {
    return CollaborationManager.getInstance(context);
}

/**
 * Get the shared document manager
 */
export function getCollaborationManager(): CollaborationManager | undefined {
    return CollaborationManager.getExistingInstance();
}
