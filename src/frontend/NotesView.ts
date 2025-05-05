import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { getDir } from '../utils/pathManager';

export class NotesViewProvider implements vscode.TreeDataProvider<NoteItem>, vscode.Disposable {
  private _onDidChangeTreeData = new vscode.EventEmitter<NoteItem | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private constructor(private notesPath: string) {}

  static create(): NotesViewProvider {
    const notesPath = getDir('notes');
    return new NotesViewProvider(notesPath);
  }

  dispose() {
    this._onDidChangeTreeData.dispose();
  }

  refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }

  getTreeItem(element: NoteItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: NoteItem): Promise<NoteItem[]> {
    if (!element) {
      return [
        new NoteItem('Crawled Course Notes', vscode.TreeItemCollapsibleState.Collapsed, vscode.Uri.file(path.join(this.notesPath, 'crawled_courses_notes'))),
        new NoteItem('Personal Notes', vscode.TreeItemCollapsibleState.Collapsed, vscode.Uri.file(path.join(this.notesPath, 'personal_notes')))
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

  async createNote(folderPath: string) {
    const name = await vscode.window.showInputBox({ prompt: '输入笔记名称', placeHolder: '例如：学习笔记' });

    if (!name) {return;}

    const fileName = name.endsWith('.md') ? name : name + '.md';
    const fullPath = path.join(folderPath, fileName);

    if (fs.existsSync(fullPath)) {
      vscode.window.showErrorMessage('笔记已存在！');
      return;
    }

    await fs.promises.writeFile(fullPath, `# ${name.replace('.md', '')}\n\n`);
    this.refresh();
  }

  async deleteNote(filePath: string) {
    try {
      await fs.promises.unlink(filePath);
      this._onDidChangeTreeData.fire(undefined);
    } catch (err) {
      vscode.window.showErrorMessage(`删除失败: ${err}`);
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
    this.tooltip = resourceUri.fsPath;
    this.description = label;

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
