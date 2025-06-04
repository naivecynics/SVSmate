import * as vscode from 'vscode';
import * as path from 'path';

import { log } from '../../utils/OutputChannel';
import * as PathManager from '../../utils/pathManager';
import { safeEnsureDir, safe } from '../../utils/pathUtils';

import { CookieStore } from '../auth/CookieStore';
import { BBFetch } from '../http/BBFetch';
import { CredentialManager } from '../auth/CredentialManager';
import { CasClient } from '../auth/CasClient';
import { CourseService } from '../services/CourseService';
import { Course } from '../models/Models';

import { crawlCourse } from './crawlCourse';
import { deleteItem } from './deleteItem';
import { BBMaterialItem } from '../../frontend/BBMaterialView';


/**
 * Refreshes **one** local course folder by re-downloading every page
 * and attachment from Blackboard.
 *
 * @param context VS Code extension context.
 * @param item    Tree-view item pointing to the local course folder.
 */
export async function updateCourse(
  context: vscode.ExtensionContext,
  item: BBMaterialItem,
): Promise<void> {
  deleteItem(item, false);

  const bbRoot     = PathManager.getDir('bb');
  const courseName = path.basename(item.resourceUri!.fsPath);
  const termId = path.basename(path.dirname(item.resourceUri!.fsPath));

  /* ── init services ────────────────────────────────────────── */
  const cookieStore = new CookieStore(PathManager.getFile('bbCookies'));
  const fetch       = new BBFetch(cookieStore);
  const credMgr     = new CredentialManager(context);
  const casClient   = new CasClient(fetch, credMgr);
  const courseSvc   = new CourseService(fetch);

  /* ── login ────────────────────────────────────────────────── */
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
      progress.report({ message: 'Fetching online course list…' });

      /* locate the matching online course */
      const all = await courseSvc.listCourses();
      const course: Course | undefined =
        all[termId]?.find((c) => safe(c.name) === courseName);

      if (!course) {
        vscode.window.showErrorMessage(`Course “${courseName}” not found online.`);
        return; 
      }

      const termDir = safeEnsureDir(bbRoot, termId);
      await crawlCourse(context, course, termDir, progress, token);

      vscode.window.showInformationMessage(`Course “${courseName}” updated successfully.`);
      log.info('updateCourse', `Finished updating ${courseName}`);
    },
  );
}
