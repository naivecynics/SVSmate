import * as vscode from 'vscode';
import * as fs from 'fs';

import { organizeFiles } from './backend/ai/organizerFiles';
import { createChatParticipantAPI } from './backend/ai/createChatParticipantAPI';
import { createChatParticipant } from './backend/ai/createChatParticipant';
import { globalConfig } from './globalConfig';
import { crawlBB, updateCourseJson } from './backend/bbCrawler';

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

	// Advanced structured Blackboard crawler
	const crawlBBDisposable = vscode.commands.registerCommand('svsmate.crawlBB', async () => await crawlBB(context));
	context.subscriptions.push(crawlBBDisposable);

	const crawlBBCourseListDisposable = vscode.commands.registerCommand('svsmate.updateCourseJson', async () => await updateCourseJson(context));
	context.subscriptions.push(crawlBBCourseListDisposable);

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
