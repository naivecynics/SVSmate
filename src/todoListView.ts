import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";

// interface TodoItem {
//   label: string;
//   endTime: string;
//   category: string;
//   checked: boolean;
// }
interface TodoItem {
  label: string;
  endTime: string;
  category: string;
  checked: boolean;
  children?: TodoItem[]; // 新增子任务数组
  expanded?: boolean;    // 是否展开子任务
}

export class TodoListViewProvider implements vscode.TreeDataProvider<TodoItem> {
  public _onDidChangeTreeData = new vscode.EventEmitter<TodoItem | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private items: TodoItem[] = [];
  private jsonFilePath: string = path.join(vscode.workspace.rootPath || '', 'data', 'tasks.json');  // Default path

  getTreeItem(element: TodoItem): vscode.TreeItem {

    const treeItem = new vscode.TreeItem(element.label, vscode.TreeItemCollapsibleState.None);

    // 实现搜索关键词高亮
    if (this._searchTerm && element.label.toLowerCase().includes(this._searchTerm)) {
      treeItem.label = this.highlightSearchTerm(element.label, this._searchTerm);
      treeItem.description = `[${element.category}] 🔍`; // 添加搜索标记
    } else {
      treeItem.label = element.label;
      treeItem.description = `[${element.category}]`;
    }

  
    treeItem.iconPath = new vscode.ThemeIcon(element.checked ? "check" : "circle-outline");
    treeItem.label = element.label;
    treeItem.description = `[${element.category}] ❗${element.endTime}`; 
    treeItem.tooltip = new vscode.MarkdownString(`**任务:** ${element.label}  \n**分类:** ${element.category}  \n**截止日期:** ${element.endTime}`);
    treeItem.resourceUri = vscode.Uri.parse(`date:${element.endTime}`);

    // Set the checkbox state to Checked or Unchecked based on the task's `checked` field
    treeItem.checkboxState = element.checked
      ? vscode.TreeItemCheckboxState.Checked
      : vscode.TreeItemCheckboxState.Unchecked;

    // Command to toggle checkbox 左键点击事件
    treeItem.command = {
      command: "todoListView.toggleTaskCheckbox",
      title: "Toggle Task Checkbox",
      arguments: [element]
    }
    
    
    return treeItem;
  }


  private _searchTerm: string = ''; // 当前搜索关键词
  private _filteredItems: TodoItem[] = []; // 过滤后的任务列表

  //实现搜索功能
  setSearchTerm(term: string) {
    this._searchTerm = term.trim().toLowerCase();
    this._filteredItems = this._searchTerm 
      ? this.items.filter(item => 
          item.label.toLowerCase().includes(this._searchTerm)
        )
      : this.items;
    this._onDidChangeTreeData.fire(undefined); // 刷新视图
  }

  private highlightSearchTerm(text: string, term: string): string {
    const regex = new RegExp(`(${term})`, 'gi');
    return text.replace(regex, '**$1**'); // 用 Markdown 加粗语法高亮
  }

  getChildren(): TodoItem[] {
    return this._searchTerm ? this._filteredItems : this.items;
  }

  // 去除搜索状态
  clearSearch() {
    this._searchTerm = '';
    this._filteredItems = [];
    this._onDidChangeTreeData.fire(undefined);
  }

  // getChildren(): TodoItem[] {
  //   return this.items;
  // }

  addItem(label: string, endTime: string, category: string) {
    if(!/^\d{4}-\d{2}-\d{2}$/.test(endTime)) {
      vscode.window.showErrorMessage("日期格式错误 请按照YYYY-MM-DD格式输入");
      return;
    }
    this.items.push({ label, endTime, category, checked: false });
    this._onDidChangeTreeData.fire(undefined);
    this.saveJsonFile();  // Save to the file when new item is added
  }

  async editTask(item: TodoItem) {
    const newLabel = await vscode.window.showInputBox({ prompt: "修改任务名称", value: item.label });
    const newCategory = await vscode.window.showInputBox({ prompt: "修改任务分类", value: item.category });
    
    if (newLabel !== undefined && newCategory !== undefined) {
      item.label = newLabel;
      item.category = newCategory;
      this._onDidChangeTreeData.fire(undefined);
      this.saveJsonFile();  // Save after editing
    }
  }

  async deleteTask(item: TodoItem) {
    const index = this.items.indexOf(item);
    this.items.splice(index, 1);
    this._onDidChangeTreeData.fire(undefined);
    this.saveJsonFile();  // Save after deleting
  }

  // Load data from a JSON file
  async loadJsonFile(filePath: string) {
    if (!fs.existsSync(filePath)) {
      vscode.window.showErrorMessage(`文件不存在: ${filePath}`);
      return;
    }

    // const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
    let data;
    try {
      data = JSON.parse(fs.readFileSync(filePath, "utf8"));
    }
    catch (error) {
      vscode.window.showErrorMessage(`无法解析 JSON 文件: ${filePath}`);
      return;
    }
    this.items = data.map((task: any) => ({
      label: task.Name || "未命名任务",
      endTime: task.DDL || "无截止日期",
      category: task.Variety || "无分类",
      checked: task.Finish || false, // Automatically check tasks with Finish: true
    }));

    this._onDidChangeTreeData.fire(undefined);
    vscode.window.showInformationMessage("任务列表已从 JSON 文件加载");
  }

  // Save data to a JSON file
  saveJsonFile() {
    const dataFolder = path.join(vscode.workspace.rootPath || '');
    if (!fs.existsSync(dataFolder)) {
      fs.mkdirSync(dataFolder);
    }

    const dataFilePath = path.join(dataFolder, 'tasks.json');
    const data = this.items.map(item => ({
      Name: item.label,
      DDL: item.endTime,
      Variety: item.category,
      Finish: item.checked, // Store the checkbox state (checked: true/false)
    }));

    fs.writeFileSync(dataFilePath, JSON.stringify(data, null, 2), "utf8");
  }

  // Toggle task checkbox
  toggleTaskCheckbox(item: TodoItem) {
    item.checked = !item.checked; // Toggle the checkbox state
    this._onDidChangeTreeData.fire(undefined);
    this.saveJsonFile();  // Save the updated state to the JSON file
  }

  sortBy(key: "endTime" | "category") {
    if (key === "endTime") {
      this.items.sort((a, b) => a.endTime.localeCompare(b.endTime)); // 按时间排序
    } else {
      this.items.sort((a, b) => a.category.localeCompare(b.category)); // 按字母排序
    }

    this._onDidChangeTreeData.fire(undefined);
  }
  
}
