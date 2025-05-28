import * as vscode from 'vscode';
import * as net from 'net';

export interface ServerFile {
    id: string;
    name: string;
    content: string;
    lastTimestamp?: number;
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
