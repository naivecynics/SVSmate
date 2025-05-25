"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const createChatParticipantAPI_1 = require("./backend/ai/createChatParticipantAPI");
const createChatParticipant_1 = require("./backend/ai/createChatParticipant");
const updateCommands_1 = require("./backend/bb/updateCommands");
const downloadCommands_1 = require("./backend/bb/downloadCommands");
const FolderView_1 = require("./frontend/FolderView");
const TodoListView_1 = require("./frontend/TodoListView");
const CopilotView_1 = require("./frontend/CopilotView");
const NotesView_1 = require("./frontend/NotesView");
const BBMaterialView_1 = require("./frontend/BBMaterialView");
const SharedFilesView_1 = require("./frontend/SharedFilesView");
const CollabServer_1 = require("./backend/collaboration/CollabServer");
const CollabClient_1 = require("./backend/collaboration/CollabClient");
const OutputChannel_1 = require("./utils/OutputChannel");
const PathManager = __importStar(require("./utils/pathManager"));
async function activate(context) {
    PathManager.initPathManager(context);
    console.log('SVSmate activated!');
    // region file
    const folderViewProvider = FolderView_1.FolderViewProvider.create();
    folderViewProvider && vscode.window.registerTreeDataProvider("folderView", folderViewProvider);
    folderViewProvider && context.subscriptions.push(folderViewProvider);
    // endregion
    // region ai
    // copilot ai chatbot @mate-API & @mate
    (0, createChatParticipantAPI_1.createChatParticipantAPI)();
    (0, createChatParticipant_1.createChatParticipant)();
    context.subscriptions.push(vscode.window.registerWebviewViewProvider("copilotView", CopilotView_1.CopilotViewProvider.create()));
    // endregion
    // region blackboard
    const bbMaterialViewProvider = BBMaterialView_1.BBMaterialViewProvider.create();
    vscode.window.registerTreeDataProvider("bbMaterialView", bbMaterialViewProvider);
    context.subscriptions.push(bbMaterialViewProvider, vscode.commands.registerCommand('svsmate.BB-updateAll', async () => {
        await (0, updateCommands_1.updateAll)(context);
    }), vscode.commands.registerCommand('svsmate.BB-updateTerm', async (item) => {
        await (0, updateCommands_1.updateTerm)(context, item);
    }), vscode.commands.registerCommand('svsmate.BB-updateCourse', async (item) => {
        await (0, updateCommands_1.updateCourse)(context, item);
    }), vscode.commands.registerCommand('svsmate.BB-downloadToWorkspace', async (item) => {
        await (0, downloadCommands_1.downloadToWorkspace)(context, item);
    }), vscode.commands.registerCommand('svsmate.BB-downloadToAiSpace', async (item) => {
        await (0, downloadCommands_1.downloadToWorkspace)(context, item, true);
    }));
    // endregion
    // region collaboration
    const collabServer = new CollabServer_1.CollabServer();
    const collabClient = new CollabClient_1.CollabClient();
    const sharedFilesViewProvider = SharedFilesView_1.SharedFilesViewProvider.create();
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
        const files = documents.map((doc) => ({
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
    context.subscriptions.push(vscode.commands.registerCommand('teamCollab.startServer', async () => {
        const success = await collabServer.startServer();
        if (success) {
            sharedFilesViewProvider.updateCollaborationStatus('hosting');
            // Load existing shared documents into view
            const documents = collabServer.getAllDocuments();
            const files = documents.map((doc) => ({
                id: doc.id,
                name: doc.name,
                path: doc.path,
                owner: doc.owner,
                sharedAt: doc.sharedAt,
                collaborators: []
            }));
            sharedFilesViewProvider.updateSharedFiles(files);
        }
    }), vscode.commands.registerCommand('teamCollab.stopServer', () => {
        collabServer.stopServer();
        sharedFilesViewProvider.updateCollaborationStatus('disconnected');
        sharedFilesViewProvider.updateSharedFiles([]);
    }), vscode.commands.registerCommand('teamCollab.connectToServer', async () => {
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
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to discover servers: ${error}`);
        }
    }), vscode.commands.registerCommand('teamCollab.disconnect', () => {
        collabClient.disconnectFromServer();
    }), vscode.commands.registerCommand('teamCollab.shareCurrentFile', async () => {
        const activeEditor = vscode.window.activeTextEditor;
        if (!activeEditor) {
            vscode.window.showWarningMessage('No file is currently open');
            return;
        }
        const filePath = activeEditor.document.uri.fsPath;
        // Check if we're hosting a server
        if (collabServer.isServerRunning()) {
            await collabServer.shareFile(filePath);
        }
        else if (collabClient.isClientConnected()) {
            await collabClient.shareFile(filePath);
        }
        else {
            vscode.window.showWarningMessage('Not connected to a collaboration session');
        }
    }), vscode.commands.registerCommand('teamCollab.openSharedFile', async (file) => {
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
            let uri;
            if (fs.existsSync(file.path)) {
                uri = vscode.Uri.file(file.path);
            }
            else {
                // Create a temporary file with the shared content
                const tempDir = os.tmpdir();
                const tempFilePath = path.join(tempDir, `svsmate_${file.id}_${file.name}`);
                // Get content from document manager
                let content = '';
                if (collabServer.isServerRunning()) {
                    content = collabServer.getDocumentContent(file.id);
                }
                else if (collabClient.isClientConnected()) {
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
            }
            else if (collabClient.isClientConnected()) {
                collabClient.registerEditor(file.id, editor);
            }
            vscode.window.showInformationMessage(`Opened shared file: ${file.name}`);
        }
        catch (error) {
            OutputChannel_1.outputChannel.error('Open Shared File Error', error instanceof Error ? error.message : String(error));
            vscode.window.showErrorMessage(`Failed to open shared file: ${error}`);
        }
    }), vscode.commands.registerCommand('teamCollab.unshareFile', async (item) => {
        if (item && item.id) {
            if (collabServer.isServerRunning()) {
                await collabServer.unshareFile(item.id);
            }
            else if (collabClient.isClientConnected()) {
                await collabClient.unshareFile(item.id);
            }
        }
    }), vscode.commands.registerCommand('teamCollab.refreshSharedFiles', () => {
        sharedFilesViewProvider.refresh();
    }), vscode.commands.registerCommand('svsmate.removeSharedFile', async (item) => {
        if (item && item.id) {
            if (collabServer.isServerRunning()) {
                await collabServer.unshareFile(item.id);
            }
            else if (collabClient.isClientConnected()) {
                await collabClient.unshareFile(item.id);
            }
        }
    }));
    // endregion
    // region note
    const notesViewProvider = await NotesView_1.NotesViewProvider.create();
    vscode.window.registerTreeDataProvider("notesView", notesViewProvider);
    context.subscriptions.push(notesViewProvider);
    vscode.commands.registerCommand('notesView.createNote', async (folderPath) => {
        await notesViewProvider.createNote(folderPath);
    });
    vscode.commands.registerCommand('notesView.deleteNote', async (item) => {
        try {
            const answer = await vscode.window.showWarningMessage(`Are you sure you want to delete the note "${item.label}"?`, 'Yes', 'No');
            if (answer === 'Yes') {
                await notesViewProvider.deleteNote(item.resourceUri.fsPath);
                vscode.window.showInformationMessage(`Note "${item.label}" has been deleted`);
            }
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to delete note: ${error}`);
        }
    });
    // endregion
    // region todo
    const todoListViewProvider = await TodoListView_1.TodoListViewProvider.create();
    vscode.window.registerTreeDataProvider("todoListView", todoListViewProvider);
    context.subscriptions.push(todoListViewProvider);
    // TODO: move follow commands to ./frontend/todo/todoCommands.ts
    context.subscriptions.push(vscode.commands.registerCommand("todoListView.addItem", async () => {
        const input = await vscode.window.showInputBox({ prompt: "Enter task name" });
        if (input) {
            const endDate = await vscode.window.showInputBox({ prompt: "Enter due date (format: YYYY-MM-DD)" });
            const category = await vscode.window.showInputBox({ prompt: "Enter task category" });
            if (endDate) {
                todoListViewProvider.addItem(input, endDate, category || "No Category");
            }
        }
    }), vscode.commands.registerCommand("todoListView.editTask", async (task) => {
        todoListViewProvider.editTask(task);
    }), vscode.commands.registerCommand("todoListView.deleteTask", (task) => {
        todoListViewProvider.deleteTask(task);
    }), vscode.commands.registerCommand("todoListView.toggleTaskCheckbox", (task) => {
        task.checked = !task.checked;
        todoListViewProvider._onDidChangeTreeData.fire(undefined);
        // todoListViewProvider.slackboardCrawleraveJsonFile();
    }), vscode.commands.registerCommand("todoListView.sortByEndTime", () => {
        todoListViewProvider.sortBy("endTime");
    }), vscode.commands.registerCommand("todoListView.sortByKinds", () => {
        todoListViewProvider.sortBy("category");
    }), vscode.commands.registerCommand('todoListView.searchTasks', async () => {
        const searchTerm = await vscode.window.showInputBox({
            prompt: 'Enter task name (supports fuzzy search)',
            placeHolder: 'e.g., Develop feature'
        });
        if (searchTerm !== undefined) {
            todoListViewProvider.setSearchTerm(searchTerm);
        }
    }), vscode.commands.registerCommand('todoListView.clearSearch', () => {
        todoListViewProvider.clearSearch();
    }));
    // endregion
}
function deactivate() {
}
//# sourceMappingURL=extension.js.map