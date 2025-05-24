import * as vscode from 'vscode';
import { CollabClient } from '../backend/collaboration/CollabClient';
import { outputChannel } from '../utils/OutputChannel';

/**
 * Chat message interface
 */
interface ChatMessage {
    id: string;
    from: string;
    fromName: string;
    message: string;
    timestamp: number;
    isSelf: boolean;
}

/**
 * ChatView provides a VS Code WebView-based UI for the collaboration chat
 */
export class ChatView implements vscode.Disposable {
    public static readonly viewType = 'collaborationChat';
    private static instance: ChatView | undefined;

    private panel: vscode.WebviewPanel | undefined;
    private context: vscode.ExtensionContext;
    private client: CollabClient | undefined;
    private disposables: vscode.Disposable[] = [];
    private messages: ChatMessage[] = [];
    private participants: { id: string, name: string }[] = [];

    /**
     * Get the singleton instance of ChatView
     */
    public static getInstance(context: vscode.ExtensionContext): ChatView {
        if (!ChatView.instance) {
            ChatView.instance = new ChatView(context);
        }
        return ChatView.instance;
    }

    /**
     * Check if the chat view is already created
     */
    public static isCreated(): boolean {
        return !!ChatView.instance?.panel;
    }

    private constructor(context: vscode.ExtensionContext) {
        this.context = context;
    }

    /**
     * Connect the chat view to a CollabClient
     */
    public connectToClient(client: CollabClient): void {
        // Disconnect existing client if any
        this.disconnectFromClient();

        this.client = client;

        // Register event listeners
        this.client.on('chatMessage', this.handleChatMessage);
        this.client.on('connected', this.handleClientConnected);
        this.client.on('disconnected', this.handleClientDisconnected);
        this.client.on('clientJoined', this.handleClientJoined);
        this.client.on('clientLeft', this.handleClientLeft);

        // Update UI based on current connection state
        if (this.client.isConnected()) {
            this.updateConnectionStatus(true);
            const serverInfo = this.client.getServerInfo();
            if (serverInfo) {
                this.addSystemMessage(`Connected to ${serverInfo.name}`);
            }
        } else {
            this.updateConnectionStatus(false);
        }
    }

    /**
     * Disconnect from the current client
     */
    public disconnectFromClient(): void {
        if (this.client) {
            this.client.removeListener('chatMessage', this.handleChatMessage);
            this.client.removeListener('connected', this.handleClientConnected);
            this.client.removeListener('disconnected', this.handleClientDisconnected);
            this.client.removeListener('clientJoined', this.handleClientJoined);
            this.client.removeListener('clientLeft', this.handleClientLeft);
            this.client = undefined;
            this.updateConnectionStatus(false);
        }
    }

    /**
     * Show the chat view
     */
    public show(): void {
        if (this.panel) {
            this.panel.reveal(vscode.ViewColumn.Beside);
            return;
        }

        // Create and show panel
        this.panel = vscode.window.createWebviewPanel(
            ChatView.viewType,
            'Team Chat',
            vscode.ViewColumn.Beside,
            {
                enableScripts: true,
                localResourceRoots: [
                    vscode.Uri.joinPath(this.context.extensionUri, 'media')
                ],
                retainContextWhenHidden: true
            }
        );

        // Set icon
        this.panel.iconPath = {
            light: vscode.Uri.joinPath(this.context.extensionUri, 'media', 'chat-light.svg'),
            dark: vscode.Uri.joinPath(this.context.extensionUri, 'media', 'chat-dark.svg')
        };

        // Setup initial HTML content
        this.panel.webview.html = this.getWebviewContent();

        // Handle messages from the webview
        this.panel.webview.onDidReceiveMessage(
            this.handleWebviewMessage,
            undefined,
            this.disposables
        );

        // Handle panel disposal
        this.panel.onDidDispose(
            () => {
                this.panel = undefined;

                // Don't disconnect from client when panel is closed
                // Just clear the reference to the panel
            },
            undefined,
            this.disposables
        );

        // Update connection status
        this.updateConnectionStatus(this.client?.isConnected() || false);

        // Send existing messages to the webview
        if (this.messages.length > 0) {
            this.panel.webview.postMessage({
                command: 'updateMessages',
                messages: this.messages
            });
        }

        // Send participants list
        if (this.participants.length > 0) {
            this.panel.webview.postMessage({
                command: 'updateParticipants',
                participants: this.participants
            });
        }
    }

