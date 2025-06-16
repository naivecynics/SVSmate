import * as vscode from 'vscode';

/** DTO returned to CasClient */
export interface Credentials {
  username: string;
  password: string;
}

/**
 * Fetches credentials from VS Code SecretStorage or prompts the user once.
 * After success, optionally store to SecretStorage。
 */
export class CredentialManager {
  constructor(private readonly context: vscode.ExtensionContext) {}

  async getCredentials(): Promise<Credentials | null> {
    const storage = this.context.secrets;
    let username  = await storage.get('bb_username');
    let password  = await storage.get('bb_password');

    if (!username || !password) {
      username = await vscode.window.showInputBox({
        prompt: 'Blackboard username',
        ignoreFocusOut: true,
      });
      if (!username) {return null;}

      password = await vscode.window.showInputBox({
        prompt: 'Blackboard password',
        password: true,
        ignoreFocusOut: true,
      });
      if (!password) {return null;}

      const save = await vscode.window.showQuickPick(
        ['Yes', 'No'],
        { placeHolder: 'Save credentials in Secret Storage?' },
      );
      if (save === 'Yes') {
        await storage.store('bb_username', username);
        await storage.store('bb_password', password);
      }
    }

    return { username, password };
  }

  async clearCredentials(): Promise<void> {
     await Promise.all([
       this.context.secrets.delete('bb_username'),
       this.context.secrets.delete('bb_password'),
     ]);
  }

  /**
   * Returns current username if logged in, or `"Not logged in"` if not stored.
   */
  async getCurrentUser(): Promise<string> {
    const username = await this.context.secrets.get('bb_username');
    return username ?? 'Not logged in';
  }
}
