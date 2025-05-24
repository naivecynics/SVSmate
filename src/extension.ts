import * as vscode from 'vscode';
import { updateAll, updateCourse, updateTerm } from './backend/bb/updateCommands';
import { downloadToWorkspace } from './backend/bb/downloadCommands';
import { addAIGeneratedSubtasks } from './backend/ai/createSubtasks';
import { addItem, editTask, deleteTask, toggleTaskCheckbox, sortByEndTime, sortByKinds, searchTasks, clearSearch, addSubTask, loadICSFile } from './backend/todo/todoCommands';

import { FolderViewProvider } from "./frontend/FolderView";
import { TodoListViewProvider, TodoItem } from "./frontend/TodoListView";
import { BBMaterialViewProvider, BBMaterialItem } from "./frontend/BBMaterialView";

import { outputChannel } from './utils/OutputChannel';
import * as PathManager from './utils/pathManager';


export async function activate(context: vscode.ExtensionContext) {

    PathManager.initPathManager(context);

    outputChannel.info('SVSmate Main!', 'SVSmate activated!');
    console.log('SVSmate activated!');

    // ------------------------------------------------
    //                      file
    // ------------------------------------------------
    const folderViewProvider = FolderViewProvider.create();
    folderViewProvider && vscode.window.registerTreeDataProvider("folderView", folderViewProvider);
    folderViewProvider && context.subscriptions.push(folderViewProvider);

    // ------------------------------------------------
    //                   blaskboard
    // ------------------------------------------------
    const bbMaterialViewProvider = BBMaterialViewProvider.create();
    vscode.window.registerTreeDataProvider("bbMaterialView", bbMaterialViewProvider);
    context.subscriptions.push(

        bbMaterialViewProvider,

        vscode.commands.registerCommand('svsmate.BB-updateAll', async () => {
            await updateAll(context);
        }),

        vscode.commands.registerCommand('svsmate.BB-updateTerm', async (item: BBMaterialItem) => {
            await updateTerm(context, item);
        }),

        vscode.commands.registerCommand('svsmate.BB-updateCourse', async (item: BBMaterialItem) => {
            await updateCourse(context, item);
        }),

        vscode.commands.registerCommand('svsmate.BB-downloadToWorkspace', async (item: BBMaterialItem) => {
            await downloadToWorkspace(context, item);
        }),

        vscode.commands.registerCommand('svsmate.BB-downloadToAiSpace', async (item: BBMaterialItem) => {
            await downloadToWorkspace(context, item, true);
        }),

    );

    // ------------------------------------------------
    //                      todo
    // ------------------------------------------------
    const todoListViewProvider = await TodoListViewProvider.create();
    vscode.window.registerTreeDataProvider("todoListView", todoListViewProvider);

    context.subscriptions.push(

        todoListViewProvider,

        vscode.commands.registerCommand("todoListView.addItem", async () => {
            await addItem(todoListViewProvider);
        }),

        vscode.commands.registerCommand("todoListView.editTask", async (task) => {
            todoListViewProvider.editTask(task);
        }),

        vscode.commands.registerCommand("todoListView.deleteTask", async (item: TodoItem) => {
            await deleteTask(todoListViewProvider, item);
        }),

        vscode.commands.registerCommand("todoListView.toggleTaskCheckbox", async (item: TodoItem) => {
            await toggleTaskCheckbox(todoListViewProvider, item);
        }),

        vscode.commands.registerCommand("todoListView.sortByEndTime", async () => {
            await sortByEndTime(todoListViewProvider);
        }),

        vscode.commands.registerCommand("todoListView.sortByKinds", async () => {
            await sortByKinds(todoListViewProvider);
        }),

        vscode.commands.registerCommand('todoListView.searchTasks', async () => {
            await searchTasks(todoListViewProvider);
        }),

        vscode.commands.registerCommand('todoListView.clearSearch', async () => {
            await clearSearch(todoListViewProvider);
        }),

        vscode.commands.registerCommand('todoListView.addSubTask', async (item: TodoItem) => {
            await addSubTask(todoListViewProvider, item);
        }),

        vscode.commands.registerCommand('todoList.generateAISubtasks', async (item: TodoItem) => {
            await addAIGeneratedSubtasks(todoListViewProvider, item);
        }),

        vscode.commands.registerCommand('todoListView.loadICSFile', async () => {
            await loadICSFile(todoListViewProvider);
        }),

    );
}

export function deactivate() { }
