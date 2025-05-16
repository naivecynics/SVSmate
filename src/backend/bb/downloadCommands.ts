import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { BBMaterialItem } from '../../frontend/BBMaterialView';
import { BlackboardCrawler } from './BlackboardCrawler';
import * as PathManager from '../../utils/pathManager';
import { suggestTargetPath } from '../ai/suggestTargetPath';

/**
 * Downloads a Blackboard file into the current workspace.
 * If enabled, AI can be used to suggest an appropriate folder for saving the file.
 * 
 * @param context - VSCode extension context for credential/session management.
 * @param item - The selected Blackboard material item to download.
 * @param aiSuggest - Whether to use AI to suggest the download path (default is false).
 */
export async function downloadToWorkspace(
    context: vscode.ExtensionContext,
    item: BBMaterialItem,
    aiSuggest: boolean = false
): Promise<void> {
    const crawler = new BlackboardCrawler();

    // Ensure the item is a file (not a folder or undefined)
    if (
        !item ||
        !item.resourceUri ||
        item.collapsibleState !== vscode.TreeItemCollapsibleState.None
    ) {
        vscode.window.showWarningMessage('This item is not downloadable.');
        return;
    }

    const fileUrl = item.resourceUri.toString();
    const fileName = item.label;
    const workspaceDir = PathManager.getWorkspaceDir();
    let targetPath: string;

    // Use AI to suggest a subfolder location if enabled
    if (aiSuggest) {
        try {
            const suggestedPath = await suggestTargetPath(item);
            const absoluteSuggestedPath = path.resolve(workspaceDir, suggestedPath);

            // Prompt the user to confirm or modify the suggested path
            const userInput = await vscode.window.showInputBox({
                title: 'AI-suggested folder for saving file',
                value: absoluteSuggestedPath,
                prompt: 'You can modify the suggested path before saving'
            });

            const finalFolder = userInput?.trim() || workspaceDir;
            targetPath = path.join(finalFolder, fileName);

        } catch (err) {
            vscode.window.showErrorMessage('AI suggestion failed. Falling back to root folder.');
            targetPath = path.join(workspaceDir, fileName);
        }
    } else {
        // Default path: save directly in the workspace root
        targetPath = path.join(workspaceDir, fileName);
    }

    // Confirm overwrite if file already exists
    if (fs.existsSync(targetPath)) {
        const answer = await vscode.window.showWarningMessage(
            `File "${fileName}" already exists in workspace. Overwrite?`,
            'Yes',
            'No'
        );
        if (answer !== 'Yes') {
            return;
        }
    }

    // Download file with progress notification
    const success = await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'Downloading from Blackboard',
        cancellable: false
    }, async (progress) => {
        progress.report({ message: `Downloading: ${fileName}` });
        return crawler.downloadFile(context, fileUrl, targetPath);
    });

    // Show result to user
    if (success) {
        vscode.window.showInformationMessage(`${fileName} downloaded to workspace.`);
    } else {
        vscode.window.showErrorMessage(`Failed to download: ${fileName}`);
    }
}
