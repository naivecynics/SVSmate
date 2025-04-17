import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { BBMaterialItem } from '../../frontend/BBMaterialView';
import { BlackboardCrawler } from './BlackboardCrawler';
import * as PathManager from '../../utils/pathManager';
import { suggestTargetPath } from '../ai/suggestTargetPath';

export async function downloadToWorkspace(context: vscode.ExtensionContext, item: BBMaterialItem, aiSuggest: boolean = false) {
  const crawler = new BlackboardCrawler();

  if (!item || !item.resourceUri || item.collapsibleState !== vscode.TreeItemCollapsibleState.None) {
    vscode.window.showWarningMessage('This item is not downloadable.');
    return;
  }

  const fileUrl = item.resourceUri.toString();
  const fileName = item.label;
  const workspaceDir = PathManager.getWorkspaceDir();

  let targetPath: string;

  if (aiSuggest) {
    try {
      const suggestedPath = await suggestTargetPath(item);
      const absoluteSuggestedPath = path.resolve(PathManager.getWorkspaceDir(), suggestedPath);

      const userInput = await vscode.window.showInputBox({
        title: 'AI-suggested folder for saving file',
        value: absoluteSuggestedPath,
        prompt: 'You can modify the suggested path before saving'
      });

      const finalFolder = userInput?.trim() || PathManager.getWorkspaceDir();
      targetPath = path.join(finalFolder, fileName);

    } catch (err) {
      vscode.window.showErrorMessage('AI suggestion failed. Falling back to root folder.');
      targetPath = path.join(workspaceDir, fileName);
    }
  } else {
    targetPath = path.join(workspaceDir, fileName);
  }

  // Ask user if overwrite is needed
  if (fs.existsSync(targetPath)) {
    const answer = await vscode.window.showWarningMessage(
      `File "${fileName}" already exists in workspace. Overwrite?`,
      'Yes', 'No'
    );
    if (answer !== 'Yes') return;
  }

  const success = await vscode.window.withProgress({
    location: vscode.ProgressLocation.Notification,
    title: 'Downloading from Blackboard',
    cancellable: false
  }, async (progress) => {
    progress.report({ message: `Downloading: ${fileName}` });
    return crawler.downloadFile(context, fileUrl, targetPath);
  });

  if (success) {
    vscode.window.showInformationMessage(`${fileName} downloaded to workspace.`);
  } else {
    vscode.window.showErrorMessage(`Failed to download: ${fileName}`);
  }
}
