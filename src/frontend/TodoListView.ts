import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import * as ical from "node-ical";
import * as PathManager from "../utils/pathManager";
import * as aiSubtask from "../backend/ai/createSubtasks";

/**
 * Represents a task or subtask item in the to-do list.
 */
export interface TodoItem {
    id: string;             // Unique identifier
    label: string;
    endTime: string;
    category: string;
    checked: boolean;
    children: TodoItem[];
}

/**
 * Provides a tree view for managing hierarchical to-do tasks in VS Code.
 */
export class TodoListViewProvider implements vscode.TreeDataProvider<TodoItem>, vscode.Disposable {
    public _onDidChangeTreeData = new vscode.EventEmitter<TodoItem | undefined>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    private items: TodoItem[] = [];
    private _searchTerm = "";
    private _filteredItems: TodoItem[] = [];

    private constructor() {}

    /**
     * Creates and initializes the provider.
     */
    static async create(): Promise<TodoListViewProvider> {
        const provider = new TodoListViewProvider();
        await provider.loadFromDisk();
        return provider;
    }

    dispose(): void {
        this._onDidChangeTreeData.dispose();
    }

    getTreeItem(element: TodoItem): vscode.TreeItem {
        const hasChildren = element.children && element.children.length > 0;
        const state = hasChildren
            ? vscode.TreeItemCollapsibleState.Collapsed
            : vscode.TreeItemCollapsibleState.None;

        const item = new vscode.TreeItem(element.label, state);

        item.iconPath = {
            light: vscode.Uri.file(path.join(__filename, '..', '..', 'resources', element.checked ? 'check-light.svg' : 'circle-outline-light.svg')),
            dark: vscode.Uri.file(path.join(__filename, '..', '..', 'resources', element.checked ? 'check-dark.svg' : 'circle-outline-dark.svg'))
        };

        item.tooltip = `Task: ${element.label}\nCategory: ${element.category}\nDue: ${element.endTime}` +
            (hasChildren ? `\nSubtasks: ${element.children.length}` : '');

        item.description = `[${element.category}] ❗${element.endTime}${hasChildren ? ` (${element.children.length})` : ''}`;
        item.resourceUri = vscode.Uri.parse(`date:${element.endTime}`);
        item.command = {
            command: 'todoListView.toggleTaskCheckbox',
            title: 'Toggle Task',
            arguments: [element]
        };
        item.contextValue = element.id.includes('/') ? 'subtask' : 'task';

        return item;
    }

    getChildren(element?: TodoItem): vscode.ProviderResult<TodoItem[]> {
        if (this._searchTerm) return this._filteredItems;
        if (!element) return this.items;
        return element.children;
    }

    getParent(element: TodoItem): vscode.ProviderResult<TodoItem> {
        if (!element.id.includes("/")) return null;
        const parentId = element.id.split("/").slice(0, -1).join("/");
        return this.findTaskById(parentId);
    }

    private findTaskById(id: string, items: TodoItem[] = this.items): TodoItem | undefined {
        for (const item of items) {
            if (item.id === id) return item;
            const found = this.findTaskById(id, item.children);
            if (found) return found;
        }
        return undefined;
    }

    /**
     * Filters tasks by label (case-insensitive).
     */
    setSearchTerm(term: string) {
        this._searchTerm = term.trim().toLowerCase();
        this._filteredItems = [];

        if (this._searchTerm) {
            this.findMatchingTasks(this.items, this._searchTerm, this._filteredItems);
        }

        this._onDidChangeTreeData.fire(undefined);
    }

    private findMatchingTasks(items: TodoItem[], term: string, results: TodoItem[]) {
        for (const item of items) {
            if (item.label.toLowerCase().includes(term)) results.push(item);
            if (item.children.length > 0) this.findMatchingTasks(item.children, term, results);
        }
    }

    clearSearch() {
        this._searchTerm = "";
        this._filteredItems = [];
        this._onDidChangeTreeData.fire(undefined);
    }

