import * as vscode from 'vscode';
import * as path from 'path';
import { writeFile } from 'fs/promises';

import { log } from '../../utils/OutputChannel';
import { safeEnsureDir, safe } from '../../utils/pathUtils';
import * as PathManager from '../../utils/pathManager';

import { CookieStore } from '../auth/CookieStore';
import { BBFetch } from '../http/BBFetch';
import { CredentialManager } from '../auth/CredentialManager';
import { CasClient } from '../auth/CasClient';
import { CourseService } from '../services/CourseService';
import { Course, Sidebar, PageContent } from '../models/Models';

/**
 * Crawls **one** Blackboard course:  
 * – Visits each sidebar page  
 * – Saves its structure as JSON  
 * – Downloads all attachments
 *
 * @param context   VS Code extension context (used for secret storage).
 * @param course    Target course returned by {@link CourseService.listCourses}.
 * @param termDir   Absolute path to the local term folder.
 * @param progress  VS Code progress reporter.
 * @param token     Cancellation token (user-driven).
 */
export async function crawlCourse(
  context: vscode.ExtensionContext,
  course: Course,
  termDir: string,
  progress: vscode.Progress<{ message?: string; increment?: number }>,
  token: vscode.CancellationToken,
): Promise<void> {
  /* ── bootstrap backend services ───────────────────────────── */
  const cookieStore = new CookieStore(PathManager.getFile('bbCookies'));
  const fetch       = new BBFetch(cookieStore);
  const credMgr     = new CredentialManager(context);
  const casClient   = new CasClient(fetch, credMgr);
  const courseSvc   = new CourseService(fetch);

  /* ── authenticate once per command invocation ─────────────── */
  if (!(await casClient.ensureLogin())) {
    vscode.window.showErrorMessage('Blackboard login failed – aborting.');
    return;
  }

  /* ── retrieve sidebar structure ───────────────────────────── */
  const sidebar = await courseSvc.getSidebar(course.url);
  if (!Object.keys(sidebar).length) {
    log.warn('crawlCourse', `Sidebar not found for course “${course.name}”.`);
    return;
  }

  const courseDir = safeEnsureDir(termDir, course.name);

  /* ── iterate pages and download content ───────────────────── */
  for (const [category, links] of Object.entries(sidebar) as [string, Sidebar[keyof Sidebar]][]) {
    if (token.isCancellationRequested) {return;}

    progress.report({ message: `${course.name} › ${category}` });
    const categoryDir = safeEnsureDir(courseDir, category);

    for (const link of links) {
      if (token.isCancellationRequested) {return;}

      progress.report({ message: `${course.name} › ${category} › ${link.title}` });

      /* fetch and parse page */
      let page: PageContent;
      try {
        page = await courseSvc.getPage(link.url);
      } catch (err) {
        log.error('crawlCourse', `Failed to fetch “${link.title}”: ${err}`);
        continue;
      }
      if (!Object.keys(page).length) {continue;}

      const pageDir = safeEnsureDir(categoryDir, link.title);
      const queue: Array<{ url: string; path: string }> = [];

      /* save JSON & build download list */
      for (const [section, content] of Object.entries(page)) {
        if (!content.files.length) {continue;}

        const jsonPath = path.join(pageDir, `${safe(section)}.json`);
        await writeFile(jsonPath, JSON.stringify(content, null, 2), 'utf8');

        for (const file of content.files) {
          queue.push({ url: file.url, path: path.join(pageDir, safe(file.name)) });
        }
      }
    }
  }
}
