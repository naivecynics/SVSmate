import * as vscode from 'vscode';
import { CredentialManager } from '../auth/CredentialManager';
import { CookieStore } from '../auth/CookieStore';
import * as PathManager from '../../utils/pathManager';
import { STORE_KEY } from '../models/CalendarModels';
import { log } from '../../utils/OutputChannel';

/**
 * Clears all cached Blackboard session data, including:
 * - SecretStorage credentials
 * - Persistent cookies
 * - Stored ICS URL
 *
 * Can be used when switching accounts or troubleshooting auth errors.
 *
 * @param context VS Code extension context
 */
export async function clearAccount(context: vscode.ExtensionContext): Promise<void> {
  const credMgr = new CredentialManager(context);
  const cookieStore = new CookieStore(PathManager.getFile('bbCookies'));

  await credMgr.clearCredentials();
  await cookieStore.clear();
  await context.secrets.delete(STORE_KEY);

  log.info('clearBlackboardAccount', 'Credentials, cookies, and ICS URL cleared.');
  vscode.window.showInformationMessage('Blackboard credentials and calendar URL cleared.');
}
