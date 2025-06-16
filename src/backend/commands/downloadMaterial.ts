import * as vscode from 'vscode';
import * as path from 'path';

import { BBMaterialItem } from '../../frontend/BBMaterialView';
import { log } from '../../utils/OutputChannel';
import * as PathManager from '../../utils/pathManager';
import { safeEnsureDir } from '../../utils/pathUtils';

import { CookieStore } from '../auth/CookieStore';
import { BBFetch } from '../http/BBFetch';
import { CredentialManager } from '../auth/CredentialManager';
import { CasClient } from '../auth/CasClient';
import { DownloadService } from '../services/DownloadService';

/**
 * Downloads **one** file from Blackboard into the user’s workspace.
 *
 * Flow ：
 * 1. Validate the tree item is a file.  
 * 2. Ask user “where to save” via {@link vscode.window.showSaveDialog}, 
 *    or to workspace directly.
 * 3. Ensure Blackboard session (CredentialManager + CasClient).  
 * 4. Stream the file to disk with progress UI.  
 * 5. Notify success / failure.
 *
 * @param context VS Code extension context.
 * @param item Blackboard tree item representing a file.
 * @param saveDirectlyToWorkspace If true, skips the save dialog.
 */
export async function downloadMaterial(
  context: vscode.ExtensionContext,
  item: BBMaterialItem,
  saveDirectlyToWorkspace = false,
): Promise<void> {
  /* ── sanity check ─────────────────────────────────────────── */
  if (
    !item ||
    !item.resourceUri ||
    item.collapsibleState !== vscode.TreeItemCollapsibleState.None
  ) {
    vscode.window.showWarningMessage('Please select a single file.');
    return;
  }

  const fileUrl  = item.fileUrl;
  const fileName = item.label;
  let savePath: string;

  if (saveDirectlyToWorkspace) {
    /* ── directly save to workspace ─── */
    try {
      const workspaceDir = PathManager.getWorkspaceDir();
      savePath = path.join(workspaceDir, fileName as string);
      safeEnsureDir(path.dirname(savePath));
    } catch (err) {
      vscode.window.showErrorMessage('No workspace folder is open.');
      return;
    }
  } else {
    /* ── let user pick destination (default = workspace root) ─── */
    const defaultDir = PathManager.getWorkspaceDir();
    const defaultUri = vscode.Uri.file(path.join(defaultDir, fileName as string));

    const targetUri = await vscode.window.showSaveDialog({
      defaultUri,
      saveLabel: 'Download from BB',
    });

    if (!targetUri) {return;} // user cancelled
    savePath = targetUri.fsPath;
    safeEnsureDir(path.dirname(savePath));
  }

  /* ── spin up backend helpers ──────────────────────────────── */
  const cookieStore = new CookieStore(PathManager.getFile('bbCookies'));
  const fetch       = new BBFetch(cookieStore);
  const credMgr     = new CredentialManager(context);
  const casClient   = new CasClient(fetch, credMgr);
  const dlSvc       = new DownloadService(fetch);

  /* ── authenticate once ────────────────────────────────────── */
  if (!(await casClient.ensureLogin())) {
    vscode.window.showErrorMessage('Blackboard login failed – aborting.');
    return;
  }

  /* ── download with progress bar ───────────────────────────── */
  const ok = await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: 'Blackboard Download',
      cancellable: false,
    },
    async (progress) => {
      progress.report({ message: `Downloading ${fileName}…` });
      return dlSvc.download(fileUrl as string, savePath);
    },
  );

  /* ── notify user ──────────────────────────────────────────── */
  if (ok) {
    vscode.window.showInformationMessage(`Download Successful: ${fileName} → ${savePath}`);
    log.info('downloadItem', `Downloaded: ${fileUrl} → ${savePath}`);
  } else {
    vscode.window.showErrorMessage(`Failed to download “${fileName}”.`);
    log.error('downloadItem', `Download failed: ${fileUrl}`);
  }
}
