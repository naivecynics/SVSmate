import * as vscode from 'vscode';
import * as path from 'path';
import { outputChannel } from '../../utils/OutputChannel';
import * as PathManager from '../../utils/pathManager';
import { crawlCourse } from './crawlCourse';
import { safeEnsureDir, safe } from '../../utils/pathUtils';
import { BlackboardCrawler } from './BlackboardCrawler';
import { BBMaterialItem } from '../../frontend/BBMaterialView';

/**
 * Updates a specific course by re-downloading its contents from Blackboard.
 * 
 * @param context - The VS Code extension context.
 * @param item - The course item selected from the tree view.
 */
export async function updateCourse(context: vscode.ExtensionContext, item: BBMaterialItem): Promise<void> {
    const courseName = path.basename(item.resourceUri.fsPath);
    const termId = path.basename(path.dirname(item.resourceUri.fsPath));
    const bbVaultDir = PathManager.getDir('bb');
    const crawler = new BlackboardCrawler(true);

    if (!termId || !courseName) {
        vscode.window.showErrorMessage('Invalid course path format. Expected format: "term/courseName"');
        outputChannel.error('updateOneCourse', 'Invalid course path format');
        return;
    }

    if (!(await crawler.ensureLogin(context))) {
        return;
    }

    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'Blackboard Crawler',
        cancellable: true
    }, async (progress, token) => {
        progress.report({ message: 'Getting course list...' });

        const allCourses = await crawler.getCoursesByTerm();
        const course = allCourses?.[termId]?.find(c => safe(c.name) === courseName);

        if (!course) {
            const msg = allCourses?.[termId]
                ? `Course "${courseName}" not found in term "${termId}"`
                : `Term "${termId}" not found`;
            vscode.window.showErrorMessage(msg);
            return;
        }

        const fullCoursePath = safeEnsureDir(safeEnsureDir(bbVaultDir, termId), course.name);
        await crawlCourse(course, fullCoursePath, crawler, progress, token, 'updateOneCourse');

        vscode.window.showInformationMessage(`Course "${courseName}" content updated successfully.`);
        outputChannel.info('updateOneCourse', `Course "${courseName}" content updated successfully`);
    });
}

/**
 * Updates all courses within a specified term.
 * If no item is provided, the user will be prompted to enter a term ID manually.
 * 
 * @param context - The VS Code extension context.
 * @param item - The optional tree item representing the term folder.
 */
export async function updateTerm(context: vscode.ExtensionContext, item?: BBMaterialItem): Promise<void> {
    const crawler = new BlackboardCrawler();

    if (!item) {
        const termIdInput = await vscode.window.showInputBox({
            prompt: 'Please enter term ID to initialize:',
            placeHolder: 'e.g. 25spring',
            validateInput: (val) => val.trim() === '' ? 'Term ID cannot be empty' : null
        });

        if (!termIdInput) { return; }

        const bbVaultDir = PathManager.getDir('bb');
        const fakePath = path.join(bbVaultDir, termIdInput);
        item = {
            resourceUri: vscode.Uri.file(fakePath)
        } as BBMaterialItem;
    }

    const termId = path.basename(item.resourceUri.fsPath);
    const bbVaultDir = PathManager.getDir('bb');

    if (!(await crawler.ensureLogin(context))) {
        return;
    }

    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: `Blackboard Crawler - Term: ${termId}`,
        cancellable: true
    }, async (progress, token) => {
        progress.report({ message: 'Getting course list...' });

        const allCourses = await crawler.getCoursesByTerm();
        const termCourses = allCourses?.[termId];

        if (!termCourses || termCourses.length === 0) {
            vscode.window.showErrorMessage(`Term "${termId}" not found or has no courses`);
            outputChannel.error('updateOneTerm', `Term "${termId}" not found or empty`);
            return;
        }

        const termPath = safeEnsureDir(bbVaultDir, termId);

        for (const course of termCourses) {
            if (token.isCancellationRequested) {
                outputChannel.info('updateOneTerm', 'Operation cancelled by user');
                return;
            }

            const coursePath = safeEnsureDir(termPath, course.name);
            await crawlCourse(course, coursePath, crawler, progress, token, 'updateOneTerm');
        }

        vscode.window.showInformationMessage(`Term "${termId}" content downloaded successfully`);
        outputChannel.info('updateOneTerm', `Term "${termId}" content downloaded successfully`);
    });
}
