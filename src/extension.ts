import * as vscode from 'vscode';
import { BlackboardCrawler, crawlBB } from './backend/bbCrawler';
import { createChatParticipant } from './backend/chatBot';
// import * as path from 'path';
// import * as os from 'os';
// import * as fs from 'fs';

export const outputChannel = vscode.window.createOutputChannel('SVSmate');

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

  console.log('Congratulations, your extension "svsmate" is now active!');

  // hello world
  const disposable = vscode.commands.registerCommand('svsmate.helloWorld', () => {
    vscode.window.showInformationMessage('Hello World from SVSmate!');
  });

  context.subscriptions.push(disposable);

  // copilot ai chatbot
  const mateParticipant = createChatParticipant('sk-e1b4d83eed4740468b33c94a0abe4559');
	mateParticipant.iconPath = vscode.Uri.joinPath(context.extensionUri, 'tutor.jpeg');

  console.log('Your ChatBot is activated and ready to teach!');

  // Advanced structured Blackboard crawler
  const crawl_bb_disposable = vscode.commands.registerCommand('svsmate.crawlBB', crawlBB);

  context.subscriptions.push(crawl_bb_disposable);

}

// This method is called when your extension is deactivated
export function deactivate() { }
