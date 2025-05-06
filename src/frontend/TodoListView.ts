import * as vscode from "vscode";
import * as fs from "fs";
import * as ical from "node-ical";
import * as PathManager from "../utils/pathManager";
import * as aiSubtask from "../backend/ai/createSubtasks";

interface TodoItem {
  id: string;           // 唯一标识
  label: string;
  endTime: string;
  category: string;
  checked: boolean;
  children: TodoItem[]; // 子任务数组
}

export class TodoListViewProvider implements vscode.TreeDataProvider<TodoItem>, vscode.Disposable {
  public _onDidChangeTreeData = new vscode.EventEmitter<TodoItem | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private items: TodoItem[] = [];
  private _searchTerm = "";
  private _filteredItems: TodoItem[] = [];

  private constructor() { } // 私有构造，只允许 create() 创建实例

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
    // 判断是否有子任务，决定是否可折叠
    const hasChildren = element.children && element.children.length > 0;
    const state = hasChildren
      ? vscode.TreeItemCollapsibleState.Collapsed
      : vscode.TreeItemCollapsibleState.None;

    const item = new vscode.TreeItem(element.label, state);
    item.iconPath = new vscode.ThemeIcon(element.checked ? "check" : "circle-outline");
    item.tooltip = new vscode.MarkdownString(
      `**任务:** ${element.label}\n**分类:** ${element.category}\n**截止:** ${element.endTime}${hasChildren ? `\n**子任务:** ${element.children.length}个` : ""
      }`
    );
    item.description = `[${element.category}] ❗${element.endTime}${hasChildren ? ` (${element.children.length})` : ""
      }`;
    item.resourceUri = vscode.Uri.parse(`date:${element.endTime}`);
    item.checkboxState = element.checked
      ? vscode.TreeItemCheckboxState.Checked
      : vscode.TreeItemCheckboxState.Unchecked;
    item.command = {
      command: "todoListView.toggleTaskCheckbox",
      title: "Toggle Task",
      arguments: [element]
    };

    // 添加上下文键，用于右键菜单区分主任务和子任务
    item.contextValue = element.id.includes("/") ? "subtask" : "task";

