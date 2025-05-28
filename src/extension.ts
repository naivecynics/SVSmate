import * as vscode from 'vscode';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { createChatParticipant } from './backend/ai/createChatParticipant';
import { updateAll, updateCourse, updateTerm } from './backend/bb/updateCommands';
import { downloadToWorkspace } from './backend/bb/downloadCommands';
import { addAIGeneratedSubtasks } from './backend/ai/createSubtasks';
import { addItem, editTask, deleteTask, toggleTaskCheckbox, sortByEndTime, sortByKinds, searchTasks, clearSearch, addSubTask, loadICSFile } from './backend/todo/todoCommands';

import { FolderViewProvider } from "./frontend/FolderView";
import { TodoListViewProvider, TodoItem } from "./frontend/TodoListView";
import { BBMaterialViewProvider, BBMaterialItem } from "./frontend/BBMaterialView";
import { SharedFilesViewProvider } from "./frontend/SharedFilesView";

import { outputChannel } from './utils/OutputChannel';
import * as PathManager from './utils/pathManager';
import { startServer, stopServer, connectToServer, disconnectFromServer, shareCurrentFile, shareFile, openSharedFile, showServerInfo, showClientInfo, discoverServers, connectToDiscoveredServer, refreshDiscoveredServers, sendMessage, showLatestMessage } from './backend/collaboration/collaborationCommands';


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
  }

  // ------------------------------------------------
  //                       ai
  // ------------------------------------------------
  // copilot ai chatbot @mate
  const chatParticipant = createChatParticipant();
  if (chatParticipant) {
    context.subscriptions.push(chatParticipant);
  }
  console.log(`After AI components registration: ${context.subscriptions.length} subscriptions`);

  // ------------------------------------------------
  //                 collaboration
  // ------------------------------------------------
  const sharedFilesViewProvider = new SharedFilesViewProvider();
  context.subscriptions.push(
    vscode.window.registerTreeDataProvider("sharedFilesView", sharedFilesViewProvider),
    sharedFilesViewProvider
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('svsmate.COLLAB-startServer', async () => {
      await startServer(sharedFilesViewProvider);
    }),

    vscode.commands.registerCommand('svsmate.COLLAB-stopServer', async () => {
      await stopServer(sharedFilesViewProvider);
    }),

    vscode.commands.registerCommand('svsmate.COLLAB-connectToServer', async () => {
      await connectToServer(sharedFilesViewProvider);
    }),

    vscode.commands.registerCommand('svsmate.COLLAB-disconnectFromServer', async () => {
      await disconnectFromServer(sharedFilesViewProvider);
    }),

    vscode.commands.registerCommand('svsmate.COLLAB-shareCurrentFile', async () => {
      await shareCurrentFile(sharedFilesViewProvider);
    }),

    vscode.commands.registerCommand('svsmate.COLLAB-shareFile', async (fileUri) => {
      await shareFile(sharedFilesViewProvider, fileUri);
    }),

    vscode.commands.registerCommand('svsmate.COLLAB-openSharedFile', async (item) => {
      await openSharedFile(item);
    }),

    vscode.commands.registerCommand('svsmate.COLLAB-showServerInfo', async () => {
      await showServerInfo();
    }),

    vscode.commands.registerCommand('svsmate.COLLAB-showClientInfo', async () => {
      await showClientInfo();
    }),

    vscode.commands.registerCommand('svsmate.COLLAB-discoverServers', async () => {
      await discoverServers(sharedFilesViewProvider);
    }),

    vscode.commands.registerCommand('svsmate.COLLAB-connectToDiscoveredServer', async (item) => {
      await connectToDiscoveredServer(sharedFilesViewProvider, item);
    }),

    vscode.commands.registerCommand('svsmate.COLLAB-refreshDiscoveredServers', async () => {
      await refreshDiscoveredServers(sharedFilesViewProvider);
    }),

    vscode.commands.registerCommand('svsmate.COLLAB-sendMessage', async () => {
      await sendMessage();
    }),

    vscode.commands.registerCommand('svsmate.COLLAB-showLatestMessage', async () => {
      await showLatestMessage();
    })
  );
  console.log(`After collaboration components registration: ${context.subscriptions.length} subscriptions`);

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
  //                      pdf
  // ------------------------------------------------

  context.subscriptions.push(
    vscode.commands.registerCommand("svsmate.PDF-generateFromPDF", async () => {
      try {
        const { generateCodeFromPdf } = await import('./backend/pdf/pdfCommands.js');
        await generateCodeFromPdf();
      } catch (error) {
        if (error instanceof Error) {
          vscode.window.showErrorMessage(`Failed to load PDF module: ${error.message}`);
        } else {
          vscode.window.showErrorMessage('Failed to load PDF module: Unknown error');
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

    vscode.commands.registerCommand("svsmate.TODO-addItem", async () => {
      await addItem(todoListViewProvider);
    }),

    vscode.commands.registerCommand("svsmate.TODO-editTask", async (task) => {
      await editTask(todoListViewProvider, task);
    }),

    vscode.commands.registerCommand("svsmate.TODO-deleteTask", async (item: TodoItem) => {
      await deleteTask(todoListViewProvider, item);
    }),

    vscode.commands.registerCommand("svsmate.TODO-toggleTaskCheckbox", async (item: TodoItem) => {
      await toggleTaskCheckbox(todoListViewProvider, item);
    }),

    vscode.commands.registerCommand("svsmate.TODO-sortByEndTime", async () => {
      await sortByEndTime(todoListViewProvider);
    }),

    vscode.commands.registerCommand("svsmate.TODO-sortByKinds", async () => {
      await sortByKinds(todoListViewProvider);
    }),

    vscode.commands.registerCommand('svsmate.TODO-searchTasks', async () => {
      await searchTasks(todoListViewProvider);
    }),

    vscode.commands.registerCommand('svsmate.TODO-clearSearch', async () => {
      await clearSearch(todoListViewProvider);
    }),

    vscode.commands.registerCommand('svsmate.TODO-addSubTask', async (item: TodoItem) => {
      await addSubTask(todoListViewProvider, item);
    }),

    vscode.commands.registerCommand('svsmate.TODO-generateAISubtasks', async (item: TodoItem) => {
      await addAIGeneratedSubtasks(todoListViewProvider, item);
    }),

    vscode.commands.registerCommand('svsmate.TODO-loadICSFile', async () => {
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

