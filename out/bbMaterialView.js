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
exports.BBMaterialItem = exports.BBMaterialViewProvider = void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
class BBMaterialViewProvider {
    bbVaultPath;
    _onDidChangeTreeData = new vscode.EventEmitter();
    onDidChangeTreeData = this._onDidChangeTreeData.event;
    constructor(bbVaultPath) {
        this.bbVaultPath = bbVaultPath;
    }
    refresh() {
        this._onDidChangeTreeData.fire();
    }
    getTreeItem(element) {
        return element;
    }
    async getChildren(element) {
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
    async createTreeItems(items, parentPath, level) {
        const treeItems = [];
        for (const item of items) {
            // 跳过隐藏文件和文件夹
            if (item.startsWith('.')) {
                continue;
            }
            const fullPath = path.join(parentPath, item);
            const stat = fs.statSync(fullPath);
            const isDirectory = stat.isDirectory();
            treeItems.push(new BBMaterialItem(item, isDirectory ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None, vscode.Uri.file(fullPath), isDirectory ? 'folder' : this.getFileIconName(item), level));
        }
        return treeItems;
    }
    getFileIconName(filename) {
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
}
exports.BBMaterialViewProvider = BBMaterialViewProvider;
class BBMaterialItem extends vscode.TreeItem {
    label;
    collapsibleState;
    resourceUri;
    level;
    constructor(label, collapsibleState, resourceUri, iconName, level = 0) {
        super(label, collapsibleState);
        this.label = label;
        this.collapsibleState = collapsibleState;
        this.resourceUri = resourceUri;
        this.level = level;
        this.tooltip = `${this.label}`;
        this.description = undefined;
        // 设置图标
        this.iconPath = new vscode.ThemeIcon(iconName);
        // 根据层级设置不同的 contextValue
        if (collapsibleState === vscode.TreeItemCollapsibleState.Collapsed) {
            switch (level) {
                case 0:
                    this.contextValue = 'semesterFolder'; // 根级显示更新学期按钮
                    break;
                case 1:
                    this.contextValue = 'courseFolder'; // 第一级显示更新课程按钮
                    break;
                default:
                    this.contextValue = 'folder'; // 其他层级不显示按钮
            }
        }
        else {
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
exports.BBMaterialItem = BBMaterialItem;
//# sourceMappingURL=bbMaterialView.js.map