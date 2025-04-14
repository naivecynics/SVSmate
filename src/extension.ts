import * as vscode from 'vscode';
import * as fs from 'fs';

import { organizeFiles } from './backend/ai/organizerFiles';
import { createChatParticipantAPI } from './backend/ai/createChatParticipantAPI';
import { createChatParticipant } from './backend/ai/createChatParticipant';
import { globalConfig } from './globalConfig';
import * as bb from './backend/bbCrawler';

import { FolderViewProvider } from "./folderView";
import * as path from "path";
import { TodoListViewProvider } from "./todoListView";
import { CopilotViewProvider } from "./copilotView";
import { NotesViewProvider } from "./notesView";
import { BBMaterialViewProvider, BBMaterialItem } from "./bbMaterialView";
import * as fse from 'fs-extra';
import * as bbCrawler from './backend/bbCrawler';
import { BlackboardCrawler } from './backend/bbCrawler';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

  console.log('Congratulations, your extension "svsmate" is now active!');

	// Create the config folders if they do not exist
	const configFolders = globalConfig.ConfigFolderPath;
	for (const folder of Object.keys(configFolders) as Array<keyof typeof configFolders>) {
		if (!fs.existsSync(configFolders[folder])) {
			fs.mkdirSync(configFolders[folder], { recursive: true });
		}
	}

  vscode.window.showInformationMessage('BlackboardSaveFolder: ' + configFolders.BlackboardSaveFolder);

  // hello world
  const disposable = vscode.commands.registerCommand('svsmate.helloWorld', () => {
    vscode.window.showInformationMessage('Hello World from svsmate!');
  });

  context.subscriptions.push(disposable);

  // ai organize
  const organizeDisposable = vscode.commands.registerCommand('svsmate.organizeFiles', async () => {
    const testFile = ['/Users/naivecynics/SUSTech/bb-vault/25spring/Operating_Systems_Spring_2025/Course_Materials/--Lab_7/Lab/lab7-en.pdf']
    const rootPath = '/Users/naivecynics/SUSTech/cs302-operating-systems/'
    organizeFiles(rootPath, testFile);
  });

  context.subscriptions.push(organizeDisposable);

  // copilot ai chatbot @mate-API
  createChatParticipantAPI();
  createChatParticipant();
  console.log('Your @mate & @mate-API is activated and ready to teach!');

	// Blackboard crawler
	const crawlBBDisposable = vscode.commands.registerCommand('svsmate.BB-updateAll', async () => await bb.updateAll(context));
	context.subscriptions.push(crawlBBDisposable);

	const crawlBBCourseListDisposable = vscode.commands.registerCommand('svsmate.BB-updateCourseJson', async () => await bb.updateCourseJson(context));
	context.subscriptions.push(crawlBBCourseListDisposable);

	const crawlBBGetCourseDisposable = vscode.commands.registerCommand('svsmate.BB-updateOneCourse', async () => await bb.updateOneCourse(context, '25spring/Computer Vision Spring 2025'));
	context.subscriptions.push(crawlBBGetCourseDisposable);


	const crawlbbgettermdisposable = vscode.commands.registerCommand('svsmate.bb-updateoneterm', async () => await bb.updateOneTerm(context, '25spring'));
	context.subscriptions.push(crawlbbgettermdisposable);

	const crawlbbgettermtreedisposable = vscode.commands.registerCommand('svsmate.BB-updateOneTermTree', async () => await bb.updateOneTermTree(context, '25spring'));
	context.subscriptions.push(crawlbbgettermtreedisposable);


  // ------------------------------------------------
  //                     frontend
  // ------------------------------------------------


  // const global_storage_path = context.globalStorageUri.fsPath;
  const global_storage_path = globalConfig.ConfigFolderPath.SVSMateFolder;

  // const crawled_courses_path = path.join(global_storage_path, "crawled_courses");
  const crawled_courses_path = globalConfig.ConfigFolderPath.BlackboardSaveFolder;

  if (!fs.existsSync(crawled_courses_path)) {
    fs.mkdirSync(crawled_courses_path, { recursive: true });
  }

  const notes_path = path.join(global_storage_path, "notes");

  if (!fs.existsSync(notes_path)) {
    fs.mkdirSync(notes_path, { recursive: true });
  }

  const crawled_courses_notes_path = path.join(notes_path, "crawled_courses_notes");

  if (!fs.existsSync(crawled_courses_notes_path)) {
    fs.mkdirSync(crawled_courses_notes_path, { recursive: true });
  }

  const personal_notes_path = path.join(notes_path, "personal_notes");

  if (!fs.existsSync(personal_notes_path)) {
    fs.mkdirSync(personal_notes_path, { recursive: true });
  }

  vscode.window.showInformationMessage("Global Storage Path: " + global_storage_path);
  vscode.window.showInformationMessage("Crawled Courses Path: " + crawled_courses_path);

  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders) {
    vscode.window.showWarningMessage("No workspace folder is open.");
    return;
  }

  const folderViewProvider = new FolderViewProvider(workspaceFolders[0].uri.fsPath);
  vscode.window.registerTreeDataProvider("folderView", folderViewProvider);

  // 注册视图提供者的销毁方法
  // context.subscriptions.push(folderViewProvider);

  const todoListViewProvider = new TodoListViewProvider(context);
  vscode.window.registerTreeDataProvider('todoListView', todoListViewProvider);
  todoListViewProvider.loadJsonFile();
  
  vscode.window.registerTreeDataProvider("todoListView", todoListViewProvider);

  vscode.window.registerWebviewViewProvider("copilotView", new CopilotViewProvider());

  const notesViewProvider = new NotesViewProvider(notes_path);
  vscode.window.registerTreeDataProvider("notesView", notesViewProvider);

  // const bbVaultPath = path.join(crawled_courses_path, "bb-vault");
  const bbMaterialViewProvider = new BBMaterialViewProvider(crawled_courses_path);
  vscode.window.registerTreeDataProvider("bbMaterialView", bbMaterialViewProvider);

  vscode.commands.registerCommand('bbMaterialView.refresh', () => bbMaterialViewProvider.refresh());

  vscode.commands.registerCommand('bbMaterialView.updateAll', async () => {
    try {
        await bb.updateAll(context);
        vscode.window.showInformationMessage('All materials updated successfully!');
    } catch (error) {
        if (error instanceof Error) {
            vscode.window.showErrorMessage(`Failed to update all materials: ${error.message}`);
        } else {
            vscode.window.showErrorMessage('Failed to update all materials: Unknown error');
        }
    }
  });

  vscode.commands.registerCommand('bbMaterialView.updateAllButton', async () => {
    try {
        await vscode.commands.executeCommand('bbMaterialView.updateAll');
    } catch (error) {
        if (error instanceof Error) {
            vscode.window.showErrorMessage(`Failed to execute update all: ${error.message}`);
        } else {
            vscode.window.showErrorMessage('Failed to execute update all: Unknown error');
        }
    }
  });

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

    vscode.commands.registerCommand("todoListView.loadJsonFile", async () => {
      const fileUri = await vscode.window.showOpenDialog({
        canSelectMany: false,
        openLabel: "Select JSON File",
        filters: { "JSON Files": ["json"] }
      });

      if (fileUri && fileUri[0]) {
        await todoListViewProvider.loadJsonFile();
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
      todoListViewProvider.saveJsonFile();
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

    vscode.commands.registerCommand('notesView.createNote', async (folderPath: string) => {
      await notesViewProvider.createNote(folderPath);
    }),

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
    }),

    vscode.commands.registerCommand('bbMaterialView.copyToWorkspace', async (item: BBMaterialItem) => {
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders) {
        vscode.window.showErrorMessage('No workspace folder is open!');
        return;
      }

      const sourcePath = item.resourceUri.fsPath;
      const fileName = path.basename(sourcePath);
      const targetPath = path.join(workspaceFolders[0].uri.fsPath, fileName);

      try {
        if (fs.statSync(sourcePath).isDirectory()) {
          if (fs.existsSync(targetPath)) {
            const answer = await vscode.window.showWarningMessage(
              `The target path ${fileName} already exists. Overwrite?`,
              'Yes',
              'No'
            );
            if (answer !== 'Yes') {
              return;
            }
          }
          await fse.copy(sourcePath, targetPath, { overwrite: true });
          vscode.window.showInformationMessage(`Folder ${fileName} has been copied to the workspace`);
        } else {
          if (fs.existsSync(targetPath)) {
            const answer = await vscode.window.showWarningMessage(
              `The target file ${fileName} already exists. Overwrite?`,
              'Yes',
              'No'
            );
            if (answer !== 'Yes') {
              return;
            }
          }
          await fse.copyFile(sourcePath, targetPath);
          vscode.window.showInformationMessage(`File ${fileName} has been copied to the workspace`);
        }
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to copy: ${error}`);
      }
    }),

      /**
       * AI-generated-content
       * tool: vscode-copilot
       * version: 1.98.0
       * usage: register the command to open the file in read-only mode
       */
    vscode.commands.registerCommand('bbMaterialView.setReadOnly', async (uri: vscode.Uri) => {
      const document = await vscode.workspace.openTextDocument(uri);
      if (document) {
        vscode.commands.executeCommand('workbench.action.files.setActiveEditorReadonlyInSession');
      }
    }),

    vscode.commands.registerCommand('bbMaterialView.openReadOnly', async (uri: vscode.Uri) => {
      try {
        const document = await vscode.workspace.openTextDocument(uri);
        
        await vscode.window.showTextDocument(document, {
          preview: true,
          preserveFocus: true
        });

        await vscode.commands.executeCommand('workbench.action.files.setActiveEditorReadonlyInSession');
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to open file: ${error}`);
      }
    }),

    vscode.commands.registerCommand('bbMaterialView.openPDF', async (uri: vscode.Uri) => {
      try {
        await vscode.commands.executeCommand('vscode.open', uri);
        
        await new Promise(resolve => setTimeout(resolve, 100));
        
        await vscode.commands.executeCommand('workbench.action.files.setActiveEditorReadonlyInSession');
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to open PDF: ${error}`);
      }
    }),

    vscode.commands.registerCommand('bbMaterialView.updateSemester', async (item: BBMaterialItem) => {
      try {
        const termPath = item.resourceUri.fsPath.split('/').slice(-1)[0];
        await bbCrawler.updateOneTerm(context, termPath);
        vscode.window.showInformationMessage(`Term updated successfully: ${item.label}`);
      } catch (error) {
        if (error instanceof Error) {
            vscode.window.showErrorMessage(`Failed to update term: ${error.message}`);
        } else {
            vscode.window.showErrorMessage('Failed to update term: Unknown error');
        }
      }
    }),

    vscode.commands.registerCommand('bbMaterialView.updateCourse', async (item: BBMaterialItem) => {
      try {
        const coursePath = item.resourceUri.fsPath.split('/').slice(-2).join('/');
        await bbCrawler.updateOneCourse(context, coursePath);
        vscode.window.showInformationMessage(`Course updated successfully: ${item.label}`);
      } catch (error) {
        if (error instanceof Error) {
            vscode.window.showErrorMessage(`Failed to update course: ${error.message}`);
        } else {
            vscode.window.showErrorMessage('Failed to update course: Unknown error');
        }
      }
    }),

    vscode.commands.registerCommand('bbMaterialView.updateTermTree', async (item: BBMaterialItem) => {
      try {
        const termTreePath = item.resourceUri.fsPath;
        await bbCrawler.updateOneTermTree(context, termTreePath);
        vscode.window.showInformationMessage(`Term tree updated successfully: ${item.label}`);
      } catch (error) {
        if (error instanceof Error) {
            vscode.window.showErrorMessage(`Failed to update term tree: ${error.message}`);
        } else {
            vscode.window.showErrorMessage('Failed to update term tree: Unknown error');
        }
      }
    })
  );


}

class stdOutputChannel {
	private output: any;
	constructor(name: string = 'svsmate') {
		this.output = vscode.window.createOutputChannel(name);
		this.output.show();
	}

	public async info(module: string, msg: string) {
		const timestamp = new Date().toISOString();
		const log = `[${timestamp}] [INFO] [${module}] ${msg}`;
		this.output.appendLine(log);
	}

	public async warn(module: string, msg: string) {
		const timestamp = new Date().toISOString();
		const log = `[${timestamp}] [WARN] [${module}] ${msg}`;
		this.output.appendLine(log);
	}

	public async error(module: string, msg: string) {
		const timestamp = new Date().toISOString();
		const log = `[${timestamp}] [ERROR] [${module}] ${msg}`;
		this.output.appendLine(log);
	}
}

export const outputChannel = new stdOutputChannel();

// This method is called when your extension is deactivated
export function deactivate() { }
