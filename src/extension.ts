import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { globalConfig } from './globalConfig';
import * as bb from './backend/bbCrawler';

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

	const disposable = vscode.commands.registerCommand('svsmate.helloWorld', () => {
		vscode.window.showInformationMessage('Hello World from SVSmate!');
	});

	context.subscriptions.push(disposable);

	// Blackboard crawler
	const crawlBBDisposable = vscode.commands.registerCommand('svsmate.BB-updateAll', async () => await bb.updateAll(context));
	context.subscriptions.push(crawlBBDisposable);

	const crawlBBCourseListDisposable = vscode.commands.registerCommand('svsmate.BB-updateCourseJson', async () => await bb.updateCourseJson(context));
	context.subscriptions.push(crawlBBCourseListDisposable);

	const crawlBBGetCourseDisposable = vscode.commands.registerCommand('svsmate.BB-updateOneCourse', async () => await bb.updateOneCourse(context, '25spring/Computer Vision Spring 2025'));
	context.subscriptions.push(crawlBBGetCourseDisposable);


	const crawlBBGetTermDisposable = vscode.commands.registerCommand('svsmate.BB-updateOneTerm', async () => await bb.updateOneTerm(context, '25spring'));
	context.subscriptions.push(crawlBBGetTermDisposable);


}

class stdOutputChannel {
	private output: any;
	constructor(name: string = 'SVSmate') {
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