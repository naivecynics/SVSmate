import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export class NotesViewProvider implements vscode.TreeDataProvider<NoteItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<NoteItem | undefined | null | void> = new vscode.EventEmitter<NoteItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<NoteItem | undefined | null | void> = this._onDidChangeTreeData.event;

    constructor(private notesPath: string) {}

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: NoteItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: NoteItem): Promise<NoteItem[]> {
        if (!element) {
            // Root node, display two subfolders
            return [
                new NoteItem('Crawled Course Notes', vscode.TreeItemCollapsibleState.Collapsed, vscode.Uri.file(path.join(this.notesPath, 'crawled_courses_notes'))),
                new NoteItem('Personal Notes', vscode.TreeItemCollapsibleState.Collapsed, vscode.Uri.file(path.join(this.notesPath, 'personal_notes')))
            ];
        }

        const folderPath = element.resourceUri.fsPath;
        const items = await fs.promises.readdir(folderPath);
        
        return items.map(item => {
            const fullPath = path.join(folderPath, item);
            const isDirectory = fs.statSync(fullPath).isDirectory();
            return new NoteItem(
                item,
                isDirectory ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None,
                vscode.Uri.file(fullPath)
            );
        });
    }

    async createNote(folderPath: string) {
        const noteName = await vscode.window.showInputBox({
            prompt: '输入笔记名称',
            placeHolder: '例如：学习笔记'
        });

        if (noteName) {
            // 确保文件名以.md结尾
            const fileName = noteName.endsWith('.md') ? noteName : noteName + '.md';
            const fullPath = path.join(folderPath, fileName);
            if (!fs.existsSync(fullPath)) {
                await fs.promises.writeFile(fullPath, '# ' + noteName.replace('.md', '') + '\n\n');
                this.refresh();
            } else {
                vscode.window.showErrorMessage('笔记已存在！');
            }
        }
    }

    async deleteNote(filePath: string): Promise<void> {
        try {
            await fs.promises.unlink(filePath);
            this._onDidChangeTreeData.fire(undefined);
        } catch (error) {
            throw new Error(`删除文件失败: ${error}`);
        }
    }
}

class NoteItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly resourceUri: vscode.Uri
    ) {
        super(label, collapsibleState);
        this.tooltip = `${this.label}`;
        this.description = this.label;

        if (collapsibleState === vscode.TreeItemCollapsibleState.None) {
            this.command = {
                command: 'vscode.open',
                title: '打开笔记',
                arguments: [this.resourceUri]
            };
        } else {
            this.contextValue = 'folder';
            this.command = {
                command: 'notesView.createNote',
                title: '创建笔记',
                arguments: [this.resourceUri.fsPath]
            };
        }
    }
}