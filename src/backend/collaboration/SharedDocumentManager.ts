import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { EventEmitter } from 'events';
import { outputChannel } from '../../utils/OutputChannel';

interface DocumentMetadata {
    id: string;
    name: string;
    path: string;
    owner: string;
    sharedAt: number;
    version: number;
    lastModified: number;
    lastModifiedBy: string;
    isOwner: boolean; // 是否为当前用户拥有的文档
}

export class SharedDocumentManager extends EventEmitter {
    private documents: Map<string, any> = new Map();
    private metadata: Map<string, DocumentMetadata> = new Map();
    private activeEditors: Map<string, vscode.TextEditor> = new Map();
    private pendingUpdates: Map<string, Uint8Array[]> = new Map();
    private Y: any;
    private initialized: boolean = false;

    constructor() {
        super();
        this.initialize();
    }

    private async initialize() {
        try {
            this.Y = await import('yjs');
            this.initialized = true;
            this.emit('initialized');
        } catch (error) {
            outputChannel.error('YjsDocumentManager', `Error importing Yjs: ${error}`);
        }
    }

    /**
     * Ensures that Yjs is initialized before performing operations
     */
    private async ensureInitialized(): Promise<boolean> {
        if (this.initialized) {
            return true;
        }

        return new Promise<boolean>((resolve) => {
            if (this.initialized) {
                resolve(true);
                return;
            }

            this.once('initialized', () => {
                resolve(true);
            });
        });
    }

    /**
     * Create a new shared document
     */
    async createDocument(fileId: string, filePath: string, owner: string, isOwner: boolean = true): Promise<any | null> {
        await this.ensureInitialized();
        try {
            // Check if document already exists
            if (this.documents.has(fileId)) {
                return this.documents.get(fileId) || null;
            }

            // Create a new Yjs document
            const doc = new this.Y.Doc();

            // Read file content if it exists and is owned by current user
            let content = '';
            if (isOwner && fs.existsSync(filePath)) {
                content = fs.readFileSync(filePath, 'utf-8');
            }

            // Initialize document with content
            const yText = doc.getText('content');
            if (content) {
                yText.insert(0, content);
            }

            // Store the document
            this.documents.set(fileId, doc);

            const fileName = path.basename(filePath);

            // Store metadata
            this.metadata.set(fileId, {
                id: fileId,
                name: fileName,
                path: filePath,
                owner: owner,
                sharedAt: Date.now(),
                version: 0,
                lastModified: Date.now(),
                lastModifiedBy: owner,
                isOwner: isOwner
            });

            // Set up document change observation
            this.observeDocument(fileId, doc);

            outputChannel.info('Document Created',
                `Document ${fileName} (${fileId}) created by ${owner}, isOwner: ${isOwner}`);

            return doc;
        } catch (error) {
            outputChannel.error('Document Creation Error',
                error instanceof Error ? error.message : String(error));
            return null;
        }
    }

    /**
     * Create a document from received content (for remote documents)
     */
    async createDocumentFromContent(fileId: string, fileName: string, content: string, owner: string): Promise<any | null> {
        await this.ensureInitialized();
        try {
            // Check if document already exists
            if (this.documents.has(fileId)) {
                const doc = this.documents.get(fileId);
                // Update existing document with new content
                const yText = doc.getText('content');
                const currentContent = yText.toString();
                if (currentContent !== content) {
                    yText.delete(0, currentContent.length);
                    yText.insert(0, content);
                }
                return doc;
            }

            // Create a new Yjs document
            const doc = new this.Y.Doc();

            // Initialize document with received content
            const yText = doc.getText('content');
            if (content) {
                yText.insert(0, content);
            }

            // Store the document
            this.documents.set(fileId, doc);

            // Store metadata (not owned by current user)
            this.metadata.set(fileId, {
                id: fileId,
                name: fileName,
                path: '', // No local path for remote documents
                owner: owner,
                sharedAt: Date.now(),
                version: 0,
                lastModified: Date.now(),
                lastModifiedBy: owner,
                isOwner: false
            });

            // Set up document change observation
            this.observeDocument(fileId, doc);

            outputChannel.info('Remote Document Created',
                `Remote document ${fileName} (${fileId}) from ${owner} with ${content.length} chars`);

            return doc;
        } catch (error) {
            outputChannel.error('Remote Document Creation Error',
                error instanceof Error ? error.message : String(error));
            return null;
        }
    }

    /**
     * Get an existing document by ID
     */
    getDocument(fileId: string): any | null {
        return this.documents.get(fileId) || null;
    }

    /**
     * Get document metadata
     */
    getDocumentMetadata(fileId: string): DocumentMetadata | null {
        return this.metadata.get(fileId) || null;
    }

    /**
     * Get all document metadata
     */
    getAllDocumentMetadata(): DocumentMetadata[] {
        return Array.from(this.metadata.values());
    }

    /**
     * Remove a document
     */
    removeDocument(fileId: string): boolean {
        const doc = this.documents.get(fileId);
        if (!doc) {
            return false;
        }

        // Clean up observers
        doc.destroy();

        // Remove from maps
        this.documents.delete(fileId);
        this.metadata.delete(fileId);
        this.pendingUpdates.delete(fileId);

        const editor = this.activeEditors.get(fileId);
        if (editor) {
            this.activeEditors.delete(fileId);
        }

        outputChannel.info('Document Removed', `Document ${fileId} removed`);
        return true;
    }