    /**
     * Send a chat message
     */
    public sendMessage(message: string): void {
        if (!this.client) {
            this.showNotification('Cannot send message: Not connected to a server');
            return;
        }

        if (!message.trim()) {
            return;
        }

        const success = this.client.sendChatMessage(message);
        if (!success) {
            this.showNotification('Failed to send message. Check your connection.');
        }
    }

    /**
     * Add a system message to the chat
     */
    public addSystemMessage(message: string): void {
        this.addMessage({
            id: `system-${Date.now()}`,
            from: 'system',
            fromName: 'System',
            message: message,
            timestamp: Date.now(),
            isSelf: false
        });
    }

    /**
     * Clear all messages
     */
    public clearMessages(): void {
        this.messages = [];
        if (this.panel) {
            this.panel.webview.postMessage({
                command: 'updateMessages',
                messages: []
            });
        }
    }

    /**
     * Show a notification to the user
     */
    private showNotification(message: string): void {
        vscode.window.showInformationMessage(message);
    }

    /**
     * Handle messages from the webview
     */
    private handleWebviewMessage = (message: any) => {
        switch (message.command) {
            case 'sendMessage':
                this.sendMessage(message.text);
                break;

            case 'clearMessages':
                this.clearMessages();
                break;

            case 'requestConnectionStatus':
                this.updateConnectionStatus(this.client?.isConnected() || false);
                break;
        }
    }

    /**
     * Handle incoming chat messages from the CollabClient
     */
    private handleChatMessage = (message: any) => {
        const clientId = this.client?.getClientId();

        this.addMessage({
            id: `msg-${message.from}-${message.timestamp}`,
            from: message.from,
            fromName: message.fromName || 'Unknown',
            message: message.message,
            timestamp: message.timestamp,
            isSelf: message.from === clientId
        });
    }

    /**
     * Handle client connected event
     */
    private handleClientConnected = () => {
        this.updateConnectionStatus(true);
        const serverInfo = this.client?.getServerInfo();
        if (serverInfo) {
            this.addSystemMessage(`Connected to ${serverInfo.name}`);
        } else {
            this.addSystemMessage('Connected to server');
        }
    }

    /**
     * Handle client disconnected event
     */
    private handleClientDisconnected = () => {
        this.updateConnectionStatus(false);
        this.addSystemMessage('Disconnected from server');

        // Clear participants when disconnected
        this.participants = [];
        if (this.panel) {
            this.panel.webview.postMessage({
                command: 'updateParticipants',
                participants: []
            });
        }
    }

    /**
     * Handle client joined event
     */
    private handleClientJoined = (client: any) => {
        // Add to participants list
        if (!this.participants.some(p => p.id === client.id)) {
            this.participants.push({
                id: client.id,
                name: client.name
            });

            if (this.panel) {
                this.panel.webview.postMessage({
                    command: 'updateParticipants',
                    participants: this.participants
                });
            }
        }

        this.addSystemMessage(`${client.name} joined the chat`);
    }

    /**
     * Handle client left event
     */
    private handleClientLeft = (info: { clientId: string, clientName: string }) => {
        // Remove from participants list
        this.participants = this.participants.filter(p => p.id !== info.clientId);

        if (this.panel) {
            this.panel.webview.postMessage({
                command: 'updateParticipants',
                participants: this.participants
            });
        }

        this.addSystemMessage(`${info.clientName} left the chat`);
    }

