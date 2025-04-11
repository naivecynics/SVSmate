import * as vscode from 'vscode';
import { BlackboardCrawler, crawlBB } from './backend/bbCrawler';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	console.log('Congratulations, your extension "svsmate" is now active!');

	const disposable = vscode.commands.registerCommand('svsmate.helloWorld', () => {
		vscode.window.showInformationMessage('Hello World from SVSmate!');
	});

	context.subscriptions.push(disposable);

	// Advanced structured Blackboard crawler
	const crawl_bb_disposable = vscode.commands.registerCommand('svsmate.crawlBB', async () => await crawlBB(context));

	context.subscriptions.push(crawl_bb_disposable);
}

class outputChannel {
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

export const outputChannel1 = new outputChannel();


// This method is called when your extension is deactivated
export function deactivate() { }