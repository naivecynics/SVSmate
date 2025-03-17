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
	const crawl_bb_disposable = vscode.commands.registerCommand('svsmate.crawlBB', crawlBB);

	context.subscriptions.push(crawl_bb_disposable);
}

export const outputChannel = vscode.window.createOutputChannel('SVSmate');

// This method is called when your extension is deactivated
export function deactivate() { }