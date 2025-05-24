import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { getDir } from '../utils/pathManager';

/**
 * Provides a tree view for managing Markdown notes within the extension.
 * Notes are grouped under predefined folders: crawled course notes and personal notes.
 */
export class NotesViewProvider implements vscode.TreeDataProvider<NoteItem>, vscode.Disposable {
    /** Event emitter for notifying VS Code about data changes */
    private _onDidChangeTreeData = new vscode.EventEmitter<NoteItem | undefined>();
    /** Event that fires when the tree data changes */
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    /**
     * Creates a new NotesViewProvider instance.
     * 
     * @param notesPath - The root path where notes are stored.
     */
    private constructor(private notesPath: string) {}

    /**
     * Factory method to create an instance of the NotesViewProvider.
     * 
     * @returns A new instance of NotesViewProvider.
     */
    static create(): NotesViewProvider {
        const notesPath = getDir('notes');
        return new NotesViewProvider(notesPath);
    }

    /**
     * Clean up event listeners.
     */
    dispose(): void {
        this._onDidChangeTreeData.dispose();
    }

    /**
     * Refresh the entire notes tree.
     */
    refresh(): void {
        this._onDidChangeTreeData.fire(undefined);
    }

    /**
     * Gets the TreeItem representation of a note or folder.
     * 
     * @param element - The NoteItem to convert to a TreeItem.
     * @returns A TreeItem configured for display.
     */
    getTreeItem(element: NoteItem): vscode.TreeItem {
        return element;
    }

    /**
     * Fetch child items under a given node, or top-level groups if none is provided.
     * 
     * @param element - Optional parent item.
     * @returns A list of NoteItem children.
     */
    async getChildren(element?: NoteItem): Promise<NoteItem[]> {
        if (!element) {
            return [
                new NoteItem(
                    'Crawled Course Notes',
                    vscode.TreeItemCollapsibleState.Collapsed,
                    vscode.Uri.file(path.join(this.notesPath, 'crawled_courses_notes'))
                ),
                new NoteItem(
                    'Personal Notes',
                    vscode.TreeItemCollapsibleState.Collapsed,
                    vscode.Uri.file(path.join(this.notesPath, 'personal_notes'))
                )
            ];
        }

        const folderPath = element.resourceUri.fsPath;
        if (!fs.existsSync(folderPath)) {return [];}

        const entries = await fs.promises.readdir(folderPath);

        return entries.map(entry => {
            const fullPath = path.join(folderPath, entry);
            const isDir = fs.statSync(fullPath).isDirectory();

            return new NoteItem(
                entry,
                isDir ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None,
                vscode.Uri.file(fullPath)
            );
        });
    }

    /**
     * Creates a new Markdown note in the given folder.
     * 
     * @param folderPath - The path to the folder where the note should be created.
     */
    async createNote(folderPath: string): Promise<void> {
        const name = await vscode.window.showInputBox({
            prompt: 'Enter note name',
            placeHolder: 'e.g., Study Notes'
        });

        if (!name) {return;}

        const fileName = name.endsWith('.md') ? name : name + '.md';
        const fullPath = path.join(folderPath, fileName);

        if (fs.existsSync(fullPath)) {
            vscode.window.showErrorMessage('Note already exists!');
            return;
        }

        await fs.promises.writeFile(fullPath, `# ${name.replace('.md', '')}\n\n`);
        this.refresh();
    }

    /**
     * Deletes a note file.
     * 
     * @param filePath - Full file path of the note to delete.
     */
    async deleteNote(filePath: string): Promise<void> {
        try {
            await fs.promises.unlink(filePath);
            this._onDidChangeTreeData.fire(undefined);
        } catch (err) {
            vscode.window.showErrorMessage(`Failed to delete note: ${err}`);
        }
    }
}

/**
 * Represents a file or folder item in the notes tree view.
 */
class NoteItem extends vscode.TreeItem {
    /**
     * Creates a NoteItem tree node.
     * 
     * @param label - The display name of the note or folder.
     * @param collapsibleState - Determines if the node is expandable.
     * @param resourceUri - The URI of the file or folder.
     */
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly resourceUri: vscode.Uri
    ) {
        super(label, collapsibleState);
        this.tooltip = resourceUri.fsPath;
        this.description = label;

        if (collapsibleState === vscode.TreeItemCollapsibleState.None) {
            // For files: open in editor
            this.command = {
                command: 'vscode.open',
                title: 'Open Note',
                arguments: [this.resourceUri]
            };
        } else {
            // For folders: allow context menu for note creation
            this.contextValue = 'folder';
            this.command = {
                command: 'notesView.createNote',
                title: 'Create Note',
                arguments: [this.resourceUri.fsPath]
            };
        }
    }
}
