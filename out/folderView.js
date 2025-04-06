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
exports.FileItem = exports.FolderViewProvider = void 0;
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
class FolderViewProvider {
    workspaceRoot;
    _onDidChangeTreeData = new vscode.EventEmitter();
    onDidChangeTreeData = this._onDidChangeTreeData.event;
    fileSystemWatcher;
    constructor(workspaceRoot) {
        this.workspaceRoot = workspaceRoot;
        // 创建文件系统监听器
        this.fileSystemWatcher = vscode.workspace.createFileSystemWatcher('**/*');
        // 监听文件变化
        this.fileSystemWatcher.onDidCreate(() => this.refresh());
        this.fileSystemWatcher.onDidDelete(() => this.refresh());
        this.fileSystemWatcher.onDidChange(() => this.refresh());
    }
    dispose() {
        // 清理文件系统监听器
        this.fileSystemWatcher.dispose();
    }
    refresh() {
        this._onDidChangeTreeData.fire(undefined);
    }
    getTreeItem(element) {
        return element;
    }
    getChildren(element) {
        if (!this.workspaceRoot) {
            vscode.window.showInformationMessage("No workspace folder found");
            return Promise.resolve([]);
        }
        const dirPath = element ? element.resourceUri.fsPath : this.workspaceRoot;
        return Promise.resolve(this.getFiles(dirPath));
    }
    getFiles(dir) {
        if (!fs.existsSync(dir))
            return [];
        const items = fs.readdirSync(dir)
            .filter(file => !file.startsWith('.')) // 过滤掉隐藏文件
            .map((file) => {
            const filePath = path.join(dir, file);
            const isDirectory = fs.statSync(filePath).isDirectory();
            return {
                name: file,
                path: filePath,
                isDirectory: isDirectory
            };
        });
        // 先按文件夹在前，文件在后排序
        // 然后在各自组内按名称排序
        return items
            .sort((a, b) => {
            // 首先按文件夹在前排序
            if (a.isDirectory !== b.isDirectory) {
                return a.isDirectory ? -1 : 1;
            }
            // 然后在各自组内按名称排序
            return a.name.localeCompare(b.name);
        })
            .map(item => new FileItem(vscode.Uri.file(item.path), item.isDirectory
            ? vscode.TreeItemCollapsibleState.Collapsed
            : vscode.TreeItemCollapsibleState.None));
    }
}
exports.FolderViewProvider = FolderViewProvider;
class FileItem extends vscode.TreeItem {
    resourceUri;
    collapsibleState;
    constructor(resourceUri, collapsibleState) {
        super(resourceUri, collapsibleState);
        this.resourceUri = resourceUri;
        this.collapsibleState = collapsibleState;
        this.tooltip = this.resourceUri.fsPath;
        this.description = undefined; // 设置为 undefined 来移除 description 的显示
        this.contextValue = collapsibleState === vscode.TreeItemCollapsibleState.Collapsed ? "folder" : "file";
        // 如果不是文件夹，添加点击打开文件的功能
        if (collapsibleState === vscode.TreeItemCollapsibleState.None) {
            this.command = {
                command: 'vscode.open',
                title: '打开文件',
                arguments: [this.resourceUri]
            };
        }
    }
}
exports.FileItem = FileItem;
//# sourceMappingURL=folderView.js.map