    /**
     * Apply an update to a document
     */
    async applyUpdate(fileId: string, update: Uint8Array, source: string): Promise<boolean> {
        await this.ensureInitialized();
        const doc = this.documents.get(fileId);
        if (!doc) {
            // Store updates for documents not yet loaded
            if (!this.pendingUpdates.has(fileId)) {
                this.pendingUpdates.set(fileId, []);
            }
            this.pendingUpdates.get(fileId)?.push(update);
            return false;
        }

        try {
            // Apply the update to the document
            this.Y.applyUpdate(doc, update);

            // Update metadata
            const metadata = this.metadata.get(fileId);
            if (metadata) {
                metadata.version++;
                metadata.lastModified = Date.now();
                metadata.lastModifiedBy = source;
            }

            return true;
        } catch (error) {
            outputChannel.error('Update Application Error',
                error instanceof Error ? error.message : String(error));
            return false;
        }
    }

    /**
     * Get the current state of a document as a Uint8Array
     */
    async getDocumentState(fileId: string): Promise<Uint8Array | null> {
        await this.ensureInitialized();
        const doc = this.documents.get(fileId);
        if (!doc) {
            return null;
        }

        return this.Y.encodeStateAsUpdate(doc);
    }

    /**
     * Get the text content of a document
     */
    getDocumentContent(fileId: string): string {
        const doc = this.documents.get(fileId);
        if (!doc) {
            return '';
        }

        const yText = doc.getText('content');
        return yText.toString();
    }

    /**
     * Register a VS Code editor with a document
     */
    registerEditor(fileId: string, editor: vscode.TextEditor): boolean {
        const doc = this.documents.get(fileId);
        if (!doc) {
            return false;
        }

        this.activeEditors.set(fileId, editor);
        return true;
    }

    /**
     * Unregister a VS Code editor
     */
    unregisterEditor(fileId: string): void {
        this.activeEditors.delete(fileId);
    }

    /**
     * Save a document's content to disk (only for owned documents)
     */
    saveDocument(fileId: string): boolean {
        try {
            const doc = this.documents.get(fileId);
            const metadata = this.metadata.get(fileId);

            if (!doc || !metadata || !metadata.isOwner) {
                return false;
            }

            const content = doc.getText('content').toString();

            // Only save if file path exists and is writable
            if (metadata.path && fs.existsSync(metadata.path)) {
                fs.writeFileSync(metadata.path, content, 'utf-8');
                outputChannel.info('Document Saved',
                    `Document ${metadata.name} (${fileId}) saved to disk`);
                return true;
            }

            return false;
        } catch (error) {
            outputChannel.error('Document Save Error',
                error instanceof Error ? error.message : String(error));
            return false;
        }
    }

    /**
     * Check if document is owned by current user
     */
    isDocumentOwned(fileId: string): boolean {
        const metadata = this.metadata.get(fileId);
        return metadata ? metadata.isOwner : false;
    }

    /**
     * Get document display path for UI
     */
    getDocumentDisplayPath(fileId: string): string {
        const metadata = this.metadata.get(fileId);
        if (!metadata) {
            return '';
        }

        if (metadata.isOwner && metadata.path) {
            return metadata.path;
        } else {
            return `[Remote] ${metadata.name} (by ${metadata.owner})`;
        }
    }

    /**
     * Get all pending updates for a document
     */
    getPendingUpdates(fileId: string): Uint8Array[] {
        return this.pendingUpdates.get(fileId) || [];
    }

    /**
     * Clear pending updates for a document
     */
    clearPendingUpdates(fileId: string): void {
        this.pendingUpdates.delete(fileId);
    }

    /**
     * Observe document changes and emit events
     */
    private async observeDocument(fileId: string, doc: any): Promise<void> {
        await this.ensureInitialized();
        // Listen for document updates
        doc.on('update', (update: Uint8Array, origin: any) => {
            // Ignore updates from self or remote
            if (origin === 'remote') {
                return;
            }

            // Emit update event for the server to broadcast
            this.emit('documentUpdate', {
                fileId,
                update,
                origin: 'local'
            });

            // Update metadata
            const metadata = this.metadata.get(fileId);
            if (metadata) {
                metadata.version++;
                metadata.lastModified = Date.now();
            }
        });
    }

    /**
     * Apply an editor change to a Yjs document
     */
    applyEditorChange(fileId: string, change: vscode.TextDocumentContentChangeEvent): boolean {
        const doc = this.documents.get(fileId);
        if (!doc) {
            return false;
        }

        try {
            const yText = doc.getText('content');

            // Calculate start and end positions
            const startPos = change.rangeOffset;
            const endPos = change.rangeOffset + change.rangeLength;

            // Delete text if needed
            if (change.rangeLength > 0) {
                yText.delete(startPos, change.rangeLength);
            }

            // Insert new text
            if (change.text.length > 0) {
                yText.insert(startPos, change.text);
            }

            return true;
        } catch (error) {
            outputChannel.error('Editor Change Application Error',
                error instanceof Error ? error.message : String(error));
            return false;
        }
    }

    /**
     * Update VS Code editor with Yjs document changes
     */
    updateEditor(fileId: string): boolean {
        const editor = this.activeEditors.get(fileId);
        const doc = this.documents.get(fileId);

        if (!editor || !doc) {
            return false;
        }

        try {
            const content = doc.getText('content').toString();
            const document = editor.document;

            // Apply the edit
            const edit = new vscode.WorkspaceEdit();
            edit.replace(
                document.uri,
                new vscode.Range(0, 0, document.lineCount, 0),
                content
            );

            // Apply the edit
            vscode.workspace.applyEdit(edit);
            return true;
        } catch (error) {
            outputChannel.error('Editor Update Error',
                error instanceof Error ? error.message : String(error));
            return false;
        }
    }
}

// Export a singleton instance
export const sharedDocumentManager = new SharedDocumentManager();