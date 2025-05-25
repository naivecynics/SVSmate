import * as vscode from 'vscode';
import { createChatParticipantAPI } from './backend/ai/createChatParticipantAPI';
import { createChatParticipant } from './backend/ai/createChatParticipant';
import { updateAll, updateCourse, updateTerm } from './backend/bb/updateCommands';
import { downloadToWorkspace } from './backend/bb/downloadCommands';
import { addAIGeneratedSubtasks } from './backend/ai/createSubtasks';
import { generateCodeFromPdf } from './backend/pdf/pdfCommands';
import { addItem, editTask, deleteTask, toggleTaskCheckbox, sortByEndTime, sortByKinds, searchTasks, clearSearch, addSubTask, loadICSFile } from './backend/todo/todoCommands';

import { FolderViewProvider } from "./frontend/FolderView";
import { TodoListViewProvider, TodoItem } from "./frontend/TodoListView";
import { CopilotViewProvider } from "./frontend/CopilotView";
import { NotesViewProvider } from "./frontend/NotesView";
import { BBMaterialViewProvider, BBMaterialItem } from "./frontend/BBMaterialView";

import { outputChannel } from './utils/OutputChannel';
import * as PathManager from './utils/pathManager';
import { localize } from './utils/i18n';


/**
 * Activates the SVSmate extension.
 * Initializes path manager, registers tree data providers, and sets up commands.
 * @param context - The VS Code extension context.
 */
export async function activate(context: vscode.ExtensionContext) {

    PathManager.initPathManager(context);

    outputChannel.info('SVSmate Main!', 'SVSmate activated!');
    console.log('SVSmate activated!');
    console.log(`Initial subscriptions count: ${context.subscriptions.length}`);

    // ------------------------------------------------
    //                      file
    // ------------------------------------------------    
    const folderViewProvider = FolderViewProvider.create();
    if (folderViewProvider) {
        context.subscriptions.push(
            vscode.window.registerTreeDataProvider("folderView", folderViewProvider),
            folderViewProvider
        );
        console.log(`After folderView registration: ${context.subscriptions.length} subscriptions`);
    }// ------------------------------------------------
    //                       ai
    // ------------------------------------------------

    // copilot ai chatbot @mate-API & @mate
    const chatParticipantAPI = createChatParticipantAPI();
    const chatParticipant = createChatParticipant();

    context.subscriptions.push(
        chatParticipantAPI,
        chatParticipant,
        vscode.window.registerWebviewViewProvider("copilotView", CopilotViewProvider.create())
    );
    console.log(`After AI components registration: ${context.subscriptions.length} subscriptions`);

    // ------------------------------------------------
    //                   blaskboard
    // ------------------------------------------------
    const bbMaterialViewProvider = BBMaterialViewProvider.create();
    context.subscriptions.push(
        vscode.window.registerTreeDataProvider("bbMaterialView", bbMaterialViewProvider),
        bbMaterialViewProvider
    );
    context.subscriptions.push(
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
    console.log(`After BB components registration: ${context.subscriptions.length} subscriptions`);

    // ------------------------------------------------
    //                 collaboration
    // ------------------------------------------------

    // TODO: How? 

    // ------------------------------------------------
    //                      note
    // ------------------------------------------------
    const notesViewProvider = await NotesViewProvider.create();
    if (notesViewProvider) {
        context.subscriptions.push(
            vscode.window.registerTreeDataProvider("notesView", notesViewProvider),
            notesViewProvider
        );
    }

    context.subscriptions.push(
        vscode.commands.registerCommand('notesView.createNote', async (folderPath: string) => {
            if (notesViewProvider) {
                await notesViewProvider.createNote(folderPath);
            }
        }),

        vscode.commands.registerCommand('notesView.deleteNote', async (item: any) => {
            if (!notesViewProvider) {
                return;
            }
            try {                const answer = await vscode.window.showWarningMessage(
                    localize('notesView.deleteConfirmation', `Are you sure you want to delete the note "${item.label}"?`),
                    localize('common.yes', 'Yes'),
                    localize('common.no', 'No')
                );                if (answer === localize('common.yes', 'Yes')) {
                    await notesViewProvider.deleteNote(item.resourceUri.fsPath);
                    vscode.window.showInformationMessage(localize('notesView.deleteSuccess', `Note "${item.label}" has been deleted`));
                }            } catch (error) {
                vscode.window.showErrorMessage(localize('notesView.deleteError', `Failed to delete note: ${error}`));
            }
        })
    );
    console.log(`After notes components registration: ${context.subscriptions.length} subscriptions`);

    // ------------------------------------------------
    //                      pdf
    // ------------------------------------------------

    context.subscriptions.push(
        vscode.commands.registerCommand("svsmate.PDF-generateFromPDF", async () => {
            // 动态导入 PDF 功能
            try {
                const { generateCodeFromPdf } = await import('./backend/pdf/pdfCommands.js');
                await generateCodeFromPdf();
            } catch (error) {
                if (error instanceof Error) {                    vscode.window.showErrorMessage(localize('pdf.loadError', `Failed to load PDF module: ${error.message}`));
                } else {
                    vscode.window.showErrorMessage(localize('pdf.loadErrorUnknown', 'Failed to load PDF module: Unknown error'));
                }
            }
        })
    );

    // ------------------------------------------------
    //                      todo
    // ------------------------------------------------
    const todoListViewProvider = await TodoListViewProvider.create();
    if (todoListViewProvider) {
        context.subscriptions.push(vscode.window.registerTreeDataProvider("todoListView", todoListViewProvider),
            todoListViewProvider);
    }

    context.subscriptions.push(

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
    console.log(`Final subscriptions count: ${context.subscriptions.length} subscriptions`);
}

/**
 * Deactivates the SVSmate extension.
 * Cleans up resources when the extension is deactivated.
 */
export function deactivate() {
    outputChannel.info('SVSmate Main!', 'SVSmate deactivated!');
    console.log('SVSmate deactivated!');

    // Force garbage collection if available
    if (global.gc) {
        global.gc();
        console.log('Forced garbage collection');
    }
}
