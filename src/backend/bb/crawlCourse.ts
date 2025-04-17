import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { writeFile } from 'fs/promises';
import { outputChannel } from '../../utils/OutputChannel';
import { BlackboardCrawler } from './BlackboardCrawler';
import { safeEnsureDir } from '../../utils/pathUtils';

export async function crawlCourse(
    course: any,
    coursePath: string,
    crawler: BlackboardCrawler,
    progress: vscode.Progress<{ message?: string; increment?: number }>,
    token: vscode.CancellationToken,
    loggerPrefix: string
): Promise<void> {

    progress.report({ message: `Processing: ${course.name}` });
    outputChannel.info(loggerPrefix, `Processing course: ${course.name}`);

    safeEnsureDir(path.dirname(coursePath), path.basename(coursePath));

    // announcement

    // if (course.announcement?.content) {
    //     try {
    //         const announcementPath = path.join(coursePath, 'announcement.txt');
    //         fs.writeFileSync(
    //             announcementPath,
    //             `${course.announcement.content}\nURL: ${course.announcement.url}`
    //         );
    //         outputChannel.info(loggerPrefix, `Saved announcement to ${announcementPath}`);
    //     } catch (error) {
    //         outputChannel.error(loggerPrefix, `Failed to save announcement: ${error}`);
    //     }
    // }

    progress.report({ message: `Getting sidebar for: ${course.name}` });
    const sidebar = await crawler.getCourseSidebarMenu(course.url);
    if (!sidebar || Object.keys(sidebar).length === 0) { outputChannel.warn(loggerPrefix, `No sidebar content found for course: ${course.name}`); return; }

    for (const [category, pages] of Object.entries(sidebar)) {
        if (token.isCancellationRequested) return;
        if (!Array.isArray(pages)) continue;

        const categoryPath = safeEnsureDir(coursePath, category);

        for (const page of pages) {
            if (token.isCancellationRequested) return;

            progress.report({ message: `Processing: ${page.title}` });
            outputChannel.info(loggerPrefix, `Processing: ${page.title}`);

            const pageContent = await crawler.getPageContent(page.url);
            if (!pageContent || Object.keys(pageContent).length === 0) { outputChannel.warn(loggerPrefix, `No content found for page: ${page.title}`); continue; }

            const pagePath = safeEnsureDir(categoryPath, page.title);

            for (const [entryName, entryContent] of Object.entries(pageContent)) {
                if (token.isCancellationRequested) return;

                // record files url

                const json: { description: string; files: { name: string; url: string }[]; } = {
                  description: entryContent.text,
                  files: entryContent.files.map(file => ({
                    name: file.name,
                    url: file.url
                  }))
                };
                const jsonPath = path.join(pagePath, `${entryName}.json`);
                await writeFile(jsonPath, JSON.stringify(json, null, 2), { encoding: 'utf-8' });
                outputChannel.info(loggerPrefix, `Saved JSON for section: ${entryName}`);

                // download files

                // const sectionPath = safeEnsureDir(pagePath, section);
                // for (const file of entry.files) {
                //     if (token.isCancellationRequested) return;
                //     const filePath = path.join(sectionPath, safe(file.name));
                //     progress.report({ message: `Downloading: ${file.name}` });
                //     outputChannel.info(loggerPrefix, `Downloading: ${file.name}`);
                //     await crawler.downloadFile(file.url, filePath);
                // }
            }
        }
    }
}

