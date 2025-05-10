import * as vscode from 'vscode';
import { TodoListViewProvider, TodoItem } from '../../frontend/TodoListView';

// 添加主任务
export async function addItem(todoListViewProvider: TodoListViewProvider) {
  const input = await vscode.window.showInputBox({ prompt: "Enter task name" });
  if (input) {
    const endDate = await vscode.window.showInputBox({ prompt: "Enter due date (format: YYYY-MM-DD)" });
    const category = await vscode.window.showInputBox({ prompt: "Enter task category" });
    if (endDate) {
      todoListViewProvider.addItem(input, endDate, category || "No Category");
    }
  }
}

// 编辑任务
export async function editTask(todoListViewProvider: TodoListViewProvider, item: TodoItem) {
  todoListViewProvider.editTask(item);
}

// 删除任务
export async function deleteTask(todoListViewProvider: TodoListViewProvider, item: TodoItem) {
  todoListViewProvider.deleteTask(item);
}

// 切换任务完成状态
export async function toggleTaskCheckbox(todoListViewProvider: TodoListViewProvider, item: TodoItem) {
  todoListViewProvider.toggleTaskCheckbox(item);
}

// 按截止时间排序
export async function sortByEndTime(todoListViewProvider: TodoListViewProvider) {
  todoListViewProvider.sortBy("endTime");
}

// 按分类排序
export async function sortByKinds(todoListViewProvider: TodoListViewProvider) {
  todoListViewProvider.sortBy("category");
}

// 搜索任务
export async function searchTasks(todoListViewProvider: TodoListViewProvider) {
  const searchTerm = await vscode.window.showInputBox({
    prompt: 'Enter task name (supports fuzzy search)',
    placeHolder: 'e.g., Develop feature'
  });
  if (searchTerm !== undefined) {
    todoListViewProvider.setSearchTerm(searchTerm);
  }
}

// 清除搜索
export async function clearSearch(todoListViewProvider: TodoListViewProvider) {
  todoListViewProvider.clearSearch();
}

// 添加子任务
export async function addSubTask(todoListViewProvider: TodoListViewProvider, task: TodoItem) {
  todoListViewProvider.addSubTask(task);
}

// 加载ICS文件
export async function loadICSFile(todoListViewProvider: TodoListViewProvider) {
  const input = await vscode.window.showInputBox({
    prompt: '请点击获取外部日程表链接并复制URL',
    placeHolder: 'https://example.com/calendar.ics',
    ignoreFocusOut: true
  });

  if (input && input.trim().startsWith('http')) {
    await todoListViewProvider.loadICSFile(input.trim());
  } else {
    vscode.window.showErrorMessage('请输入一个有效的 .ics 网络链接（以 http 开头）');
  }
}
