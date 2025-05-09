import * as vscode from "vscode";
import * as fs from "fs";
import * as PathManager from "../utils/pathManager";

interface TodoItem {
  label: string;
  endTime: string;
  category: string;
  checked: boolean;
}

export class TodoListViewProvider implements vscode.TreeDataProvider<TodoItem>, vscode.Disposable {
  public _onDidChangeTreeData = new vscode.EventEmitter<TodoItem | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private items: TodoItem[] = [];
  private _searchTerm = "";
  private _filteredItems: TodoItem[] = [];

  private constructor() {} // 私有构造，只允许 create() 创建实例

  static async create(): Promise<TodoListViewProvider> {
    const provider = new TodoListViewProvider();
    await provider.loadFromDisk();
    return provider;
  }

  dispose() {
    this._onDidChangeTreeData.dispose();
  }

  // 📁 Tree View 显示
  getTreeItem(element: TodoItem): vscode.TreeItem {
    const item = new vscode.TreeItem(element.label, vscode.TreeItemCollapsibleState.None);
    // item.iconPath = new vscode.ThemeIcon(element.checked ? "check" : "circle-outline");
    item.iconPath = vscode.ThemeIcon.Folder;
    item.tooltip = new vscode.MarkdownString(`**任务:** ${element.label}\n**分类:** ${element.category}\n**截止:** ${element.endTime}`).value;
    item.description = `[${element.category}] ❗${element.endTime}`;
    item.resourceUri = vscode.Uri.parse(`date:${element.endTime}`);
    // item.checkboxState = element.checked
    //   ? vscode.TreeItemCheckboxState.Checked
    //   : vscode.TreeItemCheckboxState.Unchecked;
    item.command = {
      command: "todoListView.toggleTaskCheckbox",
      title: "Toggle Task",
      arguments: [element]
    };
    return item;
  }

  getChildren(): vscode.ProviderResult<TodoItem[]> {
    return this._searchTerm ? this._filteredItems : this.items;
  }

  // 🔍 搜索
  setSearchTerm(term: string) {
    this._searchTerm = term.trim().toLowerCase();
    this._filteredItems = this._searchTerm
      ? this.items.filter(i => i.label.toLowerCase().includes(this._searchTerm))
      : [];
    this._onDidChangeTreeData.fire(undefined);
  }

  clearSearch() {
    this._searchTerm = "";
    this._filteredItems = [];
    this._onDidChangeTreeData.fire(undefined);
  }

  // ✅ 添加任务
  addItem(label: string, endTime: string, category: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(endTime)) {
      vscode.window.showErrorMessage("日期格式错误，请使用 YYYY-MM-DD");
      return;
    }
    this.items.push({ label, endTime, category, checked: false });
    this.saveToDisk();
    this._onDidChangeTreeData.fire(undefined);
  }

  async editTask(task: TodoItem) {
    const newLabel = await vscode.window.showInputBox({ prompt: "修改任务名", value: task.label });
    const newCategory = await vscode.window.showInputBox({ prompt: "修改分类", value: task.category });

    if (newLabel !== undefined && newCategory !== undefined) {
      task.label = newLabel;
      task.category = newCategory;
      this.saveToDisk();
      this._onDidChangeTreeData.fire(undefined);
    }
  }

  deleteTask(task: TodoItem) {
    const index = this.items.indexOf(task);
    if (index !== -1) {
      this.items.splice(index, 1);
      this.saveToDisk();
      this._onDidChangeTreeData.fire(undefined);
    }
  }

  toggleTaskCheckbox(task: TodoItem) {
    task.checked = !task.checked;
    this.saveToDisk();
    this._onDidChangeTreeData.fire(undefined);
  }

  sortBy(key: "endTime" | "category") {
    this.items.sort((a, b) => a[key].localeCompare(b[key]));
    this._onDidChangeTreeData.fire(undefined);
  }

  // 💾 加载任务
  private async loadFromDisk() {
    const filePath = PathManager.getFile("todoList");
    if (!fs.existsSync(filePath)) {
      vscode.window.showWarningMessage("未找到任务文件，自动创建空文件");
      this.items = [];
      this.saveToDisk();
      return;
    }

    try {
      const raw = fs.readFileSync(filePath, "utf8");
      const rawData = JSON.parse(raw);
      this.items = rawData.map((item: any) => ({
        label: item.Name || "未命名任务",
        endTime: item.DDL || "无截止",
        category: item.Variety || "未分类",
        checked: item.Finish || false
      }));
    } catch (err) {
      vscode.window.showErrorMessage(`加载任务失败: ${err}`);
      this.items = [];
    }
  }

  // 💾 保存任务
  private saveToDisk() {
    const filePath = PathManager.getFile("todoList");
    const json = this.items.map(i => ({
      Name: i.label,
      DDL: i.endTime,
      Variety: i.category,
      Finish: i.checked
    }));
    fs.writeFileSync(filePath, JSON.stringify(json, null, 2), "utf8");
  }

}

