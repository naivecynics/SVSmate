import * as vscode from 'vscode';
import * as net from 'net';

export interface ServerFile {
    id: string;
    name: string;
    content: string;
}

export class CollaborationClient {
    private socket: net.Socket | null = null;
    private isConnected = false;
    private serverIP = '';
    private serverPort = 0;
    private serverFiles: Map<string, ServerFile> = new Map();
    private onFilesUpdatedCallback?: () => void;

    constructor() { }

    /**
     * Connect to a collaboration server
     */
    async connect(ip: string, port: number): Promise<void> {
        if (this.isConnected) {
            await this.disconnect();
        }

        return new Promise((resolve, reject) => {
            this.socket = new net.Socket();
            this.serverIP = ip;
            this.serverPort = port;

            this.socket.connect(port, ip, () => {
                this.isConnected = true;
                vscode.window.showInformationMessage(`Connected to server ${ip}:${port}`);
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
                if (event.document === document) {
                    this.sendFileUpdate(fileId, event.document.getText());
                }
            });

            // Clean up listener when document is closed
            const closeListener = vscode.workspace.onDidCloseTextDocument((closedDoc) => {
                if (closedDoc === document) {
                    changeListener.dispose();
                    closeListener.dispose();
                }
            });

        } catch (error) {
            vscode.window.showErrorMessage(`Failed to open file: ${error}`);
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
                        content: file.content
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
                    content: newFile.content
                });
                if (this.onFilesUpdatedCallback) {
                    this.onFilesUpdatedCallback();
                }
                vscode.window.showInformationMessage(`New file shared: ${newFile.name}`);
                break;

            case 'fileUpdated':
                // Handle file content update
                const updateData = message.data;
                const existingFile = this.serverFiles.get(updateData.id);
                if (existingFile) {
                    existingFile.content = updateData.content;
                    // TODO: Update open documents with new content
                }
                break;

            case 'pong':
                // Handle ping response
                break;
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
                    content: content
                }
            };
            this.socket.write(JSON.stringify(message));
        } catch (error) {
            console.error('Failed to send file update:', error);
        }
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
