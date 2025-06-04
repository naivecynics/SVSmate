import * as vscode from 'vscode';
import * as path from 'path';

import { log } from '../../utils/OutputChannel';
import * as PathManager from '../../utils/pathManager';
import { safeEnsureDir } from '../../utils/pathUtils';

import { CookieStore } from '../auth/CookieStore';
import { BBFetch } from '../http/BBFetch';
import { CredentialManager } from '../auth/CredentialManager';
import { CasClient } from '../auth/CasClient';
import { CourseService } from '../services/CourseService';
import { Course } from '../models/Models';

import { crawlCourse } from './crawlCourse';
import { deleteItem } from './deleteItem';

/**
 * Downloads or refreshes **every course** under a given term.
 * If no tree-item is supplied, the user is prompted for a term ID.
 *
 * @param context VS Code extension context.
 * @param item    Optional tree item representing the term folder.
 */
export async function updateTerm(
  context: vscode.ExtensionContext,
  item?: vscode.TreeItem,
): Promise<void> {
  item && deleteItem(item, false);
  const bbRoot = PathManager.getDir('bb');

  /* determine term ID */
  let termId: string;
  if (item) {
    termId = path.basename(item.resourceUri!.fsPath);
  } else {
    const input = await vscode.window.showInputBox({
      prompt: 'Term ID (e.g. 25spring)',
      validateInput: (v) => (v.trim() ? undefined : 'Term ID is required'),
    });
    if (!input) {return;}
    termId = input.trim();
  }

  /* init services */
  const cookieStore = new CookieStore(PathManager.getFile('bbCookies'));
  const fetch       = new BBFetch(cookieStore);
  const credMgr     = new CredentialManager(context);
  const casClient   = new CasClient(fetch, credMgr);
  const courseSvc   = new CourseService(fetch);

  if (!(await casClient.ensureLogin())) {
    vscode.window.showErrorMessage('Blackboard login failed.');
    return;
  }

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      cancellable: true,
    },
    async (progress, token) => {
      progress.report({ message: 'Fetching course list…' });

      const all = await courseSvc.listCourses();
      const courses: Course[] | undefined = all[termId];

      if (!courses?.length) {
        vscode.window.showErrorMessage(`No courses found for term “${termId}”.`);
        return;
      }

      const termDir = safeEnsureDir(bbRoot, termId);

      for (const course of courses) {
        if (token.isCancellationRequested) {
          log.info('updateTerm', 'Operation cancelled by user.');
          return;
        }
        await crawlCourse(context, course, termDir, progress, token);
      }

      vscode.window.showInformationMessage(`Term “${termId}” updated successfully.`);
      log.info('updateTerm', `Finished term ${termId}`);
    },
  );
}