    return item;
  }

  getChildren(element?: TodoItem): vscode.ProviderResult<TodoItem[]> {
    if (this._searchTerm) {
      // 搜索模式下，展平所有任务
      return this._filteredItems;
    }

    if (!element) {
      // 根节点，返回顶级任务
      return this.items;
    }

    // 子节点，返回其子任务
    return element.children;
  }

  getParent(element: TodoItem): vscode.ProviderResult<TodoItem> {
    // 实现父任务查找，用于支持树视图导航
    if (!element.id.includes("/")) {
      return null; // 顶级任务没有父任务
    }

    const parentId = element.id.split("/").slice(0, -1).join("/");
    return this.findTaskById(parentId);
  }

  private findTaskById(id: string, items: TodoItem[] = this.items): TodoItem | undefined {
    for (const item of items) {
      if (item.id === id) {
        return item;
      }
      if (item.children.length > 0) {
        const found = this.findTaskById(id, item.children);
        if (found) {
          return found;
        }
      }
    }
    return undefined;
  }

  // 🔍 搜索
  setSearchTerm(term: string) {
    this._searchTerm = term.trim().toLowerCase();
    this._filteredItems = [];

    if (this._searchTerm) {
      // 递归查找匹配项，并展平结果
      this.findMatchingTasks(this.items, this._searchTerm, this._filteredItems);
    }

    this._onDidChangeTreeData.fire(undefined);
  }

  private findMatchingTasks(items: TodoItem[], term: string, results: TodoItem[]) {
    for (const item of items) {
      if (item.label.toLowerCase().includes(term)) {
        results.push(item);
      }
      if (item.children.length > 0) {
        this.findMatchingTasks(item.children, term, results);
      }
    }
  }

  clearSearch() {
    this._searchTerm = "";
    this._filteredItems = [];
    this._onDidChangeTreeData.fire(undefined);
  }

  // ✅ 添加主任务
  addItem(label: string, endTime: string, category: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(endTime)) {
      vscode.window.showErrorMessage("日期格式错误，请使用 YYYY-MM-DD");
      return;
    }

    // Parse the date and validate it
    const parts = endTime.split('-');
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    const day = parseInt(parts[2], 10);

    // Create a Date object (note: month is 0-indexed in JavaScript)
    const date = new Date(year, month - 1, day);

    // Validate the date components match the input (to catch invalid dates like 2023-02-30)
    const isValidDate = (date.getFullYear() === year) &&
      (date.getMonth() === month - 1) &&
      (date.getDate() === day);

    if (!isValidDate || year < 2000) {
      vscode.window.showErrorMessage("请输入2000年以后的合法日期");
      return;
    }

    const id = `task_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    this.items.push({
      id,
      label,
      endTime,
      category,
      checked: false,
      children: []
    });

    this.saveToDisk();
    this._onDidChangeTreeData.fire(undefined);
  }

  // ✅ 添加子任务
  async addSubTask(parentTask: TodoItem) {
    const label = await vscode.window.showInputBox({ prompt: "子任务名称" });
    if (!label) { return; }

    const subTaskId = `${parentTask.id}/${Date.now()}`;
    const subTask: TodoItem = {
      id: subTaskId,
      label,
      endTime: parentTask.endTime, // 继承父任务截止日期
      category: parentTask.category, // 继承父任务分类
      checked: false,
      children: []
    };

    parentTask.children.push(subTask);
    this.saveToDisk();
    this._onDidChangeTreeData.fire(undefined);
  }

  async editTask(task: TodoItem) {
    const newLabel = await vscode.window.showInputBox({ prompt: "修改任务名", value: task.label });
    const newCategory = await vscode.window.showInputBox({ prompt: "修改分类", value: task.category });
    const newEndTime = await vscode.window.showInputBox({
      prompt: "修改截止日期 (YYYY-MM-DD)",
      value: task.endTime,
      validateInput: (value) => {
        return /^\d{4}-\d{2}-\d{2}$/.test(value) ? null : "日期格式错误，请使用 YYYY-MM-DD";
      }
    });

    if (newLabel !== undefined && newCategory !== undefined && newEndTime !== undefined) {
      task.label = newLabel;
      task.category = newCategory;
      task.endTime = newEndTime;
      this.saveToDisk();
      this._onDidChangeTreeData.fire(undefined);
    }
  }

  deleteTask(task: TodoItem) {
    // 如果是子任务，需要找到父任务
    if (task.id.includes("/")) {
      const parentId = task.id.split("/").slice(0, -1).join("/");
      const parent = this.findTaskById(parentId);
      if (parent) {
        const index = parent.children.findIndex(t => t.id === task.id);
        if (index !== -1) {
          parent.children.splice(index, 1);
        }
      }
    } else {
      // 顶级任务
      const index = this.items.indexOf(task);
      if (index !== -1) {
        this.items.splice(index, 1);
      }
    }

    this.saveToDisk();
    this._onDidChangeTreeData.fire(undefined);
  }

  toggleTaskCheckbox(task: TodoItem) {
    task.checked = !task.checked;

    // 递归更新子任务状态
    if (task.children.length > 0) {
      this.updateChildrenCheckState(task.children, task.checked);
    }

    // 更新父任务状态（如果所有子任务完成，则父任务也标记完成）
    this.updateParentCheckState(task);

    this.saveToDisk();
    this._onDidChangeTreeData.fire(undefined);
  }

  // 递归更新子任务状态
  private updateChildrenCheckState(children: TodoItem[], checked: boolean) {
    for (const child of children) {
      child.checked = checked;
      if (child.children.length > 0) {
        this.updateChildrenCheckState(child.children, checked);
      }
    }
  }

  // 更新父任务状态
  private updateParentCheckState(task: TodoItem) {
    if (!task.id.includes("/")) {
      return; // 顶级任务无需更新父状态
    }

    const pathParts = task.id.split("/");
    // 如果路径少于2部分，没有父任务
    if (pathParts.length < 2) {
      return;
    }

    const parentId = pathParts.slice(0, -1).join("/");
    const parent = this.findTaskById(parentId);

    if (parent) {
      // 检查所有子任务是否已完成
      const allChecked = parent.children.every(child => child.checked);
      parent.checked = allChecked;

      // 递归更新更高层级的父任务
      this.updateParentCheckState(parent);
    }
  }

  sortBy(key: "endTime" | "category") {
    // 递归排序所有任务和子任务
    this.sortItems(this.items, key);
    this._onDidChangeTreeData.fire(undefined);
  }

  private sortItems(items: TodoItem[], key: "endTime" | "category") {
    items.sort((a, b) => a[key].localeCompare(b[key]));

    // 递归排序子任务
    for (const item of items) {
      if (item.children.length > 0) {
        this.sortItems(item.children, key);
      }
    }
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

      // 将扁平的数据转换为树形结构
      this.items = this.buildTaskTree(rawData);
    } catch (err) {
      vscode.window.showErrorMessage(`加载任务失败: ${err}`);
      this.items = [];
    }
  }

  // 构建任务树
  private buildTaskTree(data: any[]): TodoItem[] {
    const allTasks: Record<string, TodoItem> = {};
    const rootTasks: TodoItem[] = [];

    // 第一遍：创建所有任务对象
    for (const item of data) {
      const task: TodoItem = {
        id: item.id || `task_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        label: item.Name || "未命名任务",
        endTime: item.DDL || "无截止",
        category: item.Variety || "未分类",
        checked: item.Finish || false,
        children: []
      };

      allTasks[task.id] = task;
    }

    // 第二遍：构建任务树
    for (const id in allTasks) {
      const task = allTasks[id];

      // 检查是否为子任务
      if (task.id.includes("/")) {
        const parentId = task.id.split("/").slice(0, -1).join("/");
        const parent = allTasks[parentId];

        if (parent) {
          parent.children.push(task);
        } else {
          // 找不到父任务，作为顶级任务处理
          rootTasks.push(task);
        }
      } else {
        // 顶级任务
        rootTasks.push(task);
      }
    }

    return rootTasks;
  }

  // 💾 保存任务
  private saveToDisk() {
    const filePath = PathManager.getFile("todoList");

    // 将树形结构展平为一维数组
    const flattenedTasks = this.flattenTaskTree(this.items);

    const json = flattenedTasks.map(i => ({
      id: i.id,
      Name: i.label,
      DDL: i.endTime,
      Variety: i.category,
      Finish: i.checked
    }));

    fs.writeFileSync(filePath, JSON.stringify(json, null, 2), "utf8");
  }

  // 展平任务树为一维数组
  private flattenTaskTree(items: TodoItem[]): TodoItem[] {
    let result: TodoItem[] = [];

    for (const item of items) {
      result.push(item);

      if (item.children.length > 0) {
        result = result.concat(this.flattenTaskTree(item.children));
      }
    }

    return result;
  }


  async generateAISubtasks(task: TodoItem) {
    try {
      await aiSubtask.addAIGeneratedSubtasks(task, this);
    } catch (error) {
      vscode.window.showErrorMessage(`生成子任务失败: ${(error as Error).message}`);
    }
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
