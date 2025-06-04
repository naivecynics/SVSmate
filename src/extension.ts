import * as vscode from 'vscode';
import { updateCourse } from './backend/commands/updateCourse';
import { updateTerm } from './backend/commands/updateTerm';
import { downloadItem } from './backend/commands/downloadItem';
import { deleteItem } from './backend/commands/deleteItem';
import { syncCalendar } from './backend/commands/syncCalendar';
import { addItem, editTask, deleteTask, toggleTaskCheckbox, sortByEndTime, sortByKinds, searchTasks, clearSearch, addSubTask, loadICSFile } from './backend/todo/todoCommands';

import { FolderViewProvider } from "./frontend/FolderView";
import { TodoListViewProvider, TodoItem } from "./frontend/TodoListView";
import { BBMaterialViewProvider, BBMaterialItem } from "./frontend/BBMaterialView";

import { log } from './utils/OutputChannel';
import * as PathManager from './utils/pathManager';
import { CredentialManager } from './backend/auth/CredentialManager';


export async function activate(context: vscode.ExtensionContext) {

    PathManager.initPathManager(context);
    const credentialManager = new CredentialManager(context);
    log.info('SVSmate Main', 'SVSmate activated!');

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

        vscode.commands.registerCommand('svsmate.updateTerm', async (item: BBMaterialItem) => {
            await updateTerm(context, item);
        }),

        vscode.commands.registerCommand('svsmate.updateCourse', async (item: BBMaterialItem) => {
            await updateCourse(context, item);
        }),

        vscode.commands.registerCommand('svsmate.downloadItem', async (item: BBMaterialItem) => {
            await downloadItem(context, item);
        }),

        vscode.commands.registerCommand('svsmate.deleteItem', async (item: BBMaterialItem) => {
            await deleteItem(item);
        }),

        vscode.commands.registerCommand('svsmate.switchAccount', async () => {
            await credentialManager.clearCredentials();
        }),

        vscode.commands.registerCommand('svsmate.syncCalendar', async () => {
            await syncCalendar(context);
        })


    );

    // ------------------------------------------------
    //                    calendar
    // ------------------------------------------------


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

        vscode.commands.registerCommand('todoListView.loadICSFile', async () => {
            await loadICSFile(todoListViewProvider);
        }),

    );
}

export function deactivate() { }
