import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export class BBMaterialViewProvider implements vscode.TreeDataProvider<BBMaterialItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<BBMaterialItem | undefined | null | void> = new vscode.EventEmitter<BBMaterialItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<BBMaterialItem | undefined | null | void> = this._onDidChangeTreeData.event;

    private fileWatcher: vscode.FileSystemWatcher;

    constructor(private bbVaultPath: string) {
        // Initialize file watcher
        this.fileWatcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(bbVaultPath, '**/*'));
        this.fileWatcher.onDidChange(() => this.refresh());
        this.fileWatcher.onDidCreate(() => this.refresh());
        this.fileWatcher.onDidDelete(() => this.refresh());
    }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: BBMaterialItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: BBMaterialItem): Promise<BBMaterialItem[]> {
        if (!element) {
            // 根节点，显示bb-vault文件夹内容
            const items = await fs.promises.readdir(this.bbVaultPath);
            return this.createTreeItems(items, this.bbVaultPath, 0);
        }

        const fullPath = element.resourceUri.fsPath;
        if (fs.statSync(fullPath).isDirectory()) {
            const items = await fs.promises.readdir(fullPath);
            return this.createTreeItems(items, fullPath, element.level + 1);
        }

        return [];
    }

    private async createTreeItems(items: string[], parentPath: string, level: number): Promise<BBMaterialItem[]> {
        const treeItems: BBMaterialItem[] = [];

        for (const item of items) {
            // 跳过隐藏文件和文件夹
            if (item.startsWith('.')) {
                continue;
            }

            const fullPath = path.join(parentPath, item);
            const stat = fs.statSync(fullPath);
            const isDirectory = stat.isDirectory();

            treeItems.push(
                new BBMaterialItem(
                    item,
                    isDirectory ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None,
                    vscode.Uri.file(fullPath),
                    isDirectory ? 'folder' : this.getFileIconName(item),
                    level
                )
            );
        }

        return treeItems;
    }

    private getFileIconName(filename: string): string {
        const ext = path.extname(filename).toLowerCase();
        switch (ext) {
            case '.md':
                return 'markdown';
            case '.pdf':
                return 'pdf';
            case '.doc':
            case '.docx':
                return 'word';
            case '.ppt':
            case '.pptx':
                return 'powerpoint';
            default:
                return 'document';
        }
    }

    dispose(): void {
        this.fileWatcher.dispose();
    }
}

export class BBMaterialItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly resourceUri: vscode.Uri,
        iconName: string,
        public readonly level: number = 0
    ) {
        super(label, collapsibleState);
        this.tooltip = `${this.label}`;
        this.description = undefined;
        
        // 设置图标
        this.iconPath = new vscode.ThemeIcon(iconName);

        // 根据层级设置不同的 contextValue
        if (collapsibleState === vscode.TreeItemCollapsibleState.Collapsed) {
            switch (level) {
                case 0:
                    this.contextValue = 'semesterFolder';  // 根级显示更新学期按钮
                    break;
                case 1:
                    this.contextValue = 'courseFolder';    // 第一级显示更新课程按钮
                    break;
                default:
                    this.contextValue = 'folder';          // 其他层级不显示按钮
            }
        } else {
            this.contextValue = 'file';
        }

        if (collapsibleState === vscode.TreeItemCollapsibleState.None) {
            // 所有文件都使用只读方式打开
            this.command = {
                command: 'bbMaterialView.openReadOnly',
                title: '打开文件',
                arguments: [this.resourceUri]
            };
        }
    }
}