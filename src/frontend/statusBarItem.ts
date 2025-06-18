import * as vscode from 'vscode';
import { CredentialManager } from '../backend/auth/CredentialManager';

let statusBarItem: vscode.StatusBarItem;

export function initStatusBar(context: vscode.ExtensionContext) {
  const credMgr = new CredentialManager(context);
  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
  statusBarItem.command = 'svsmate.clearAccount';
  context.subscriptions.push(statusBarItem);

  updateStatusBar(credMgr);
}

export async function updateStatusBar(credMgr: CredentialManager) {
  const user = await credMgr.getCurrentUser();
  statusBarItem.text = `$(account) ${user}`;
  statusBarItem.show();
}
