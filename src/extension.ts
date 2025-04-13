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


  const global_storage_path = context.globalStorageUri.fsPath;

  const crawled_courses_path = path.join(global_storage_path, "crawled_courses");

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

  vscode.window.showInformationMessage("global_storage_path: " + global_storage_path);
  vscode.window.showInformationMessage("crawled_courses_path: " + crawled_courses_path);
  // vscode.window.showInformationMessage("crawled_courses_notes_path: " + crawled_courses_notes_path);
  // vscode.window.showInformationMessage("personal_notes_path: " + personal_notes_path);
  // vscode.window.showInformationMessage("tasks_path: " + tasks_path);

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

  const bbVaultPath = path.join(crawled_courses_path, "bb-vault");
  const bbMaterialViewProvider = new BBMaterialViewProvider(bbVaultPath);
  vscode.window.registerTreeDataProvider("bbMaterialView", bbMaterialViewProvider);

  // // 直接加载本地 `tasks.json` 文件
  // const localJsonPath = path.join(workspaceFolders[0].uri.fsPath, "tasks.json");
  // todoListViewProvider.loadJsonFile();

  context.subscriptions.push(
    vscode.commands.registerCommand("todoListView.addItem", async () => {
      const input = await vscode.window.showInputBox({ prompt: "输入任务名称" });
      if (input) {
        const endDate = await vscode.window.showInputBox({ prompt: "输入截止日期 (格式: YYYY-MM-DD)" });
        const category = await vscode.window.showInputBox({ prompt: "输入任务分类" });

        if (endDate) {
          todoListViewProvider.addItem(input, endDate, category || "无分类");
        }
      }
    }),

    vscode.commands.registerCommand("todoListView.loadJsonFile", async () => {
      const fileUri = await vscode.window.showOpenDialog({
        canSelectMany: false,
        openLabel: "选择 JSON 文件",
        filters: { "JSON 文件": ["json"] }
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
        prompt: '输入任务名称（支持模糊搜索）',
        placeHolder: '例如：开发功能'
      });
      if (searchTerm !== undefined) {
        // provider.setSearchTerm(searchTerm);
        todoListViewProvider.setSearchTerm(searchTerm);
      }
    }),
    // 注册清除命令
    vscode.commands.registerCommand('todoListView.clearSearch', () => {
      todoListViewProvider.clearSearch();
    }),

    vscode.commands.registerCommand('notesView.createNote', async (folderPath: string) => {
      await notesViewProvider.createNote(folderPath);
    }),

    // 添加删除笔记命令
    vscode.commands.registerCommand('notesView.deleteNote', async (item: any) => {
      try {
        const answer = await vscode.window.showWarningMessage(
          `确定要删除笔记 "${item.label}" 吗？`,
          '是',
          '否'
        );
        
        if (answer === '是') {
          await notesViewProvider.deleteNote(item.resourceUri.fsPath);
          vscode.window.showInformationMessage(`笔记 "${item.label}" 已删除`);
        }
      } catch (error) {
        vscode.window.showErrorMessage(`删除笔记失败: ${error}`);
      }
    }),

    vscode.commands.registerCommand('bbMaterialView.copyToWorkspace', async (item: BBMaterialItem) => {
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders) {
        vscode.window.showErrorMessage('没有打开的工作区！');
        return;
      }

      const sourcePath = item.resourceUri.fsPath;
      const fileName = path.basename(sourcePath);
      const targetPath = path.join(workspaceFolders[0].uri.fsPath, fileName);

      try {
        if (fs.statSync(sourcePath).isDirectory()) {
          // 如果是文件夹，先检查目标路径是否存在
          if (fs.existsSync(targetPath)) {
            const answer = await vscode.window.showWarningMessage(
              `目标路径 ${fileName} 已存在，是否覆盖？`,
              '是',
              '否'
            );
            if (answer !== '是') {
              return;
            }
          }
          // 使用fs-extra复制整个目录
          await fse.copy(sourcePath, targetPath, { overwrite: true });
          vscode.window.showInformationMessage(`文件夹 ${fileName} 已复制到工作区`);
        } else {
          // 如果是文件，先检查目标路径是否存在
          if (fs.existsSync(targetPath)) {
            const answer = await vscode.window.showWarningMessage(
              `目标文件 ${fileName} 已存在，是否覆盖？`,
              '是',
              '否'
            );
            if (answer !== '是') {
              return;
            }
          }
          // 使用fs-extra复制文件
          await fse.copyFile(sourcePath, targetPath);
          vscode.window.showInformationMessage(`文件 ${fileName} 已复制到工作区`);
        }
      } catch (error) {
        vscode.window.showErrorMessage(`复制失败: ${error}`);
      }
    }),

    // 添加设置文件只读状态的命令
    vscode.commands.registerCommand('bbMaterialView.setReadOnly', async (uri: vscode.Uri) => {
      const document = await vscode.workspace.openTextDocument(uri);
      if (document) {
        // 设置文档为只读
        vscode.commands.executeCommand('workbench.action.files.setActiveEditorReadonlyInSession');
      }
    }),

    vscode.commands.registerCommand('bbMaterialView.openReadOnly', async (uri: vscode.Uri) => {
      try {
        // 打开文档
        const document = await vscode.workspace.openTextDocument(uri);
        
        // 显示文档
        await vscode.window.showTextDocument(document, {
          preview: true,
          preserveFocus: true
        });

        // 设置文档为只读
        await vscode.commands.executeCommand('workbench.action.files.setActiveEditorReadonlyInSession');
      } catch (error) {
        vscode.window.showErrorMessage(`打开文件失败: ${error}`);
      }
    }),

    vscode.commands.registerCommand('bbMaterialView.openPDF', async (uri: vscode.Uri) => {
      try {
        // 使用vscode.open命令打开PDF
        await vscode.commands.executeCommand('vscode.open', uri);
        
        // 等待文档打开
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // 设置文档为只读
        await vscode.commands.executeCommand('workbench.action.files.setActiveEditorReadonlyInSession');
      } catch (error) {
        vscode.window.showErrorMessage(`打开PDF失败: ${error}`);
      }
    }),

    // 更新学期命令
    vscode.commands.registerCommand('bbMaterialView.updateSemester', async (item: BBMaterialItem) => {
      try {
        // TODO: 实现更新学期的逻辑
        vscode.window.showInformationMessage(`正在更新学期: ${item.label}...`);
      } catch (error) {
        vscode.window.showErrorMessage(`更新学期失败: ${error}`);
      }
    }),

    // 更新课程命令
    vscode.commands.registerCommand('bbMaterialView.updateCourse', async (item: BBMaterialItem) => {
      try {
        // TODO: 实现更新课程的逻辑
        vscode.window.showInformationMessage(`正在更新课程: ${item.label}...`);
      } catch (error) {
        vscode.window.showErrorMessage(`更新课程失败: ${error}`);
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