    /**
     * Add a message to the chat
     */
    private addMessage(message: ChatMessage): void {
        this.messages.push(message);

        // Keep only the last 100 messages to avoid memory issues
        if (this.messages.length > 100) {
            this.messages = this.messages.slice(-100);
        }

        if (this.panel) {
            this.panel.webview.postMessage({
                command: 'updateMessages',
                messages: this.messages
            });
        }
    }

    /**
     * Update connection status in the webview
     */
    private updateConnectionStatus(connected: boolean): void {
        if (!this.panel) {
            return;
        }

        const serverInfo = this.client?.getServerInfo();
        const serverName = serverInfo?.name || '';

        this.panel.webview.postMessage({
            command: 'updateConnectionStatus',
            connected: connected,
            serverName: serverName
        });

        // Update panel title based on connection
        if (connected && serverName) {
            this.panel.title = `Chat - ${serverName}`;
        } else {
            this.panel.title = 'Team Chat';
        }
    }

    /**
     * Get the webview HTML content
     */
    private getWebviewContent(): string {
        const styleUri = this.getStyleUri();
        const scriptUri = this.getScriptUri();

        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Team Chat</title>
            <link href="${styleUri}" rel="stylesheet" />
        </head>
        <body>
            <div class="chat-container">
                <header class="chat-header">
                    <div class="connection-status">
                        <span class="status-indicator disconnected"></span>
                        <span id="status-text">Disconnected</span>
                    </div>
                    <div class="header-actions">
                        <button id="clear-btn" title="Clear messages">Clear</button>
                    </div>
                </header>
                
                <div class="chat-main">
                    <div class="messages-container" id="messages">
                        <div class="welcome-message">Welcome to Team Chat</div>
                    </div>
                    
                    <div class="sidebar">
                        <h3>Participants</h3>
                        <ul id="participants-list" class="participants-list">
                            <li class="empty-list">No participants</li>
                        </ul>
                    </div>
                </div>
                
                <div class="input-container">
                    <textarea 
                        id="message-input" 
                        placeholder="Type a message..." 
                        rows="2" 
                        disabled
                    ></textarea>
                    <button id="send-btn" disabled>Send</button>
                </div>
            </div>
            <script src="${scriptUri}"></script>
        </body>
        </html>`;
    }

    /**
     * Get the style URI for the webview
     */
    private getStyleUri(): vscode.Uri {
        // Create a URI for a stylesheet that doesn't exist yet
        // We'll serve the stylesheet content through the nonce
        return this.panel!.webview.asWebviewUri(
            vscode.Uri.joinPath(this.context.extensionUri, 'media', 'chat-style.css')
        );
    }

    /**
     * Get the script URI for the webview
     */
    private getScriptUri(): vscode.Uri {
        // Create a URI for a script that doesn't exist yet
        // We'll serve the script content through the nonce
        return this.panel!.webview.asWebviewUri(
            vscode.Uri.joinPath(this.context.extensionUri, 'media', 'chat-script.js')
        );
    }

    /**
     * Dispose the view and clean up resources
     */
    public dispose(): void {
        ChatView.instance = undefined;
        this.disconnectFromClient();

        if (this.panel) {
            this.panel.dispose();
            this.panel = undefined;
        }

        this.disposables.forEach(d => d.dispose());
        this.disposables = [];
    }
}

/**
 * Create CSS style content for the chat view
 * Use this to write the CSS file to disk during extension activation
 */
export function getChatStyleContent(): string {
    return `
    body {
        font-family: var(--vscode-font-family);
        font-size: var(--vscode-font-size);
        color: var(--vscode-foreground);
        background-color: var(--vscode-editor-background);
        padding: 0;
        margin: 0;
    }
    
    .chat-container {
        display: flex;
        flex-direction: column;
        height: 100vh;
        max-width: 100%;
    }
    
    .chat-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 8px 16px;
        background-color: var(--vscode-editor-inactiveSelectionBackground);
        border-bottom: 1px solid var(--vscode-panel-border);
    }
    