    /**
     * Adds a new top-level task.
     */
    addItem(label: string, endTime: string, category: string) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(endTime)) {
            vscode.window.showErrorMessage("Invalid date format. Use YYYY-MM-DD.");
            return;
        }

        const [year, month, day] = endTime.split('-').map(Number);
        const date = new Date(year, month - 1, day);
        const isValidDate = date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;

        if (!isValidDate || year < 2000) {
            vscode.window.showErrorMessage("Enter a valid date after the year 2000.");
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

    /**
     * Adds a subtask under a given task.
     */
    async addSubTask(parentTask: TodoItem) {
        const label = await vscode.window.showInputBox({ prompt: "Enter subtask name" });
        if (!label) return;

        const subTask: TodoItem = {
            id: `${parentTask.id}/${Date.now()}`,
            label,
            endTime: parentTask.endTime,
            category: parentTask.category,
            checked: false,
            children: []
        };

        parentTask.children.push(subTask);
        this.saveToDisk();
        this._onDidChangeTreeData.fire(undefined);
    }

    /**
     * Allows editing of a task's label, category, and due date.
     */
    async editTask(task: TodoItem) {
        const newLabel = await vscode.window.showInputBox({ prompt: "Edit task name", value: task.label });
        const newCategory = await vscode.window.showInputBox({ prompt: "Edit category", value: task.category });
        const newEndTime = await vscode.window.showInputBox({
            prompt: "Edit due date (YYYY-MM-DD)",
            value: task.endTime,
            validateInput: (value) => /^\d{4}-\d{2}-\d{2}$/.test(value) ? null : "Invalid date format"
        });

        if (newLabel && newCategory && newEndTime) {
            task.label = newLabel;
            task.category = newCategory;
            task.endTime = newEndTime;
            this.saveToDisk();
            this._onDidChangeTreeData.fire(undefined);
        }
    }

    /**
     * Deletes a task or subtask.
     */
    deleteTask(task: TodoItem) {
        if (task.id.includes("/")) {
            const parentId = task.id.split("/").slice(0, -1).join("/");
            const parent = this.findTaskById(parentId);
            if (parent) parent.children = parent.children.filter(t => t.id !== task.id);
        } else {
            this.items = this.items.filter(t => t !== task);
        }

        this.saveToDisk();
        this._onDidChangeTreeData.fire(undefined);
    }

    /**
     * Toggles completion state of a task and updates children and parent accordingly.
     */
    toggleTaskCheckbox(task: TodoItem) {
        task.checked = !task.checked;
        if (task.children.length > 0) this.updateChildrenCheckState(task.children, task.checked);
        this.updateParentCheckState(task);
        this.saveToDisk();
        this._onDidChangeTreeData.fire(undefined);
    }

    private updateChildrenCheckState(children: TodoItem[], checked: boolean) {
        for (const child of children) {
            child.checked = checked;
            if (child.children.length > 0) this.updateChildrenCheckState(child.children, checked);
        }
    }

    private updateParentCheckState(task: TodoItem) {
        if (!task.id.includes("/")) return;
        const parentId = task.id.split("/").slice(0, -1).join("/");
        const parent = this.findTaskById(parentId);
        if (parent) {
            parent.checked = parent.children.every(c => c.checked);
            this.updateParentCheckState(parent);
        }
    }

    /**
     * Sorts tasks recursively by end date or category.
     */
    sortBy(key: "endTime" | "category") {
        this.sortItems(this.items, key);
        this._onDidChangeTreeData.fire(undefined);
    }

    private sortItems(items: TodoItem[], key: "endTime" | "category") {
        items.sort((a, b) => a[key].localeCompare(b[key]));
        for (const item of items) {
            if (item.children.length > 0) this.sortItems(item.children, key);
        }
    }

    private async loadFromDisk() {
        const filePath = PathManager.getFile("todoList");
        if (!fs.existsSync(filePath)) {
            vscode.window.showWarningMessage("Task file not found. A new file will be created.");
            this.items = [];
            this.saveToDisk();
            return;
        }

        try {
            const raw = fs.readFileSync(filePath, "utf8");
            const rawData = JSON.parse(raw);
            this.items = this.buildTaskTree(rawData);
        } catch (err) {
            vscode.window.showErrorMessage(`Failed to load tasks: ${err}`);
            this.items = [];
        }
    }

    private buildTaskTree(data: any[]): TodoItem[] {
        const allTasks: Record<string, TodoItem> = {};
        const rootTasks: TodoItem[] = [];

        for (const item of data) {
            const task: TodoItem = {
                id: item.id || `task_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
                label: item.Name || "Untitled",
                endTime: item.DDL || "N/A",
                category: item.Variety || "Uncategorized",
                checked: item.Finish || false,
                children: []
            };
            allTasks[task.id] = task;
        }

        for (const id in allTasks) {
            const task = allTasks[id];
            if (task.id.includes("/")) {
                const parentId = task.id.split("/").slice(0, -1).join("/");
                const parent = allTasks[parentId];
                parent ? parent.children.push(task) : rootTasks.push(task);
            } else {
                rootTasks.push(task);
            }
        }

        return rootTasks;
    }

    saveToDisk() {
        const filePath = PathManager.getFile("todoList");
        const flattened = this.flattenTaskTree(this.items);
        const json = flattened.map(i => ({
            id: i.id,
            Name: i.label,
            DDL: i.endTime,
            Variety: i.category,
            Finish: i.checked
        }));
        fs.writeFileSync(filePath, JSON.stringify(json, null, 2), "utf8");
    }

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

    /**
     * Loads tasks from a .ics calendar file.
     */
    async loadICSFile(filePath: string) {
        try {
            let icsContent: string;

            if (filePath.startsWith("http")) {
                const res = await fetch(filePath);
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                icsContent = await res.text();
            } else {
                if (!fs.existsSync(filePath)) {
                    vscode.window.showErrorMessage(`.ics file not found: ${filePath}`);
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
                    const label = event.summary || "Untitled Task";
                    const endTime = event.end.toISOString().split("T")[0];
                    const category = event.location || "Imported";
                    this.addItem(label, endTime, category);
                    addedCount++;
                }
            }

            vscode.window.showInformationMessage(`Successfully imported ${addedCount} upcoming tasks.`);
        } catch (err) {
            vscode.window.showErrorMessage(`Failed to load .ics file: ${err}`);
        }
    }
}
