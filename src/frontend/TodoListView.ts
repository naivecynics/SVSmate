import * as vscode from "vscode";
import * as fs from "fs";
import * as ical from "node-ical";
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
    item.iconPath = new vscode.ThemeIcon(element.checked ? "check" : "circle-outline");
    item.tooltip = new vscode.MarkdownString(`**任务:** ${element.label}\n**分类:** ${element.category}\n**截止:** ${element.endTime}`);
    item.description = `[${element.category}] ❗${element.endTime}`;
    item.resourceUri = vscode.Uri.parse(`date:${element.endTime}`);
    item.checkboxState = element.checked
      ? vscode.TreeItemCheckboxState.Checked
      : vscode.TreeItemCheckboxState.Unchecked;
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


  async loadICSFile(filePath: string) {
    try {
      let icsContent: string;
      if (filePath.startsWith("http")) {
        const res = await fetch(filePath);
        if (!res.ok) {throw new Error(`HTTP ${res.status}`);}
        icsContent = await res.text();
      } else {
        if (!fs.existsSync(filePath)) {
          vscode.window.showErrorMessage(`.ics 文件不存在: ${filePath}`);
          return;
        }
        icsContent = fs.readFileSync(filePath, "utf8");
      }
  
      const events = ical.parseICS(icsContent);
      const now = new Date();
      let addedCount = 0;
      for (const key in events) {
        const event = events[key];
        if (event.type === "VEVENT" && event.end instanceof Date && event.end > now) {
          const label = event.summary || "无标题任务";
          const endTime = event.end.toISOString().split("T")[0]; // YYYY-MM-DD
          const category = event.location || "BB-tasks";
          this.addItem(label, endTime, category);
          addedCount++;
        }
      }
      vscode.window.showInformationMessage(`成功导入 ${addedCount} 条未来任务`);
    } catch (err) {
      vscode.window.showErrorMessage(`加载 .ics 文件失败: ${err}`);
    }
  }
}