// import * as vscode from "vscode";
// import * as fs from "fs";
// import * as path from "path";
//
//
// import * as PathManager from '../utils/PathManager';
//
// interface TodoItem {
//   label: string;
//   endTime: string;
//   category: string;
//   checked: boolean;
//   children?: TodoItem[]; // 新增子任务数组
//   expanded?: boolean;    // 是否展开子任务
// }
//
// export class TodoListViewProvider implements vscode.TreeDataProvider<TodoItem> {
//   constructor() {}
//   public _onDidChangeTreeData = new vscode.EventEmitter<TodoItem | undefined>();
//   readonly onDidChangeTreeData = this._onDidChangeTreeData.event;
//
//   private items: TodoItem[] = [];
//
//   getTreeItem(element: TodoItem): vscode.TreeItem {
//
//     const treeItem = new vscode.TreeItem(element.label, vscode.TreeItemCollapsibleState.None);
//
//     /**
//      * AI-generated-content
//      * tool: vscode-copilot
//      * version: 1.98.0
//      * usage: make search term highlight
//      */
//     // 实现搜索关键词高亮
//     if (this._searchTerm && element.label.toLowerCase().includes(this._searchTerm)) {
//       treeItem.label = this.highlightSearchTerm(element.label, this._searchTerm);
//       treeItem.description = `[${element.category}] 🔍 ❗${element.endTime}`;
//     } else {
//       treeItem.label = element.label;
//       treeItem.description = `[${element.category}] ❗${element.endTime}`;
//     }
//
//
//     treeItem.iconPath = new vscode.ThemeIcon(element.checked ? "check" : "circle-outline");
//     treeItem.label = element.label;
//     treeItem.description = `[${element.category}] ❗${element.endTime}`; 
//     treeItem.tooltip = new vscode.MarkdownString(`**任务:** ${element.label}  \n**分类:** ${element.category}  \n**截止日期:** ${element.endTime}`);
//     treeItem.resourceUri = vscode.Uri.parse(`date:${element.endTime}`);
//
//     // Set the checkbox state to Checked or Unchecked based on the task's `checked` field
//     treeItem.checkboxState = element.checked
//       ? vscode.TreeItemCheckboxState.Checked
//       : vscode.TreeItemCheckboxState.Unchecked;
//
//     // Command to toggle checkbox 左键点击事件
//     treeItem.command = {
//       command: "todoListView.toggleTaskCheckbox",
//       title: "Toggle Task Checkbox",
//       arguments: [element]
//     };
//
//
//     return treeItem;
//   }
//
//
//   private _searchTerm: string = ''; // 当前搜索关键词
//   private _filteredItems: TodoItem[] = []; // 过滤后的任务列表
//
//   //实现搜索功能
//   setSearchTerm(term: string) {
//     this._searchTerm = term.trim().toLowerCase();
//     this._filteredItems = this._searchTerm 
//       ? this.items.filter(item => 
//           item.label.toLowerCase().includes(this._searchTerm)
//         )
//       : this.items;
//     this._onDidChangeTreeData.fire(undefined); // 刷新视图
//   }
//
//   private highlightSearchTerm(text: string, term: string): string {
//     const regex = new RegExp(`(${term})`, 'gi');
//     return text.replace(regex, '**$1**'); // 用 Markdown 加粗语法高亮
//   }
//
//   getChildren(): TodoItem[] {
//     return this._searchTerm ? this._filteredItems : this.items;
//   }
//
//   // remove the search state
//   clearSearch() {
//     this._searchTerm = '';
//     this._filteredItems = [];
//     this._onDidChangeTreeData.fire(undefined);
//   }
//
//   addItem(label: string, endTime: string, category: string) {
//     if(!/^\d{4}-\d{2}-\d{2}$/.test(endTime)) {
//       vscode.window.showErrorMessage("日期格式错误 请按照YYYY-MM-DD格式输入");
//       return;
//     }
//     this.items.push({ label, endTime, category, checked: false });
//     this._onDidChangeTreeData.fire(undefined);
//     this.saveJsonFile();  // Save to the file when new item is added
//   }
//
//   async editTask(item: TodoItem) {
//     const newLabel = await vscode.window.showInputBox({ prompt: "修改任务名称", value: item.label });
//     const newCategory = await vscode.window.showInputBox({ prompt: "修改任务分类", value: item.category });
//
//     if (newLabel !== undefined && newCategory !== undefined) {
//       item.label = newLabel;
//       item.category = newCategory;
//       this._onDidChangeTreeData.fire(undefined);
//       this.saveJsonFile();  // Save after editing
//     }
//   }
//
//   async deleteTask(item: TodoItem) {
//     const index = this.items.indexOf(item);
//     if (index !== -1) {
//       this.items.splice(index, 1);
//       this._onDidChangeTreeData.fire(undefined);
//       this.saveJsonFile();
//     }
//   }
//
//   // Load data from a JSON file
//   async loadJsonFile() {
//     const dirPath = PathManager.getFile('todoList');
//     const filePath = path.join(dirPath, 'tasks.json');
//     if (!fs.existsSync(filePath)) {
//       vscode.window.showErrorMessage("未找到 tasks.json 文件，将创建一个空文件。");
//       this.saveJsonFile();
//       return;
//     }
//     try {
//       const raw = fs.readFileSync(filePath, "utf8");
//       const data = JSON.parse(raw);
//       this.items = data.map((task: any) => ({
//         label: task.Name || "未命名任务",
//         endTime: task.DDL || "无截止日期",
//         category: task.Variety || "无分类",
//         checked: task.Finish || false,
//       }));
//       this._onDidChangeTreeData.fire(undefined);
//       vscode.window.showInformationMessage("任务列表已从 JSON 文件加载");
//     } catch (error) {
//       vscode.window.showErrorMessage(`${filePath}`);
//     }
//   }
//
//   // Save data to a JSON file
//   saveJsonFile() {
//     const dirPath = PathManager.getFile('todoList');
//     const filePath = path.join(dirPath, 'tasks.json');
//     const data = this.items.map(item => ({
//       Name: item.label,
//       DDL: item.endTime,
//       Variety: item.category,
//       Finish: item.checked,
//     }));
//     fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
//   }
//
//   // Toggle task checkbox
//   toggleTaskCheckbox(item: TodoItem) {
//     item.checked = !item.checked; // Toggle the checkbox state
//     this._onDidChangeTreeData.fire(undefined);
//     this.saveJsonFile();  // Save the updated state to the JSON file
//   }
//
//   sortBy(key: "endTime" | "category") {
//     if (key === "endTime") {
//       this.items.sort((a, b) => a.endTime.localeCompare(b.endTime)); // 按时间排序
//     } else {
//       this.items.sort((a, b) => a.category.localeCompare(b.category)); // 按字母排序
//     }
//
//     this._onDidChangeTreeData.fire(undefined);
//   }
// }
