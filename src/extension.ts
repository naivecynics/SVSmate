import * as vscode from 'vscode';
import { BlackboardCrawler, crawlBB } from './backend/bbCrawler';
import { organizeFiles } from './backend/ai/organizerFiles';
import { createChatParticipantAPI } from './backend/ai/createChatParticipantAPI';
import { createChatParticipant } from './backend/ai/createChatParticipant';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

  console.log('Congratulations, your extension "SVSmate" is now active!');

  // hello world
  const disposable = vscode.commands.registerCommand('SVSmate.helloWorld', () => {
    vscode.window.showInformationMessage('Hello World from SVSmate!');
  });

  context.subscriptions.push(disposable);

  // ai organize
  const organizeDisposable = vscode.commands.registerCommand('SVSmate.organizeFiles', async () => {
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
  const crawl_bb_disposable = vscode.commands.registerCommand('SVSmate.crawlBB', crawlBB);

  context.subscriptions.push(crawl_bb_disposable);

}

// This method is called when your extension is deactivated
export function deactivate() { }
