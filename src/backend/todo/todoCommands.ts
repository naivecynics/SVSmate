import * as vscode from 'vscode';
import { TodoListViewProvider, TodoItem } from '../../frontend/TodoListView';

/**
 * Add a new top-level task to the to-do list.
 * Prompts the user for task name, due date, and category.
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
 * Edit the selected task's properties.
 * Opens input boxes for modifying task name, category, and due date.
 * 
 * @param todoListViewProvider - The provider managing the to-do list.
 * @param item - The task to edit.
 */
export async function editTask(todoListViewProvider: TodoListViewProvider, item: TodoItem): Promise<void> {
    todoListViewProvider.editTask(item);
}

/**
 * Delete the selected task from the to-do list.
 * If the task has subtasks, they will also be deleted.
 * 
 * @param todoListViewProvider - The provider managing the to-do list.
 * @param item - The task to delete.
 */
export async function deleteTask(todoListViewProvider: TodoListViewProvider, item: TodoItem): Promise<void> {
    todoListViewProvider.deleteTask(item);
}

/**
 * Toggle the checkbox state (completed or not) of a task.
 * When toggling a parent task, all subtasks will be updated to match.
 * When all subtasks are completed, the parent task will be automatically marked as completed.
 * 
 * @param todoListViewProvider - The provider managing the to-do list.
 * @param item - The task whose completion state will be toggled.
 */
export async function toggleTaskCheckbox(todoListViewProvider: TodoListViewProvider, item: TodoItem): Promise<void> {
    todoListViewProvider.toggleTaskCheckbox(item);
}

/**
 * Sort all tasks by their due date.
 * Sorts both top-level tasks and subtasks recursively.
 * 
 * @param todoListViewProvider - The provider managing the to-do list.
 */
export async function sortByEndTime(todoListViewProvider: TodoListViewProvider): Promise<void> {
    todoListViewProvider.sortBy("endTime");
}

/**
 * Sort all tasks by their category.
 * Groups tasks by their assigned categories while maintaining the hierarchy.
 * 
 * @param todoListViewProvider - The provider managing the to-do list.
 */
export async function sortByKinds(todoListViewProvider: TodoListViewProvider): Promise<void> {
    todoListViewProvider.sortBy("category");
}

/**
 * Search for tasks by name using fuzzy matching.
 * Searches through both top-level tasks and subtasks.
 * Case-insensitive search that supports partial matches.
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
 * Restores the full task list view.
 * 
 * @param todoListViewProvider - The provider managing the to-do list.
 */
export async function clearSearch(todoListViewProvider: TodoListViewProvider): Promise<void> {
    todoListViewProvider.clearSearch();
}

/**
 * Add a subtask to an existing task.
 * The subtask inherits the category and due date from its parent task.
 * 
 * @param todoListViewProvider - The provider managing the to-do list.
 * @param task - The parent task to which a subtask will be added.
 */
export async function addSubTask(todoListViewProvider: TodoListViewProvider, task: TodoItem): Promise<void> {
    todoListViewProvider.addSubTask(task);
}

/**
 * Load tasks from an external ICS calendar URL and import them into the to-do list.
 * Supports both local .ics files and remote URLs.
 * Only imports future events, skipping past events.
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
