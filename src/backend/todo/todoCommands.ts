import * as vscode from 'vscode';
import { TodoListViewProvider, TodoItem } from '../../frontend/TodoListView';

/**
 * Add a new top-level task to the to-do list.
 * 
 * @param todoListViewProvider - The provider managing the to-do list.
 */
export async function addItem(todoListViewProvider: TodoListViewProvider): Promise<void> {
    const input = await vscode.window.showInputBox({ prompt: "Enter task name" });

    if (input) {
        const endDate = await vscode.window.showInputBox({ prompt: "Enter due date (format: YYYY-MM-DD)" });
        const category = await vscode.window.showInputBox({ prompt: "Enter task category" });

        if (endDate) {
            todoListViewProvider.addItem(input, endDate, category || "No Category");
        }
    }
}

/**
 * Edit the selected task.
 * 
 * @param todoListViewProvider - The provider managing the to-do list.
 * @param item - The task to edit.
 */
export async function editTask(todoListViewProvider: TodoListViewProvider, item: TodoItem): Promise<void> {
    todoListViewProvider.editTask(item);
}

/**
 * Delete the selected task from the to-do list.
 * 
 * @param todoListViewProvider - The provider managing the to-do list.
 * @param item - The task to delete.
 */
export async function deleteTask(todoListViewProvider: TodoListViewProvider, item: TodoItem): Promise<void> {
    todoListViewProvider.deleteTask(item);
}

/**
 * Toggle the checkbox state (completed or not) of a task.
 * 
 * @param todoListViewProvider - The provider managing the to-do list.
 * @param item - The task whose completion state will be toggled.
 */
export async function toggleTaskCheckbox(todoListViewProvider: TodoListViewProvider, item: TodoItem): Promise<void> {
    todoListViewProvider.toggleTaskCheckbox(item);
}

/**
 * Sort all tasks by their due date.
 * 
 * @param todoListViewProvider - The provider managing the to-do list.
 */
export async function sortByEndTime(todoListViewProvider: TodoListViewProvider): Promise<void> {
    todoListViewProvider.sortBy("endTime");
}

/**
 * Sort all tasks by their category.
 * 
 * @param todoListViewProvider - The provider managing the to-do list.
 */
export async function sortByKinds(todoListViewProvider: TodoListViewProvider): Promise<void> {
    todoListViewProvider.sortBy("category");
}

/**
 * Search for tasks by name using fuzzy matching.
 * 
 * @param todoListViewProvider - The provider managing the to-do list.
 */
export async function searchTasks(todoListViewProvider: TodoListViewProvider): Promise<void> {
    const searchTerm = await vscode.window.showInputBox({
        prompt: 'Enter task name (supports fuzzy search)',
        placeHolder: 'e.g., Develop feature'
    });

    if (searchTerm !== undefined) {
        todoListViewProvider.setSearchTerm(searchTerm);
    }
}

/**
 * Clear any active search filter from the to-do list.
 * 
 * @param todoListViewProvider - The provider managing the to-do list.
 */
export async function clearSearch(todoListViewProvider: TodoListViewProvider): Promise<void> {
    todoListViewProvider.clearSearch();
}

/**
 * Add a subtask to an existing task.
 * 
 * @param todoListViewProvider - The provider managing the to-do list.
 * @param task - The parent task to which a subtask will be added.
 */
export async function addSubTask(todoListViewProvider: TodoListViewProvider, task: TodoItem): Promise<void> {
    todoListViewProvider.addSubTask(task);
}

/**
 * Load tasks from an external ICS calendar URL and import them into the to-do list.
 * 
 * @param todoListViewProvider - The provider managing the to-do list.
 */
export async function loadICSFile(todoListViewProvider: TodoListViewProvider): Promise<void> {
    const input = await vscode.window.showInputBox({
        prompt: 'Paste the URL of the external .ics calendar file',
        placeHolder: 'https://example.com/calendar.ics',
        ignoreFocusOut: true
    });

    if (input && input.trim().startsWith('http')) {
        await todoListViewProvider.loadICSFile(input.trim());
    } else {
        vscode.window.showErrorMessage('Please enter a valid .ics URL (must start with http)');
    }
}
