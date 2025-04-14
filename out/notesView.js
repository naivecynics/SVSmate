"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotesViewProvider = void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
class NotesViewProvider {
    notesPath;
    _onDidChangeTreeData = new vscode.EventEmitter();
    onDidChangeTreeData = this._onDidChangeTreeData.event;
    constructor(notesPath) {
        this.notesPath = notesPath;
    }
    refresh() {
        this._onDidChangeTreeData.fire();
    }
    getTreeItem(element) {
        return element;
    }
    async getChildren(element) {
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
            return new NoteItem(item, isDirectory ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None, vscode.Uri.file(fullPath));
        });
    }
    async createNote(folderPath) {
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
            }
            else {
                vscode.window.showErrorMessage('笔记已存在！');
            }
        }
    }
    async deleteNote(filePath) {
        try {
            await fs.promises.unlink(filePath);
            this._onDidChangeTreeData.fire(undefined);
        }
        catch (error) {
            throw new Error(`删除文件失败: ${error}`);
        }
    }
}
exports.NotesViewProvider = NotesViewProvider;
class NoteItem extends vscode.TreeItem {
    label;
    collapsibleState;
    resourceUri;
    constructor(label, collapsibleState, resourceUri) {
        super(label, collapsibleState);
        this.label = label;
        this.collapsibleState = collapsibleState;
        this.resourceUri = resourceUri;
        this.tooltip = `${this.label}`;
        this.description = this.label;
        if (collapsibleState === vscode.TreeItemCollapsibleState.None) {
            this.command = {
                command: 'vscode.open',
                title: '打开笔记',
                arguments: [this.resourceUri]
            };
        }
        else {
            this.contextValue = 'folder';
            this.command = {
                command: 'notesView.createNote',
                title: '创建笔记',
                arguments: [this.resourceUri.fsPath]
            };
        }
    }
}
//# sourceMappingURL=notesView.js.map