    .connection-status {
        display: flex;
        align-items: center;
        font-size: 12px;
    }
    
    .status-indicator {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        margin-right: 8px;
    }
    
    .connected {
        background-color: #3fb950;
    }
    
    .disconnected {
        background-color: #f85149;
    }
    
    .header-actions {
        display: flex;
    }
    
    button {
        background-color: var(--vscode-button-background);
        color: var(--vscode-button-foreground);
        border: none;
        padding: 6px 12px;
        cursor: pointer;
        border-radius: 2px;
    }
    
    button:hover {
        background-color: var(--vscode-button-hoverBackground);
    }
    
    button:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }
    
    .chat-main {
        display: flex;
        flex: 1;
        overflow: hidden;
    }
    
    .messages-container {
        flex: 1;
        padding: 16px;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
    }
    
    .sidebar {
        width: 200px;
        background-color: var(--vscode-sideBar-background);
        border-left: 1px solid var(--vscode-panel-border);
        padding: 16px;
        overflow-y: auto;
    }
    
    .sidebar h3 {
        margin-top: 0;
        font-size: 14px;
        font-weight: 600;
        margin-bottom: 16px;
    }
    
    .participants-list {
        list-style: none;
        padding: 0;
        margin: 0;
    }
    
    .participant {
        margin-bottom: 8px;
        display: flex;
        align-items: center;
    }
    
    .participant-indicator {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background-color: #3fb950;
        margin-right: 8px;
    }
    
    .empty-list {
        color: var(--vscode-descriptionForeground);
        font-style: italic;
    }
    
    .input-container {
        padding: 12px;
        background-color: var(--vscode-editor-inactiveSelectionBackground);
        border-top: 1px solid var(--vscode-panel-border);
        display: flex;
        align-items: flex-end;
    }
    
    #message-input {
        flex: 1;
        resize: none;
        background-color: var(--vscode-input-background);
        color: var(--vscode-input-foreground);
        border: 1px solid var(--vscode-input-border);
        border-radius: 3px;
        padding: 8px;
        margin-right: 8px;
        font-family: var(--vscode-font-family);
    }
    
    #send-btn {
        height: 32px;
        align-self: flex-end;
    }
    
    .message {
        margin-bottom: 16px;
        max-width: 70%;
        padding: 10px;
        border-radius: 8px;
        position: relative;
    }
    
    .message-self {
        align-self: flex-end;
        background-color: var(--vscode-button-background);
        color: var(--vscode-button-foreground);
    }
    
    .message-other {
        align-self: flex-start;
        background-color: var(--vscode-editor-inactiveSelectionBackground);
    }
    
    .message-system {
        align-self: center;
        color: var(--vscode-descriptionForeground);
        font-style: italic;
        background: transparent;
        padding: 4px 0;
        max-width: 100%;
    }
    
    .message-sender {
        font-weight: bold;
        margin-bottom: 4px;
    }
    
    .message-time {
        font-size: 10px;
        color: var(--vscode-descriptionForeground);
        margin-top: 4px;
        text-align: right;
    }
    
    .welcome-message {
        color: var(--vscode-descriptionForeground);
        font-style: italic;
        text-align: center;
        margin: 20px 0;
    }
    `;
}

/**
 * Create JavaScript content for the chat view
 * Use this to write the JS file to disk during extension activation
 */
export function getChatScriptContent(): string {
    return `
    (function() {
        const vscode = acquireVsCodeApi();
        const messagesContainer = document.getElementById('messages');
        const messageInput = document.getElementById('message-input');
        const sendButton = document.getElementById('send-btn');
        const clearButton = document.getElementById('clear-btn');
        const statusIndicator = document.querySelector('.status-indicator');
        const statusText = document.getElementById('status-text');
        const participantsList = document.getElementById('participants-list');
        
        // Store messages in state
        let state = vscode.getState() || { messages: [] };
        
        // Format a timestamp
        function formatTimestamp(timestamp) {
            const date = new Date(timestamp);
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }
        
        // Create a message element
        function createMessageElement(message) {
            const messageDiv = document.createElement('div');
            
            if (message.from === 'system') {
                messageDiv.className = 'message message-system';
                messageDiv.textContent = message.message;
            } else {
                messageDiv.className = message.isSelf ? 'message message-self' : 'message message-other';
                
                const senderDiv = document.createElement('div');
                senderDiv.className = 'message-sender';
                senderDiv.textContent = message.fromName;
                messageDiv.appendChild(senderDiv);
                
                const contentDiv = document.createElement('div');
                contentDiv.className = 'message-content';
                contentDiv.textContent = message.message;
                messageDiv.appendChild(contentDiv);
                
                const timeDiv = document.createElement('div');
                timeDiv.className = 'message-time';
                timeDiv.textContent = formatTimestamp(message.timestamp);
                messageDiv.appendChild(timeDiv);
            }
            
            return messageDiv;
        }
        
        // Update the messages display
        function updateMessages(messages) {
            // Clear welcome message
            if (messages.length > 0) {
                const welcomeMsg = messagesContainer.querySelector('.welcome-message');
                if (welcomeMsg) {
                    messagesContainer.removeChild(welcomeMsg);
                }
            }
            
            // Add new messages
            messages.forEach(message => {
                // Check if message is already displayed
                const existingMessage = document.getElementById(\`message-\${message.id}\`);
                if (!existingMessage) {
                    const messageEl = createMessageElement(message);
                    messageEl.id = \`message-\${message.id}\`;
                    messagesContainer.appendChild(messageEl);
                }
            });
            
            // Save in state
            state.messages = messages;
            vscode.setState(state);
            
            // Scroll to bottom
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
        
        // Update the connection status
        function updateConnectionStatus(connected, serverName = '') {
            statusIndicator.classList.remove('connected', 'disconnected');
            statusIndicator.classList.add(connected ? 'connected' : 'disconnected');
            
            if (connected) {
                statusText.textContent = serverName ? \`Connected to \${serverName}\` : 'Connected';
                messageInput.disabled = false;
                sendButton.disabled = false;
            } else {
                statusText.textContent = 'Disconnected';
                messageInput.disabled = true;
                sendButton.disabled = true;
            }
        }
        
        // Update participants list
        function updateParticipants(participants) {
            participantsList.innerHTML = '';
            
            if (participants.length === 0) {
                const emptyItem = document.createElement('li');
                emptyItem.className = 'empty-list';
                emptyItem.textContent = 'No participants';
                participantsList.appendChild(emptyItem);
                return;
            }
            
            participants.forEach(participant => {
                const item = document.createElement('li');
                item.className = 'participant';
                
                const indicator = document.createElement('span');
                indicator.className = 'participant-indicator';
                item.appendChild(indicator);
                
                const name = document.createElement('span');
                name.textContent = participant.name;
                item.appendChild(name);
                
                participantsList.appendChild(item);
            });
        }
        
        // Handle keydown in message input
        messageInput.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                sendButton.click();
            }
        });
        
        // Handle send button click
        sendButton.addEventListener('click', () => {
            const text = messageInput.value.trim();
            if (text) {
                vscode.postMessage({
                    command: 'sendMessage',
                    text: text
                });
                messageInput.value = '';
            }
        });
        
        // Handle clear button click
        clearButton.addEventListener('click', () => {
            vscode.postMessage({ command: 'clearMessages' });
        });
        
        // Request initial connection status
        vscode.postMessage({ command: 'requestConnectionStatus' });
        
        // Handle messages from the extension
        window.addEventListener('message', (event) => {
            const message = event.data;
            
            switch (message.command) {
                case 'updateMessages':
                    updateMessages(message.messages);
                    break;
                
                case 'updateConnectionStatus':
                    updateConnectionStatus(message.connected, message.serverName);
                    break;
                
                case 'updateParticipants':
                    updateParticipants(message.participants);
                    break;
            }
        });
    })();
    `;
}
