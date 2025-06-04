import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';
import { BBMaterialItem } from '../../frontend/BBMaterialView';
import { log } from '../../utils/OutputChannel';

/**
 * Recursively deletes a directory or its contents.
 * Registered as `svsmate.BB-deleteItem`.
 *
 * @param item        The selected tree item (term/course folder).
 * @param deleteSelf  Whether to delete the folder itself (default: true).
 */
export async function deleteItem(item: BBMaterialItem, deleteSelf: boolean = true): Promise<void> {
  if (!item.realPath) {
    vscode.window.showWarningMessage('This item has no valid path.');
    return;
  }

  const label = item.label;

  try {
    if (deleteSelf) {
      await fs.rm(item.realPath, { recursive: true, force: true });
      log.info('deleteItem', `Deleted: ${item.realPath}`);
    } else {
      const entries = await fs.readdir(item.realPath);
      for (const name of entries) {
        const full = path.join(item.realPath, name);
        await fs.rm(full, { recursive: true, force: true });
      }
      log.info('deleteItem', `Cleared contents of: ${item.realPath}`);
    }

    deleteSelf && vscode.window.showInformationMessage(`Deleted: ${label}`);
  } catch (err) {
    log.error('deleteItem', `Failed to delete: ${err}`);
    vscode.window.showErrorMessage(`Failed to delete ${label}: ${err}`);
  }
}
