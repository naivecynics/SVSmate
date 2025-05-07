import * as vscode from 'vscode';
import { outputChannel } from '../../utils/OutputChannel';
import * as fs from 'fs';
import * as path from 'path';

export class YjsDocumentManager {
    private documents: Map<string, any> = new Map();
    private textTypes: Map<string, any> = new Map();
    private isApplyingChanges = new Set<string>();
    private Y: any; // Store dynamically imported Y module

    constructor() {
        // Initialize with dynamic import of Y
        this.initialize();
    }

    private async initialize() {
        try {
            this.Y = await import('yjs');
        } catch (error) {
            outputChannel.error('YjsDocumentManager', `Error importing Yjs: ${error}`);
        }
    }

    async ensureInitialized(): Promise<void> {
        if (!this.Y) {
            await this.initialize();
        }
    }

    async getDocument(filePath: string): Promise<any> {
        await this.ensureInitialized();

        if (!this.documents.has(filePath)) {
            const doc = new this.Y.Doc();
            this.documents.set(filePath, doc);
            this.textTypes.set(filePath, doc.getText('content'));

            // Try to initialize with file content if it exists
            try {
                if (fs.existsSync(filePath)) {
                    const content = fs.readFileSync(filePath, 'utf8');
                    this.textTypes.get(filePath)?.insert(0, content);
                }
            } catch (error) {
                outputChannel.error('YjsDocumentManager', `Error initializing document: ${error}`);
            }
        }
        return this.documents.get(filePath)!;
    }

    async getText(filePath: string): Promise<any> {
        if (!this.textTypes.has(filePath)) {
            await this.getDocument(filePath);
        }
        return this.textTypes.get(filePath)!;
    }

    async applyVSCodeChange(filePath: string, change: vscode.TextDocumentContentChangeEvent): Promise<void> {
        await this.ensureInitialized();

        // Prevent recursion when we're applying changes from Yjs to VSCode
        if (this.isApplyingChanges.has(filePath)) {
            return;
        }

        const yText = await this.getText(filePath);
        const start = change.rangeOffset;
        const delCount = change.rangeLength;
        const text = change.text;

        try {
            yText.delete(start, delCount);
            if (text.length > 0) {
                yText.insert(start, text);
            }
        } catch (error) {
            outputChannel.error('YjsDocumentManager', `Error applying VSCode change: ${error}`);
        }
    }

    async applyYjsChanges(filePath: string, editor: vscode.TextEditor | undefined): Promise<void> {
        await this.ensureInitialized();

        if (!editor) {
            try {
                const document = await vscode.workspace.openTextDocument(filePath);
                editor = await vscode.window.showTextDocument(document);
            } catch (error) {
                outputChannel.error('YjsDocumentManager', `Error opening document: ${error}`);
                return;
            }
        }

        const yText = await this.getText(filePath);
        const content = yText.toString();
        const document = editor.document;

        // Mark that we're applying changes to prevent endless recursion
        this.isApplyingChanges.add(filePath);

        try {
            const edit = new vscode.WorkspaceEdit();
            const fullRange = new vscode.Range(
                document.positionAt(0),
                document.positionAt(document.getText().length)
            );

            edit.replace(document.uri, fullRange, content);
            await vscode.workspace.applyEdit(edit);
        } catch (error) {
            outputChannel.error('YjsDocumentManager', `Error applying Yjs changes: ${error}`);
        } finally {
            this.isApplyingChanges.delete(filePath);
        }
    }

    async applyUpdate(filePath: string, update: Uint8Array): Promise<void> {
        await this.ensureInitialized();
        const ydoc = await this.getDocument(filePath);
        this.Y.applyUpdate(ydoc, update);
    }

    async getUpdate(filePath: string): Promise<Uint8Array> {
        await this.ensureInitialized();
        const ydoc = await this.getDocument(filePath);
        return this.Y.encodeStateAsUpdate(ydoc);
    }
}
