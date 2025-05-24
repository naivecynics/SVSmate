import * as vscode from 'vscode';
import * as path from 'path';
import { writeFile } from 'fs/promises';
import { outputChannel } from '../../utils/OutputChannel';
import { BlackboardCrawler } from './BlackboardCrawler';
import { safeEnsureDir, safe } from '../../utils/pathUtils';

/**
 * Crawls a course and saves its content in a structured manner.
 * 
 * @param course - The course object containing course information.
 * @param coursePath - The path where the course content will be saved.
 * @param crawler - The BlackboardCrawler instance used to fetch data.
 * @param progress - The progress object used to update the user interface.
 * @param token - The cancellation token to manage cancellation of the task.
 * @param loggerPrefix - A prefix to use for logging.
 * @returns A promise that resolves when the crawling is complete.
 */
export async function crawlCourse(
    course: any,
    coursePath: string,
    crawler: BlackboardCrawler,
    progress: vscode.Progress<{ message?: string; increment?: number }>,
    token: vscode.CancellationToken,
    loggerPrefix: string
): Promise<void> {
    // Update progress and log that the course is being processed
    progress.report({ message: `Processing: ${course.name}` });
    outputChannel.info(loggerPrefix, `Processing course: ${course.name}`);

    // Ensure the course directory exists
    safeEnsureDir(path.dirname(coursePath), path.basename(coursePath));

    // Get the sidebar menu for the course
    progress.report({ message: `Getting sidebar for: ${course.name}` });
    const sidebar = await crawler.getCourseSidebarMenu(course.url);

    if (!sidebar || Object.keys(sidebar).length === 0) {
        outputChannel.warn(loggerPrefix, `No sidebar content found for course: ${course.name}`);
        return;
    }

    // Loop through all sidebar categories and pages
    for (const [category, pages] of Object.entries(sidebar)) {
        if (token.isCancellationRequested) {
            return; // Exit if the task was cancelled
        }

        if (!Array.isArray(pages)) {
            continue; // Skip if the pages aren't in an array format
        }

        // Ensure a directory exists for each category
        const categoryPath = safeEnsureDir(coursePath, category);

        // Process each page in the category
        for (const page of pages) {
            if (token.isCancellationRequested) {
                return; // Exit if the task was cancelled
            }

            try {
                // Update progress and log the page being processed
                progress.report({ message: `Processing: ${page.title}` });
                outputChannel.info(loggerPrefix, `Processing: ${page.title}`);

                // Fetch the content of the page
                const pageContent = await crawler.getPageContent(page.url);

                if (!pageContent || Object.keys(pageContent).length === 0) {
                    outputChannel.warn(loggerPrefix, `No content found for page: ${page.title}`);
                    continue; // Skip to the next page if no content is found
                }

                // Ensure a directory exists for the page
                const pagePath = safeEnsureDir(categoryPath, page.title);

                // Loop through the content entries on the page
                for (const [entryName, entryContent] of Object.entries(pageContent)) {
                    if (token.isCancellationRequested) {
                        return; // Exit if the task was cancelled
                    }

                    // Skip empty entries or entries without files
                    if (!entryContent || (!entryContent.text && (!entryContent.files || entryContent.files.length === 0))) {
                        outputChannel.warn(loggerPrefix, `Empty entry skipped: ${entryName}`);
                        continue;
                    }

                    // Prepare the data to be saved as JSON
                    const json: { description: string; files: { name: string; url: string }[] } = {
                        description: entryContent.text || '',
                        files: entryContent.files.map(file => ({
                            name: file.name,
                            url: file.url
                        }))
                    };

                    // Define the path where the JSON file will be saved
                    const jsonPath = path.join(pagePath, `${entryName}.json`);

                    // Write the JSON file
                    await writeFile(jsonPath, JSON.stringify(json, null, 2), { encoding: 'utf-8' });
                    outputChannel.info(loggerPrefix, `Saved JSON for section: ${entryName}`);
                }
            } catch (error) {
                // Log any errors that occur during the page processing
                outputChannel.error(loggerPrefix, `Error processing page: ${page.title}, error: ${error}`);
                continue; // Skip to the next page if an error occurs
            }
        }
    }
}
