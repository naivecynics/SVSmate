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
import { CollabServer } from "./backend/collaboration/CollabServer";
import { CollabClient } from "./backend/collaboration/CollabClient";

import { outputChannel } from './utils/OutputChannel';
import * as PathManager from './utils/pathManager';


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

  // TODO: How? 


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

  collabServer.on('clientJoined', (clientInfo) => {
    const clientCount = collabServer.getConnectedClients().length;
    outputChannel.info('Client Status Update',
      `${clientInfo.name} joined. Total clients: ${clientCount}`);
  });

  collabServer.on('clientLeft', (clientInfo) => {
    const clientCount = collabServer.getConnectedClients().length;
    outputChannel.info('Client Status Update',
      `${clientInfo.name} left. Total clients: ${clientCount}`);
  });

  context.subscriptions.push(
    vscode.commands.registerCommand('svsmate.startServer', async () => {
      // Don't start if already connected as client
      if (collabClient.isClientConnected()) {
        vscode.window.showWarningMessage('Disconnect from current session before starting a server');
        return;
      }

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

    vscode.commands.registerCommand('svsmate.stopServer', () => {
      if (!collabServer.isServerRunning()) {
        vscode.window.showInformationMessage('Server is not running');
        return;
      }

      collabServer.stopServer();
      sharedFilesViewProvider.updateCollaborationStatus('disconnected');
      sharedFilesViewProvider.updateSharedFiles([]);
    }),

    vscode.commands.registerCommand('svsmate.connectToServer', async () => {
      // Don't connect if already hosting
      if (collabServer.isServerRunning()) {
        vscode.window.showWarningMessage('Stop hosting server before connecting to another session');
        return;
      }

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

    vscode.commands.registerCommand('svsmate.disconnect', () => {
      if (!collabClient.isClientConnected()) {
        vscode.window.showInformationMessage('Not connected to any server');
        return;
      }

      collabClient.disconnectFromServer();
    }),

    vscode.commands.registerCommand('svsmate.shareCurrentFile', async () => {
      const activeEditor = vscode.window.activeTextEditor;
      if (!activeEditor) {
        vscode.window.showWarningMessage('No file is currently open');
        return;
      }

      const filePath = activeEditor.document.uri.fsPath;

      // Only server can share files
      if (collabServer.isServerRunning()) {
        await collabServer.shareFile(filePath);
      } else {
        vscode.window.showWarningMessage('Only the server host can share files. Start a server first or ask the server host to share files.');
      }
    }),

    vscode.commands.registerCommand('svsmate.openSharedFile', async (file: any) => {
      try {
        // Check if we're connected to a collaboration session
        if (!collabServer.isServerRunning() && !collabClient.isClientConnected()) {
          vscode.window.showWarningMessage('Not connected to a collaboration session');
          return;
        }

        let content = '';
        let isOwned = false;

        if (collabServer.isServerRunning()) {
          // Server side - get document content
          content = collabServer.getDocumentContent(file.id);
          isOwned = true; // Server always owns all shared documents
        } else if (collabClient.isClientConnected()) {
          // Client side - get document content (should already be loaded)
          content = collabClient.getDocumentContent(file.id);
          isOwned = false; // Clients never own documents

          // If no content, request it from server
          if (!content) {
            await collabClient.requestDocument(file.id);
            // Wait a bit for response
            await new Promise(resolve => setTimeout(resolve, 500));
            content = collabClient.getDocumentContent(file.id);
          }
        }

        // Create temporary file for editing
        const tempDir = os.tmpdir();
        const tempFilePath = path.join(tempDir, `svsmate_collab_${file.id}_${file.name}`);

        // Write content to temp file
        fs.writeFileSync(tempFilePath, content, 'utf-8');
        const uri = vscode.Uri.file(tempFilePath);

        // Open the document
        const document = await vscode.workspace.openTextDocument(uri);
        const editor = await vscode.window.showTextDocument(document);

        // Register editor with document manager
        if (collabServer.isServerRunning()) {
          collabServer.registerEditor(file.id, editor);
        } else if (collabClient.isClientConnected()) {
          collabClient.registerEditor(file.id, editor);
        }

        // Set up real-time document change listener
        const changeListener = vscode.workspace.onDidChangeTextDocument((event) => {
          if (event.document.uri.fsPath === tempFilePath) {
            event.contentChanges.forEach(change => {
              if (collabServer.isServerRunning()) {
                collabServer.applyEditorChange(file.id, change);
              } else if (collabClient.isClientConnected()) {
                collabClient.applyEditorChange(file.id, change);
              }
            });
          }
        });

        context.subscriptions.push(changeListener);

        const ownershipText = isOwned ? '(Server file)' : '(Read/Write access)';
        vscode.window.showInformationMessage(
          `Opened shared file: ${file.name} ${ownershipText} - ${content.length} characters`
        );
      } catch (error) {
        outputChannel.error('Open Shared File Error', error instanceof Error ? error.message : String(error));
        vscode.window.showErrorMessage(`Failed to open shared file: ${error}`);
      }
    }),

    vscode.commands.registerCommand('svsmate.unshareFile', async (item) => {
      if (item && item.id) {
        if (collabServer.isServerRunning()) {
          await collabServer.unshareFile(item.id);
        } else if (collabClient.isClientConnected()) {
          await collabClient.unshareFile(item.id);
        }
      }
    }),

    vscode.commands.registerCommand('svsmate.refreshSharedFiles', () => {
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

