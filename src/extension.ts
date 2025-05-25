import * as vscode from 'vscode';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { createChatParticipantAPI } from './backend/ai/createChatParticipantAPI';
import { createChatParticipant } from './backend/ai/createChatParticipant';
import { updateAll, updateCourse, updateTerm } from './backend/bb/updateCommands';
import { downloadToWorkspace } from './backend/bb/downloadCommands';

import { FolderViewProvider } from "./frontend/FolderView";
import { TodoListViewProvider } from "./frontend/TodoListView";
import { CopilotViewProvider } from "./frontend/CopilotView";
import { NotesViewProvider } from "./frontend/NotesView";
import { BBMaterialViewProvider, BBMaterialItem } from "./frontend/BBMaterialView";
import { SharedFilesViewProvider } from "./frontend/SharedFilesView";
import { CollabServer } from "./backend/collaboration/CollabServer";
import { CollabClient } from "./backend/collaboration/CollabClient";




import { outputChannel } from './utils/OutputChannel';
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
  const collabServer = new CollabServer();
  const collabClient = new CollabClient();
  const sharedFilesViewProvider = SharedFilesViewProvider.create();

  vscode.window.registerTreeDataProvider("sharedFilesView", sharedFilesViewProvider);
  context.subscriptions.push(sharedFilesViewProvider);

  // Setup event listeners for client
  collabClient.on('connected', () => {
    sharedFilesViewProvider.updateCollaborationStatus('connected');
  });

  collabClient.on('disconnected', () => {
    sharedFilesViewProvider.updateCollaborationStatus('disconnected');
    sharedFilesViewProvider.updateSharedFiles([]);
  });

  collabClient.on('fileShared', (file) => {
    sharedFilesViewProvider.addSharedFile(file);
  });

  collabClient.on('fileUnshared', (fileId) => {
    sharedFilesViewProvider.removeSharedFile(fileId);
  });

  collabClient.on('documentListUpdated', (documents) => {
    const files = documents.map((doc: any) => ({
      id: doc.id,
      name: doc.name,
      path: doc.path,
      owner: doc.owner,
      sharedAt: doc.sharedAt,
      collaborators: []
    }));
    sharedFilesViewProvider.updateSharedFiles(files);
  });

  // Setup event listeners for server
  collabServer.on('documentShared', (metadata) => {
    const file = {
      id: metadata.id,
      name: metadata.name,
      path: metadata.path,
      owner: metadata.owner,
      sharedAt: metadata.sharedAt,
      collaborators: []
    };
    sharedFilesViewProvider.addSharedFile(file);
  });

  collabServer.on('documentRemoved', (fileId) => {
    sharedFilesViewProvider.removeSharedFile(fileId);
  });

  context.subscriptions.push(
    vscode.commands.registerCommand('teamCollab.startServer', async () => {
      const success = await collabServer.startServer();
      if (success) {
        sharedFilesViewProvider.updateCollaborationStatus('hosting');
        // Load existing shared documents into view
        const documents = collabServer.getAllDocuments();
        const files = documents.map((doc: any) => ({
          id: doc.id,
          name: doc.name,
          path: doc.path,
          owner: doc.owner,
          sharedAt: doc.sharedAt,
          collaborators: []
        }));
        sharedFilesViewProvider.updateSharedFiles(files);
      }
    }),

    vscode.commands.registerCommand('teamCollab.stopServer', () => {
      collabServer.stopServer();
      sharedFilesViewProvider.updateCollaborationStatus('disconnected');
      sharedFilesViewProvider.updateSharedFiles([]);
    }),

    vscode.commands.registerCommand('teamCollab.connectToServer', async () => {
      try {
        const servers = await collabClient.discoverServers();
        if (servers.length === 0) {
          vscode.window.showInformationMessage('No collaboration servers found on the network');
          return;
        }

        const items = servers.map(server => ({
          label: server.name,
          description: `${server.ip}:${server.tcpPort} (${server.clients} clients)`,
          server: server
        }));

        const selected = await vscode.window.showQuickPick(items, {
          placeHolder: 'Select a collaboration server to connect to'
        });

        if (selected) {
          await collabClient.connectToServer(selected.server);
        }
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to discover servers: ${error}`);
      }
    }),

    vscode.commands.registerCommand('teamCollab.disconnect', () => {
      collabClient.disconnectFromServer();
    }),

    vscode.commands.registerCommand('teamCollab.shareCurrentFile', async () => {
      const activeEditor = vscode.window.activeTextEditor;
      if (!activeEditor) {
        vscode.window.showWarningMessage('No file is currently open');
        return;
      }

      const filePath = activeEditor.document.uri.fsPath;

      // Check if we're hosting a server
      if (collabServer.isServerRunning()) {
        await collabServer.shareFile(filePath);
      } else if (collabClient.isClientConnected()) {
        await collabClient.shareFile(filePath);
      } else {
        vscode.window.showWarningMessage('Not connected to a collaboration session');
      }
    }),

    vscode.commands.registerCommand('teamCollab.openSharedFile', async (file: any) => {
      try {
        // Check if we're connected to a collaboration session
        if (!collabServer.isServerRunning() && !collabClient.isClientConnected()) {
          vscode.window.showWarningMessage('Not connected to a collaboration session');
          return;
        }

        // Request the latest document state from server if we're a client
        if (collabClient.isClientConnected()) {
          await collabClient.requestDocument(file.id);
        }

        // Try to open the file if it exists locally
        let uri: vscode.Uri;
        if (fs.existsSync(file.path)) {
          uri = vscode.Uri.file(file.path);
        } else {
          // Create a temporary file with the shared content
          const tempDir = os.tmpdir();
          const tempFilePath = path.join(tempDir, `svsmate_${file.id}_${file.name}`);

          // Get content from document manager
          let content = '';
          if (collabServer.isServerRunning()) {
            content = collabServer.getDocumentContent(file.id);
          } else if (collabClient.isClientConnected()) {
            content = collabClient.getDocumentContent(file.id);
          }

          fs.writeFileSync(tempFilePath, content, 'utf-8');
          uri = vscode.Uri.file(tempFilePath);
        }

        // Open the document
        const document = await vscode.workspace.openTextDocument(uri);
        const editor = await vscode.window.showTextDocument(document);

        // Set up collaboration for this document
        if (collabServer.isServerRunning()) {
          collabServer.registerEditor(file.id, editor);
        } else if (collabClient.isClientConnected()) {
          collabClient.registerEditor(file.id, editor);
        }

        vscode.window.showInformationMessage(`Opened shared file: ${file.name}`);
      } catch (error) {
        outputChannel.error('Open Shared File Error', error instanceof Error ? error.message : String(error));
        vscode.window.showErrorMessage(`Failed to open shared file: ${error}`);
      }
    }),

    vscode.commands.registerCommand('teamCollab.unshareFile', async (item) => {
      if (item && item.id) {
        if (collabServer.isServerRunning()) {
          await collabServer.unshareFile(item.id);
        } else if (collabClient.isClientConnected()) {
          await collabClient.unshareFile(item.id);
        }
      }
    }),

    vscode.commands.registerCommand('teamCollab.refreshSharedFiles', () => {
      sharedFilesViewProvider.refresh();
    }),

    vscode.commands.registerCommand('svsmate.removeSharedFile', async (item) => {
      if (item && item.id) {
        if (collabServer.isServerRunning()) {
          await collabServer.unshareFile(item.id);
        } else if (collabClient.isClientConnected()) {
          await collabClient.unshareFile(item.id);
        }
      }
    })
  );
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

export function deactivate() {

}
