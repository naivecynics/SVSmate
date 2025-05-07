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
const createChatParticipantAPI_1 = require("./backend/ai/createChatParticipantAPI");
const createChatParticipant_1 = require("./backend/ai/createChatParticipant");
const updateCommands_1 = require("./backend/bb/updateCommands");
const downloadCommands_1 = require("./backend/bb/downloadCommands");
const createSubtasks_1 = require("./backend/ai/createSubtasks");
const todoCommands_1 = require("./backend/todo/todoCommands");
const FolderView_1 = require("./frontend/FolderView");
const TodoListView_1 = require("./frontend/TodoListView");
const CopilotView_1 = require("./frontend/CopilotView");
const NotesView_1 = require("./frontend/NotesView");
const BBMaterialView_1 = require("./frontend/BBMaterialView");
// import { outputChannel } from './utils/OutputChannel';
const PathManager = __importStar(require("./utils/pathManager"));
async function activate(context) {
    PathManager.initPathManager(context);
    console.log('SVSmate activated!');
    // ------------------------------------------------
    //                      file
    // ------------------------------------------------
    const folderViewProvider = FolderView_1.FolderViewProvider.create();
    folderViewProvider && vscode.window.registerTreeDataProvider("folderView", folderViewProvider);
    folderViewProvider && context.subscriptions.push(folderViewProvider);
    // ------------------------------------------------
    //                       ai
    // ------------------------------------------------
    // copilot ai chatbot @mate-API & @mate
    (0, createChatParticipantAPI_1.createChatParticipantAPI)();
    (0, createChatParticipant_1.createChatParticipant)();
    context.subscriptions.push(vscode.window.registerWebviewViewProvider("copilotView", CopilotView_1.CopilotViewProvider.create()));
    // ------------------------------------------------
    //                   blaskboard
    // ------------------------------------------------
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
    // ------------------------------------------------
    //                 collaboration
    // ------------------------------------------------
    // TODO: How? 
    // ------------------------------------------------
    //                      note
    // ------------------------------------------------
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
    // ------------------------------------------------
    //                      todo
    // ------------------------------------------------
    const todoListViewProvider = await TodoListView_1.TodoListViewProvider.create();
    vscode.window.registerTreeDataProvider("todoListView", todoListViewProvider);
    context.subscriptions.push(todoListViewProvider, vscode.commands.registerCommand("todoListView.addItem", async () => {
        await (0, todoCommands_1.addItem)(todoListViewProvider);
    }), vscode.commands.registerCommand("todoListView.editTask", async (item) => {
        await (0, todoCommands_1.editTask)(todoListViewProvider, item);
    }), vscode.commands.registerCommand("todoListView.deleteTask", async (item) => {
        await (0, todoCommands_1.deleteTask)(todoListViewProvider, item);
    }), vscode.commands.registerCommand("todoListView.toggleTaskCheckbox", async (item) => {
        await (0, todoCommands_1.toggleTaskCheckbox)(todoListViewProvider, item);
    }), vscode.commands.registerCommand("todoListView.sortByEndTime", async () => {
        await (0, todoCommands_1.sortByEndTime)(todoListViewProvider);
    }), vscode.commands.registerCommand("todoListView.sortByKinds", async () => {
        await (0, todoCommands_1.sortByKinds)(todoListViewProvider);
    }), vscode.commands.registerCommand('todoListView.searchTasks', async () => {
        await (0, todoCommands_1.searchTasks)(todoListViewProvider);
    }), vscode.commands.registerCommand('todoListView.clearSearch', async () => {
        await (0, todoCommands_1.clearSearch)(todoListViewProvider);
    }), vscode.commands.registerCommand('todoListView.addSubTask', async (item) => {
        await (0, todoCommands_1.addSubTask)(todoListViewProvider, item);
    }), vscode.commands.registerCommand('todoList.generateAISubtasks', async (item) => {
        await (0, createSubtasks_1.addAIGeneratedSubtasks)(todoListViewProvider, item);
    }), vscode.commands.registerCommand('todoListView.loadICSFile', async () => {
        await (0, todoCommands_1.loadICSFile)(todoListViewProvider);
    }));
}
function deactivate() { }
//# sourceMappingURL=extension.js.map