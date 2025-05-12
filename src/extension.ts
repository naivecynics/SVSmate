import * as vscode from 'vscode';
import { createChatParticipantAPI } from './backend/ai/createChatParticipantAPI';
import { createChatParticipant } from './backend/ai/createChatParticipant';
import { updateAll, updateCourse, updateTerm } from './backend/bb/updateCommands';
import { downloadToWorkspace } from './backend/bb/downloadCommands';

import { FolderViewProvider } from "./frontend/FolderView";
import { TodoListViewProvider } from "./frontend/TodoListView";
import { CopilotViewProvider } from "./frontend/CopilotView";
import { NotesViewProvider } from "./frontend/NotesView";
import { BBMaterialViewProvider, BBMaterialItem } from "./frontend/BBMaterialView";

import { ConnectionManager } from './backend/collaboration/ConnectionManager';
import { FirewallManager } from './backend/collaboration/FireWallManager';
import { SharedFilesProvider } from './frontend/SharedFilesProvider';

// import { outputChannel } from './utils/OutputChannel';
import * as PathManager from './utils/pathManager';


export async function activate(context: vscode.ExtensionContext) {

  PathManager.initPathManager(context);

  console.log('SVSmate activated!');

  // region file
  const folderViewProvider = FolderViewProvider.create();
  folderViewProvider && vscode.window.registerTreeDataProvider("folderView", folderViewProvider);
  folderViewProvider && context.subscriptions.push(folderViewProvider);
  // endregion

  // region ai
  // copilot ai chatbot @mate-API & @mate
  createChatParticipantAPI();
  createChatParticipant();


  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider("copilotView", CopilotViewProvider.create())
  );
  // endregion

  // region blackboard
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

    // TODO: Add a init update one term commmand on view/title
  );
  // endregion

  // region collaboration

  const manager = new ConnectionManager();

  // Register SharedFilesProvider
  const sharedFilesProvider = SharedFilesProvider.create(manager);
  const sharedFilesView = vscode.window.registerTreeDataProvider('sharedFilesView', sharedFilesProvider);

  // Register drop functionality for shared files view 
  const registerDropProvider = vscode.window.createTreeView('sharedFilesView', {
    treeDataProvider: sharedFilesProvider,
    dragAndDropController: {
      dropMimeTypes: ['text/uri-list'],
      dragMimeTypes: [], // Add dragMimeTypes array (empty since we don't need drag functionality)
      handleDrop: async (target: any, dataTransfer: vscode.DataTransfer) => {
        await sharedFilesProvider.handleDrop(dataTransfer);
        // Don't return a value, just let it return void
      }
    }
  });

  context.subscriptions.push(registerDropProvider);

  // Register commands for shared files
  context.subscriptions.push(
    vscode.commands.registerCommand('svsmate.removeSharedFile', (filePath: string) => {
      sharedFilesProvider.removeFile(filePath);
    })
  );

  FirewallManager.autoConfigure().catch(console.error);

  // 状态栏显示IP
  const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right);
  statusBar.text = `Local IP: ${manager.getLocalIp()}`;
  statusBar.show();

  // 注册命令
  context.subscriptions.push(
    vscode.commands.registerCommand('svsmate.startServer', () => {
      manager.startTcpServer();
      manager.startUdpServer();
    }),

    vscode.commands.registerCommand('svsmate.connect', async () => {
      const ip = await vscode.window.showInputBox({ prompt: 'Enter target IP' });
      if (ip) { manager.connectToServer(ip); }
    }),

    vscode.commands.registerCommand('svsmate.sendMessage', async () => {
      const message = await vscode.window.showInputBox({ prompt: 'Enter message' });
      if (message) { manager.sendMessage(message); }
    }),

    vscode.commands.registerCommand('svsmate.disconnect', () => manager.disconnect())
  );

  // 自动发送光标位置
  context.subscriptions.push(
    vscode.window.onDidChangeTextEditorSelection(e => {
      if (e.textEditor && e.selections.length > 0) {
        manager.sendCursorPosition(e.selections[0].active, e.textEditor.document.uri.fsPath);
      }
    })
  );

  // Connect shared files provider to connection manager
  manager.setSharedFilesProvider(sharedFilesProvider);

  // endregion

  // region note
  const notesViewProvider = await NotesViewProvider.create();
  vscode.window.registerTreeDataProvider("notesView", notesViewProvider);
  context.subscriptions.push(notesViewProvider);

  vscode.commands.registerCommand('notesView.createNote', async (folderPath: string) => {
    await notesViewProvider.createNote(folderPath);
  });

  vscode.commands.registerCommand('notesView.deleteNote', async (item: any) => {
    try {
      const answer = await vscode.window.showWarningMessage(
        `Are you sure you want to delete the note "${item.label}"?`,
        'Yes',
        'No'
      );

      if (answer === 'Yes') {
        await notesViewProvider.deleteNote(item.resourceUri.fsPath);
        vscode.window.showInformationMessage(`Note "${item.label}" has been deleted`);
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to delete note: ${error}`);
    }
  });
  // endregion

  // region todo
  const todoListViewProvider = await TodoListViewProvider.create();
  vscode.window.registerTreeDataProvider("todoListView", todoListViewProvider);
  context.subscriptions.push(todoListViewProvider);

  // TODO: move follow commands to ./frontend/todo/todoCommands.ts

  context.subscriptions.push(
    vscode.commands.registerCommand("todoListView.addItem", async () => {
      const input = await vscode.window.showInputBox({ prompt: "Enter task name" });
      if (input) {
        const endDate = await vscode.window.showInputBox({ prompt: "Enter due date (format: YYYY-MM-DD)" });
        const category = await vscode.window.showInputBox({ prompt: "Enter task category" });

        if (endDate) {
          todoListViewProvider.addItem(input, endDate, category || "No Category");
        }
      }
    }),

    vscode.commands.registerCommand("todoListView.editTask", async (task) => {
      todoListViewProvider.editTask(task);
    }),
    vscode.commands.registerCommand("todoListView.deleteTask", (task) => {
      todoListViewProvider.deleteTask(task);
    }),

    vscode.commands.registerCommand("todoListView.toggleTaskCheckbox", (task) => {
      task.checked = !task.checked;
      todoListViewProvider._onDidChangeTreeData.fire(undefined);
      // todoListViewProvider.slackboardCrawleraveJsonFile();
    }),

    vscode.commands.registerCommand("todoListView.sortByEndTime", () => {
      todoListViewProvider.sortBy("endTime");
    }),

    vscode.commands.registerCommand("todoListView.sortByKinds", () => {
      todoListViewProvider.sortBy("category");
    }),

    vscode.commands.registerCommand('todoListView.searchTasks', async () => {
      const searchTerm = await vscode.window.showInputBox({
        prompt: 'Enter task name (supports fuzzy search)',
        placeHolder: 'e.g., Develop feature'
      });
      if (searchTerm !== undefined) {
        todoListViewProvider.setSearchTerm(searchTerm);
      }
    }),
    vscode.commands.registerCommand('todoListView.clearSearch', () => {
      todoListViewProvider.clearSearch();
    }),
  );
  // endregion
}

export function deactivate() { }
