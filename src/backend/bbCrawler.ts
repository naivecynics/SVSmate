import * as vscode from 'vscode';
import * as cheerio from 'cheerio';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { CookieJar } from 'tough-cookie';
import { wrapper } from 'axios-cookiejar-support';
import { outputChannel } from '../extension';
import fetchCookie from 'fetch-cookie';
import * as tough from 'tough-cookie';
import { promisify } from 'util';
import { pipeline } from 'stream';
import { globalConfig } from '../globalConfig';

const fetch = require('node-fetch');
const yaml = require('js-yaml');
const xml2js = require('xml2js');

const pipelineAsync = promisify(pipeline);

// Course interfaces
interface Announcement {
    content: string;
    url: string;
}

interface Course {
    name: string;
    url: string;
    announcement: Announcement;
}

interface CoursesByTerm {
    [termName: string]: Course[];
}

// Additional interfaces for course parsing
interface SidebarCategory {
    [categoryName: string]: Array<{ title: string; url: string }> | string;
}

// Enhanced interface for PageContent to match Python implementation
interface PageContent {
    text: string;
    files: Array<{ name: string; url: string }>;
}

interface PageStructure {
    [sectionTitle: string]: PageContent;
}

export async function updateCourseJson(context: vscode.ExtensionContext) {
    /*
    Update the course in terms automatically.
    Save the hierarchy structure in the BlackboardFolderMapping Key.
    e.g.
    {
        "Fall2025": {
            ".": "Fall2025",
            "Course1": {
                ".": "Course1",
            },
            "Course2": {
                ...
            }
        },
        ...
    }
    */
    const courseJsonPath = globalConfig.ConfigFilePath.BlackboardFolderMapping;
    const courseJsonDir = globalConfig.ConfigFolderPath.BlackboardSaveFolder;
    var courseJsonNew: { [key: string]: any } = {};
    var courseJsonOld: { [key: string]: any } = {};
    const crawler = new BlackboardCrawler(true);

    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'Blackboard Crawler',
        cancellable: true
    }, async (progress, token) => {
        if (!fs.existsSync(courseJsonDir)) {
            fs.mkdirSync(courseJsonDir, { recursive: true });
        }

        outputChannel.info('updateCourseJson', 'Logging in...');
        let checkLoginSuccess = await crawler.checkLogin();
        if (!checkLoginSuccess) {
            let loginSuccess = await crawler.login(context);
            if (!loginSuccess) {
                vscode.window.showErrorMessage('❌ Failed to login to Blackboard');
                outputChannel.error('updateCourseJson', 'Login failed');
                return;
            }
        }
        vscode.window.showInformationMessage('✅ Successfully logged in to Blackboard');
        outputChannel.info('updateCourseJson', 'Login successful');

        // Get course list
        progress.report({ message: 'Getting course list...' });
        outputChannel.info('updateCourseJson', 'Getting course list...');
        const courses = await crawler.getCoursesByTerm();

        if (!courses || Object.keys(courses).length === 0) {
            vscode.window.showWarningMessage('No courses found');
            outputChannel.warn('updateCourseJson', 'No courses found');
            return;
        }

        outputChannel.info('updateCourseJson', `Retrieved ${Object.keys(courses).length} terms with courses`);

        // Transform courses data into the specified JSON format
        for (const [termId, termCourses] of Object.entries(courses)) {
            courseJsonNew[termId] = {
                ".": termId
            };

            // Add each course in the term
            for (const course of termCourses) {
                // Use course name as both key and value
                const courseName = course.name;
                courseJsonNew[termId][courseName] = courseName;
            }
        }

        // Merge with existing data or replace as needed
        // Here we simply replace term data with new data
        const mergedJson = { ...courseJsonOld, ...courseJsonNew };
        // todo: add tags to identity if the folder if modified

        // Write the updated JSON back to the file
        try {
            fs.writeFileSync(courseJsonPath, JSON.stringify(courseJsonNew, null, 4), 'utf8');
            vscode.window.showInformationMessage('✅ Course data updated successfully');
            outputChannel.info('updateCourseJson', 'Course data updated successfully');
        } catch (error) {
            vscode.window.showErrorMessage('❌ Failed to save course data');
            outputChannel.error('updateCourseJson', `Failed to save course data: ${error}`);
        }
    });
};

export async function updateOneCourse(context: vscode.ExtensionContext, coursePath: string) {
    /*
    update all files of the chosen course
    */
    const courseJsonPath = globalConfig.ConfigFilePath.BlackboardFolderMapping;
    const courseSaveBaseDir = globalConfig.ConfigFolderPath.BlackboardSaveFolder;

    // Parse the input path to extract term and course name
    const [termId, courseName] = coursePath.split('/');

    if (!termId || !courseName) {
        vscode.window.showErrorMessage('❌ Invalid course path format. Expected format: "term/courseName"');
        outputChannel.error('updateOneCourse', 'Invalid course path format');
        return;
    }

    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'Blackboard Crawler',
        cancellable: true
    }, async (progress, token) => {
        // Create Blackboard crawler instance
        const crawler = new BlackboardCrawler();

        // Login if needed
        outputChannel.info('updateOneCourse', 'Checking login status...');
        let checkLoginSuccess = await crawler.checkLogin();
        if (!checkLoginSuccess) {
            outputChannel.info('updateOneCourse', 'Logging in...');
            let loginSuccess = await crawler.login(context);
            if (!loginSuccess) {
                vscode.window.showErrorMessage('❌ Failed to login to Blackboard');
                outputChannel.error('updateOneCourse', 'Login failed');
                return;
            }
        }

        vscode.window.showInformationMessage('✅ Successfully logged in to Blackboard');
        outputChannel.info('updateOneCourse', 'Login successful');

        // Get all courses to find the URL for the specified course
        progress.report({ message: 'Getting course list...' });
        outputChannel.info('updateOneCourse', 'Getting course list...');
        const allCourses = await crawler.getCoursesByTerm();

        if (!allCourses || Object.keys(allCourses).length === 0) {
            vscode.window.showWarningMessage('No courses found');
            outputChannel.warn('updateOneCourse', 'No courses found');
            return;
        }

        // Find the specified course
        const termCourses = allCourses[termId];
        if (!termCourses) {
            vscode.window.showErrorMessage(`❌ Term "${termId}" not found`);
            outputChannel.error('updateOneCourse', `Term "${termId}" not found`);
            return;
        }

        const course = termCourses.find(c => c.name === courseName);
        if (!course) {
            vscode.window.showErrorMessage(`❌ Course "${courseName}" not found in term "${termId}"`);
            outputChannel.error('updateOneCourse', `Course "${courseName}" not found in term "${termId}"`);
            return;
        }

        const courseSafeName = courseName.replace(/[<>:"/\\|?*]/g, '_');

        // Load folder mapping from file
        let folderMapping: any = {};
        try {
            if (fs.existsSync(courseJsonPath)) {
                const mappingData = fs.readFileSync(courseJsonPath, 'utf-8');
                folderMapping = JSON.parse(mappingData);
            } else {
                outputChannel.warn('updateOneCourse', 'Folder mapping file not found, using direct path');
            }
        } catch (error) {
            outputChannel.error('updateOneCourse', `Error loading folder mapping: ${error}`);
        }

        // Get term and course directory names from mapping
        const termDirName = folderMapping[termId]?.['.'] || termId;
        const courseDirName = folderMapping[termId]?.[courseName] || courseSafeName;

        // Create course directory with mapped values
        const coursePath = path.join(courseSaveBaseDir, termDirName, courseDirName);
        if (!fs.existsSync(coursePath)) {
            fs.mkdirSync(coursePath, { recursive: true });
        }

        // Save announcement if available
        if (course.announcement && course.announcement.content) {
            outputChannel.info('updateOneCourse', `Saving announcement for ${courseName}`);
            fs.writeFileSync(
                path.join(coursePath, 'announcement.txt'),
                `${course.announcement.content}\nURL: ${course.announcement.url}`
            );
        }

        // Get course sidebar
        progress.report({ message: `Getting sidebar for: ${courseName}` });
        outputChannel.info('updateOneCourse', `Getting sidebar for ${courseName}`);
        const sidebar = await crawler.getCourseSidebarMenu(course.url);

        if (!sidebar || Object.keys(sidebar).length === 0) {
            vscode.window.showWarningMessage(`⚠️ Failed to parse course sidebar for ${courseName}`);
            outputChannel.warn('updateOneCourse', `Failed to parse course sidebar for ${courseName}`);
            return;
        }

        // Process each category in sidebar
        for (const [category, pages] of Object.entries(sidebar)) {
            if (token.isCancellationRequested) {
                outputChannel.info('updateOneCourse', 'Operation cancelled by user');
                return;
            }

            if (Array.isArray(pages)) {
                // Create category directory
                const categoryName = category.replace(/[<>:"/\\|?*]/g, '_');
                const categoryPath = path.join(coursePath, categoryName);
                if (!fs.existsSync(categoryPath)) {
                    fs.mkdirSync(categoryPath, { recursive: true });
                }

                // Process each page in category
                for (const page of pages) {
                    if (token.isCancellationRequested) {
                        outputChannel.info('updateOneCourse', 'Operation cancelled by user');
                        return;
                    }

                    progress.report({ message: `Processing: ${page.title}` });
                    outputChannel.info('updateOneCourse', `Processing: ${page.title}`);

                    // Get page content
                    const pageContent = await crawler.getPageContent(page.url);
                    if (!pageContent || Object.keys(pageContent).length === 0) {
                        outputChannel.warn('updateOneCourse', `No content found for page: ${page.title}`);
                        continue;
                    }

                    // Create page directory
                    const pageName = page.title.replace(/[<>:"/\\|?*]/g, '_');
                    const pagePath = path.join(categoryPath, pageName);
                    if (!fs.existsSync(pagePath)) {
                        fs.mkdirSync(pagePath, { recursive: true });
                    }

                    // Process each section in the page
                    for (const [section, content] of Object.entries(pageContent)) {
                        if (token.isCancellationRequested) {
                            outputChannel.info('updateOneCourse', 'Operation cancelled by user');
                            return;
                        }

                        const sectionName = section.replace(/[<>:"/\\|?*]/g, '_');
                        const sectionPath = path.join(pagePath, sectionName);
                        if (!fs.existsSync(sectionPath)) {
                            fs.mkdirSync(sectionPath, { recursive: true });
                        }

                        // Download files
                        for (const file of content.files) {
                            if (token.isCancellationRequested) {
                                outputChannel.info('updateOneCourse', 'Operation cancelled by user');
                                return;
                            }

                            const fileName = file.name.replace(/[<>:"/\\|?*]/g, '_');
                            const filePath = path.join(sectionPath, fileName);

                            progress.report({ message: `Downloading: ${fileName}` });
                            outputChannel.info('updateOneCourse', `Downloading: ${fileName}`);

                            await crawler.downloadFile(file.url, filePath);
                        }
                    }
                }
            }
        }

        vscode.window.showInformationMessage(`✅ Course "${courseName}" content updated successfully!`);
        outputChannel.info('updateOneCourse', `Course "${courseName}" content updated successfully`);
    });
}

export async function updateOneTerm(context: vscode.ExtensionContext, termId: string) {
    const courseJsonPath = globalConfig.ConfigFilePath.BlackboardFolderMapping;
    const baseDownloadPath = globalConfig.ConfigFolderPath.BlackboardSaveFolder;

    // Load folder mapping from file
    let folderMapping: any = {};
    try {
        if (fs.existsSync(courseJsonPath)) {
            const mappingData = fs.readFileSync(courseJsonPath, 'utf-8');
            folderMapping = JSON.parse(mappingData);
            outputChannel.info('updateOneTerm', `Loaded folder mapping file for term: ${termId}`);
        } else {
            outputChannel.warn('updateOneTerm', 'Folder mapping file not found, using direct paths');
        }
    } catch (error) {
        outputChannel.error('updateOneTerm', `Error loading folder mapping: ${error}`);
    }

    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: `Blackboard Crawler - Term: ${termId}`,
        cancellable: true
    }, async (progress, token) => {
        // Create Blackboard crawler instance
        const crawler = new BlackboardCrawler();

        // Login if needed
        outputChannel.info('updateOneTerm', 'Checking login status...');
        let checkLoginSuccess = await crawler.checkLogin();
        if (!checkLoginSuccess) {
            outputChannel.info('updateOneTerm', 'Logging in...');
            let loginSuccess = await crawler.login(context);
            if (!loginSuccess) {
                vscode.window.showErrorMessage('❌ Failed to login to Blackboard');
                outputChannel.error('updateOneTerm', 'Login failed');
                return;
            }
        }

        vscode.window.showInformationMessage('✅ Successfully logged in to Blackboard');
        outputChannel.info('updateOneTerm', 'Login successful');

        // Get course list
        progress.report({ message: 'Getting course list...' });
        outputChannel.info('updateOneTerm', 'Getting course list...');
        const courses = await crawler.getCoursesByTerm();

        if (!courses || Object.keys(courses).length === 0) {
            vscode.window.showWarningMessage('No courses found');
            outputChannel.warn('updateOneTerm', 'No courses found');
            return;
        }

        // Check if the specified term exists
        if (!courses[termId]) {
            vscode.window.showErrorMessage(`❌ Term "${termId}" not found`);
            outputChannel.error('updateOneTerm', `Term "${termId}" not found in retrieved courses`);
            return;
        }

        const termCourses = courses[termId];
        outputChannel.info('updateOneTerm', `Found ${termCourses.length} courses in term "${termId}"`);

        // Get mapped term directory name from JSON
        const termDirName = folderMapping[termId]?.['.'] || termId;

        // Create term directory with mapped name
        const termPath = path.join(baseDownloadPath, termDirName);
        if (!fs.existsSync(termPath)) {
            fs.mkdirSync(termPath, { recursive: true });
        }

        // Process each course in the term
        for (const course of termCourses) {
            if (token.isCancellationRequested) {
                outputChannel.info('updateOneTerm', 'Operation cancelled by user');
                return;
            }

            progress.report({ message: `Processing: ${course.name}` });
            outputChannel.info('updateOneTerm', `Processing course: ${course.name}`);

            // Get mapped course directory name from JSON
            const courseName = course.name;
            const courseSafeName = courseName.replace(/[<>:"/\\|?*]/g, '_');
            const courseDirName = folderMapping[termId]?.[courseName] || courseSafeName;

            // Create course directory with mapped name
            const coursePath = path.join(termPath, courseDirName);
            if (!fs.existsSync(coursePath)) {
                fs.mkdirSync(coursePath, { recursive: true });
            }

            // Save announcement if available
            if (course.announcement.content) {
                fs.writeFileSync(
                    path.join(coursePath, 'announcement.txt'),
                    `${course.announcement.content}\nURL: ${course.announcement.url}`
                );
            }

            // Get course sidebar
            progress.report({ message: `Getting sidebar for: ${course.name}` });
            const sidebar = await crawler.getCourseSidebarMenu(course.url);

            if (!sidebar || Object.keys(sidebar).length === 0) {
                outputChannel.warn('updateOneTerm', `No sidebar content found for course: ${course.name}`);
                continue;
            }

            // Process each category in sidebar
            for (const [category, pages] of Object.entries(sidebar)) {
                if (token.isCancellationRequested) {
                    outputChannel.info('updateOneTerm', 'Operation cancelled by user');
                    return;
                }

                if (Array.isArray(pages)) {
                    // Create category directory
                    const categoryName = category.replace(/[<>:"/\\|?*]/g, '_');
                    const categoryPath = path.join(coursePath, categoryName);
                    if (!fs.existsSync(categoryPath)) {
                        fs.mkdirSync(categoryPath, { recursive: true });
                    }

                    // Process each page in category
                    for (const page of pages) {
                        if (token.isCancellationRequested) {
                            outputChannel.info('updateOneTerm', 'Operation cancelled by user');
                            return;
                        }

                        progress.report({ message: `Processing: ${page.title}` });
                        outputChannel.info('updateOneTerm', `Processing page: ${page.title}`);

                        // Get page content
                        const pageContent = await crawler.getPageContent(page.url);
                        if (!pageContent || Object.keys(pageContent).length === 0) {
                            outputChannel.warn('updateOneTerm', `No content found for page: ${page.title}`);
                            continue;
                        }

                        // Create page directory
                        const pageName = page.title.replace(/[<>:"/\\|?*]/g, '_');
                        const pagePath = path.join(categoryPath, pageName);
                        if (!fs.existsSync(pagePath)) {
                            fs.mkdirSync(pagePath, { recursive: true });
                        }

                        // Process each section in the page
                        for (const [section, content] of Object.entries(pageContent)) {
                            const sectionName = section.replace(/[<>:"/\\|?*]/g, '_');
                            const sectionPath = path.join(pagePath, sectionName);
                            if (!fs.existsSync(sectionPath)) {
                                fs.mkdirSync(sectionPath, { recursive: true });
                            }

                            // Download files
                            for (const file of content.files) {
                                if (token.isCancellationRequested) {
                                    outputChannel.info('updateOneTerm', 'Operation cancelled by user');
                                    return;
                                }

                                const fileName = file.name.replace(/[<>:"/\\|?*]/g, '_');
                                const filePath = path.join(sectionPath, fileName);

                                progress.report({ message: `Downloading: ${fileName}` });
                                outputChannel.info('updateOneTerm', `Downloading file: ${fileName}`);

                                await crawler.downloadFile(file.url, filePath);
                            }
                        }
                    }
                }
            }
        }

        vscode.window.showInformationMessage(`✅ Term "${termId}" content downloaded successfully!`);
        outputChannel.info('updateOneTerm', `Term "${termId}" content downloaded successfully`);
    });
}

export async function updateAll(context: vscode.ExtensionContext) {
    const crawler = new BlackboardCrawler();
    const courseJsonPath = globalConfig.ConfigFilePath.BlackboardFolderMapping;
    const baseDownloadPath = globalConfig.ConfigFolderPath.BlackboardSaveFolder;

    // Load folder mapping from file
    let folderMapping: any = {};
    try {
        if (fs.existsSync(courseJsonPath)) {
            const mappingData = fs.readFileSync(courseJsonPath, 'utf-8');
            folderMapping = JSON.parse(mappingData);
            outputChannel.info('updateAll', 'Loaded folder mapping file');
        } else {
            outputChannel.warn('updateAll', 'Folder mapping file not found, using direct paths');
        }
    } catch (error) {
        outputChannel.error('updateAll', `Error loading folder mapping: ${error}`);
    }

    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'Blackboard Crawler',
        cancellable: true
    }, async (progress, token) => {
        // Create Blackboard crawler instance
        const crawler = new BlackboardCrawler();

        // Login if needed
        outputChannel.info('updateAll', 'Checking login status...');
        let checkLoginSuccess = await crawler.checkLogin();
        if (!checkLoginSuccess) {
            outputChannel.info('updateAll', 'Logging in...');
            let loginSuccess = await crawler.login(context);
            if (!loginSuccess) {
                vscode.window.showErrorMessage('❌ Failed to login to Blackboard');
                outputChannel.error('updateAll', 'Login failed');
                return;
            }
        }

        vscode.window.showInformationMessage('✅ Successfully logged in to Blackboard');
        outputChannel.info('updateAll', 'Login successful');

        // Get course list
        progress.report({ message: 'Getting course list...' });
        outputChannel.info('updateAll', 'Getting course list...');
        const courses = await crawler.getCoursesByTerm();

        if (!courses || Object.keys(courses).length === 0) {
            vscode.window.showWarningMessage('No courses found');
            outputChannel.warn('updateAll', 'No courses found');
            return;
        }

        outputChannel.info('updateAll', `✅ Retrieved ${Object.keys(courses).length} terms with courses`);

        // Process each term and course
        for (const [termId, termCourses] of Object.entries(courses)) {
            progress.report({ message: `Processing term: ${termId}` });

            // Get mapped term directory name from JSON
            const termDirName = folderMapping[termId]?.['.'] || termId;

            // Create term directory with mapped name
            const termPath = path.join(baseDownloadPath, termDirName);
            if (!fs.existsSync(termPath)) {
                fs.mkdirSync(termPath, { recursive: true });
            }

            // Process each course in term
            for (const course of termCourses) {
                if (token.isCancellationRequested) {
                    return;
                }

                progress.report({ message: `Processing: ${course.name}` });

                // Get mapped course directory name from JSON
                const courseName = course.name;
                const courseSafeName = courseName.replace(/[<>:"/\\|?*]/g, '_');
                const courseDirName = folderMapping[termId]?.[courseName] || courseSafeName;

                // Create course directory with mapped name
                const coursePath = path.join(termPath, courseDirName);
                if (!fs.existsSync(coursePath)) {
                    fs.mkdirSync(coursePath, { recursive: true });
                }

                // Save announcement if available
                if (course.announcement.content) {
                    fs.writeFileSync(
                        path.join(coursePath, 'announcement.txt'),
                        `${course.announcement.content}\nURL: ${course.announcement.url}`
                    );
                }

                // Get course sidebar
                progress.report({ message: `Getting sidebar for: ${course.name}` });
                const sidebar = await crawler.getCourseSidebarMenu(course.url);

                if (!sidebar || Object.keys(sidebar).length === 0) {
                    continue;
                }

                // Process each category in sidebar
                for (const [category, pages] of Object.entries(sidebar)) {
                    if (Array.isArray(pages)) {
                        // Create category directory
                        const categoryName = category.replace(/[<>:"/\\|?*]/g, '_');
                        const categoryPath = path.join(coursePath, categoryName);
                        if (!fs.existsSync(categoryPath)) {
                            fs.mkdirSync(categoryPath, { recursive: true });
                        }

                        // Process each page in category
                        for (const page of pages) {
                            if (token.isCancellationRequested) {
                                return;
                            }

                            progress.report({ message: `Processing: ${page.title}` });

                            // Get page content
                            const pageContent = await crawler.getPageContent(page.url);
                            if (!pageContent || Object.keys(pageContent).length === 0) { continue; }

                            // Create page directory
                            const pageName = page.title.replace(/[<>:"/\\|?*]/g, '_');
                            const pagePath = path.join(categoryPath, pageName);
                            if (!fs.existsSync(pagePath)) {
                                fs.mkdirSync(pagePath, { recursive: true });
                            }

                            // Process each section in the page
                            for (const [section, content] of Object.entries(pageContent)) {
                                const sectionName = section.replace(/[<>:"/\\|?*]/g, '_');
                                const sectionPath = path.join(pagePath, sectionName);
                                if (!fs.existsSync(sectionPath)) {
                                    fs.mkdirSync(sectionPath, { recursive: true });
                                }

                                // Download files
                                for (const file of content.files) {
                                    if (token.isCancellationRequested) {
                                        return;
                                    }

                                    const fileName = file.name.replace(/[<>:"/\\|?*]/g, '_');
                                    const filePath = path.join(sectionPath, fileName);

                                    progress.report({ message: `Downloading: ${fileName}` });

                                    await crawler.downloadFile(file.url, filePath);
                                }
                            }
                        }
                    }
                }
            }
            break;
        }

        vscode.window.showInformationMessage('✅ Blackboard content download complete!');
    });
}

export class BlackboardCrawler {
    private baseUrl: string;
    private loginUrl: string;
    private casUrl: string;
    private courseListUrl: string;
    private headers: Record<string, string>;
    private debug: boolean;
    private cookieJar: CookieJar;
    private fetch: typeof fetch;
    private cookieFilePath: string;

    constructor(enableDebug: boolean = false) {
        // 初始化相关 URL 与请求头
        this.baseUrl = "https://bb.sustech.edu.cn";
        this.loginUrl = `${this.baseUrl}/webapps/login/`;
        this.casUrl = "https://cas.sustech.edu.cn/cas/login";
        this.courseListUrl = `${this.baseUrl}/webapps/portal/execute/tabs/tabAction`;
        this.headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        };
        this.debug = enableDebug;
        this.cookieFilePath = globalConfig.ConfigFilePath.BlackboardCookies;

        // Load cookie jar from file or create a new one
        this.cookieJar = this.loadCookieJar();

        // Use fetch-cookie with the loaded cookie jar
        this.fetch = fetchCookie(fetch, this.cookieJar);
    }

    /**
     * Load cookie jar from file if it exists, or create a new one
     */
    private loadCookieJar(): CookieJar {
        if (fs.existsSync(this.cookieFilePath)) {
            try {
                const data = fs.readFileSync(this.cookieFilePath, 'utf-8');
                const json = JSON.parse(data);
                return tough.CookieJar.deserializeSync(json);
            } catch (error) {
                outputChannel.warn('loadCookieJar', `Failed to load cookies, creating new jar: ${error}`);
            }
        }
        return new tough.CookieJar();
    }

    /**
     * Save cookie jar to file for persistence between sessions
     */
    private saveCookieJar(): void {
        try {
            const cookieDir = path.dirname(this.cookieFilePath);
            if (!fs.existsSync(cookieDir)) {
                fs.mkdirSync(cookieDir, { recursive: true });
            }

            const data = this.cookieJar.serializeSync();
            fs.writeFileSync(this.cookieFilePath, JSON.stringify(data));

            if (this.debug) {
                outputChannel.info('saveCookieJar', 'Cookies saved successfully');
            }
        } catch (error) {
            outputChannel.error('saveCookieJar', `Failed to save cookies: ${error}`);
        }
    }

    /**
     * Check if user is already logged in to Blackboard
     * @returns true if logged in, false otherwise
     */
    public async checkLogin(): Promise<boolean> {
        try {
            // Try to access a protected page
            const response = await this.fetch(`${this.baseUrl}/ultra/course`, {
                headers: this.headers,
                redirect: 'manual'
            });

            // If we get a 200 response or specific redirect, we're logged in
            if (response.status === 200) {
                outputChannel.info('checkLogin', 'User is logged in');
                return true;
            }

            // If we get a 302 redirect to CAS, we're not logged in
            if (response.status === 302) {
                const location = response.headers.get('location') || '';
                if (location.includes('cas.sustech.edu.cn')) {
                    outputChannel.info('checkLogin', 'User is not logged in, needs CAS authentication');
                    return false;
                }
            }

            // Fallback - try another check method
            const checkUrl = `${this.baseUrl}/learn/api/public/v1/users/me`;
            const meResponse = await this.fetch(checkUrl, {
                headers: this.headers
            });

            return meResponse.status === 200;
        } catch (error) {
            outputChannel.error('checkLogin', `Error checking login status: ${error}`);
            return false;
        }
    }

    /**
     * Complete CAS login process for Blackboard
     * @param context Extension context for credential storage
     * @returns boolean indicating login success
     */
    public async login(context: vscode.ExtensionContext): Promise<boolean> {
        try {
            // 1. Get credentials
            const credentials = await this.getCredentials(context);
            if (!credentials) {
                return false;
            }

            // 2. Prepare CAS authentication (get execution parameter)
            const casParams = await this.prepareCasAuthentication();
            if (!casParams) {
                outputChannel.error('login', 'Failed to prepare CAS authentication');
                return false;
            }

            // 3. Submit credentials to CAS
            const ticketUrl = await this.authenticateWithCas(
                credentials.username,
                credentials.password,
                casParams.execution
            );

            if (!ticketUrl) {
                vscode.window.showErrorMessage("❌ Authentication failed. Please check your credentials.");
                return false;
            }

            // 4. Follow ticketUrl to validate the service ticket
            const validationSuccess = await this.validateServiceTicket(ticketUrl);
            if (!validationSuccess) {
                vscode.window.showErrorMessage("❌ Failed to validate CAS ticket");
                return false;
            }

            // 5. Save cookies after successful login
            this.saveCookieJar();
            vscode.window.showInformationMessage("✅ Successfully logged in to Blackboard!");
            return true;
        } catch (error) {
            outputChannel.error('login', `Login process failed: ${error}`);
            vscode.window.showErrorMessage(`❌ Login error: ${error instanceof Error ? error.message : String(error)}`);
            return false;
        }
    }

    /**
     * Get user credentials from storage or prompt
     */
    private async getCredentials(context: vscode.ExtensionContext): Promise<{ username: string, password: string } | null> {
        const secretStorage = context.secrets;
        let username = await secretStorage.get('bb_username');
        let password = await secretStorage.get('bb_password');

        if (!username || !password) {
            username = await vscode.window.showInputBox({
                prompt: 'Enter your SUSTech username',
                placeHolder: 'e.g., 12210101',
                ignoreFocusOut: true,
                validateInput: text => {
                    return text && text.trim() ? null : 'Username is required';
                }
            });

            password = await vscode.window.showInputBox({
                prompt: 'Enter your SUSTech password',
                password: true,
                ignoreFocusOut: true,
                validateInput: text => {
                    return text && text.trim() ? null : 'Password is required';
                }
            });

            if (!username || !password) {
                vscode.window.showErrorMessage('❌ Username and password are required!');
                return null;
            }

            try {
                const saveChoice = await vscode.window.showQuickPick(
                    ['Yes', 'No'],
                    {
                        placeHolder: 'Do you want to save your credentials?',
                        ignoreFocusOut: true
                    }
                );

                if (saveChoice === 'Yes') {
                    await Promise.all([
                        secretStorage.store('bb_username', username),
                        secretStorage.store('bb_password', password)
                    ]);
                }
            } catch (error) {
                outputChannel.error('getCredentials', `Failed to save credentials: ${error}`);
            }
        }

        return { username, password };
    }

    /**
     * Prepare CAS authentication by getting execution parameter
     */
    private async prepareCasAuthentication(): Promise<{ execution: string } | null> {
        try {
            // Create the service URL that CAS will redirect back to after authentication
            const serviceUrl = encodeURIComponent(this.loginUrl);
            const casLoginUrl = `${this.casUrl}?service=${serviceUrl}`;

            // Get the CAS login page
            const response = await this.fetch(casLoginUrl, {
                headers: this.headers,
                redirect: 'follow'
            });

            if (response.status !== 200) {
                outputChannel.error('prepareCasAuthentication', `Failed to get CAS login page: ${response.status}`);
                return null;
            }

            // Parse the login page to extract the execution parameter
            const html = await response.text();
            const $ = cheerio.load(html);
            const execution = $('input[name="execution"]').val();

            if (!execution) {
                outputChannel.error('prepareCasAuthentication', 'Execution parameter not found in CAS login page');
                return null;
            }

            return { execution: execution.toString() };
        } catch (error) {
            outputChannel.error('prepareCasAuthentication', `Error preparing CAS authentication: ${error}`);
            return null;
        }
    }

    /**
     * Submit credentials to CAS server
     */
    private async authenticateWithCas(username: string, password: string, execution: string): Promise<string | null> {
        try {
            // Service URL for after authentication
            const serviceUrl = encodeURIComponent(this.loginUrl);
            const casLoginUrl = `${this.casUrl}?service=${serviceUrl}`;

            // Prepare form data
            const formData = new URLSearchParams();
            formData.append('username', username);
            formData.append('password', password);
            formData.append('execution', execution);
            formData.append('_eventId', "submit");
            formData.append('geolocation', "");
            formData.append('submit', "登录");

            // Submit the form
            const response = await this.fetch(casLoginUrl, {
                method: 'POST',
                headers: {
                    ...this.headers,
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: formData,
                redirect: 'manual' // Don't follow redirects automatically
            });

            // Check for successful authentication (should be a 302 redirect)
            if (response.status === 302) {
                const location = response.headers.get('location');

                if (!location) {
                    outputChannel.error('authenticateWithCas', 'No location header in CAS response');
                    return null;
                }

                if (location.includes('authenticationFailure')) {
                    outputChannel.error('authenticateWithCas', 'Authentication failed: Invalid credentials');
                    return null;
                }

                // If location contains ticket parameter, authentication successful
                if (location.includes('ticket=')) {
                    outputChannel.info('authenticateWithCas', 'CAS authentication successful, received ticket');
                    return location;
                }
            }

            outputChannel.error('authenticateWithCas', `Unexpected response: ${response.status}`);
            return null;
        } catch (error) {
            outputChannel.error('authenticateWithCas', `Error during CAS authentication: ${error}`);
            return null;
        }
    }

    /**
     * Validate the service ticket with the service provider
     */
    private async validateServiceTicket(ticketUrl: string): Promise<boolean> {
        try {
            // Follow the redirect with the ticket to complete authentication
            const response = await this.fetch(ticketUrl, {
                headers: this.headers,
                redirect: 'follow'
            });

            // Check if we're successfully logged in
            if (response.status === 200) {
                // Verify we're actually on BB, not an error page
                const finalUrl = response.url;
                if (finalUrl.includes('bb.sustech.edu.cn')) {
                    outputChannel.info('validateServiceTicket', `Successfully validated ticket, redirected to: ${finalUrl}`);
                    return true;
                }
            }

            outputChannel.error('validateServiceTicket', `Ticket validation failed: ${response.status}`);
            return false;
        } catch (error) {
            outputChannel.error('validateServiceTicket', `Error validating service ticket: ${error}`);
            return false;
        }
    }

    public async getCoursesByTerm(): Promise<CoursesByTerm> {
        // Prepare request payload for course list
        const payload = new URLSearchParams({
            "action": "refreshAjaxModule",
            "modId": "_3_1",
            "tabId": "_1_1",
            "tab_tab_group_id": "_1_1"
        });

        try {
            const response = await this.fetch(this.courseListUrl, {
                method: 'POST',
                body: payload,
                headers: {
                    ...this.headers,
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'X-Requested-With': 'XMLHttpRequest',
                    'Accept': 'application/xml, text/xml, */*',
                    'Referer': this.baseUrl
                }
            });

            if (response.status !== 200) {
                return {};
            }

            const xmlData = await response.text();

            // Parse XML to extract CDATA content
            const parser = new xml2js.Parser({
                explicitArray: false,
                trim: true,
                explicitCharkey: true,
                explicitRoot: true
            });

            if (this.debug) {
                //save the xmlData to a file in the debug folder
                const debugFilePath = path.join(globalConfig.ConfigFolderPath.DebugFolder, 'courseList.xml');
                fs.writeFileSync(debugFilePath, xmlData);
                outputChannel.info('getCoursesByTerm', `XML data saved to ${debugFilePath}`);
            }

            const result = await parser.parseStringPromise(xmlData);

            // Extract HTML content from CDATA section
            let htmlContent = '';
            if (result && result.contents && result.contents._) {
                htmlContent = result.contents._;
            }

            if (!htmlContent) {
                outputChannel.warn('getCoursesByTerm', "Couldn't extract HTML content from response");
                return {};
            }

            // Parse HTML content using cheerio
            const $ = cheerio.load(htmlContent);

            // Store course information
            const courses: CoursesByTerm = {};

            // Iterate through all terms
            $('h3.termHeading-coursefakeclass').each((_, term) => {
                const termName = $(term).text().trim();

                // Extract term identifier (year + season)
                const match = termName.match(/（(Spring|Fall|Summer|Winter) (\d{4})）/);
                let termId = termName; // Use full term name as fallback

                if (match) {
                    const season = match[1].toLowerCase();
                    const year = match[2].slice(-2);
                    termId = `${year}${season}`;
                }

                courses[termId] = [];

                // Find the term's course list div
                const aTag = $(term).find('a[id]');
                if (aTag.length) {
                    const termIdMatch = aTag.attr('id')?.match(/termCourses__\d+_\d+/);
                    if (termIdMatch) {
                        const fullTermId = "_3_1" + termIdMatch[0];
                        const courseListDiv = $(`div#${fullTermId}`);

                        if (courseListDiv.length) {
                            // Find all course items
                            courseListDiv.find('li').each((_, courseLi) => {
                                const courseLink = $(courseLi).find('a[href]');

                                // Skip announcements
                                if (!courseLink.length || courseLink.attr('href')?.includes('announcement')) {
                                    return;
                                }

                                const courseName = courseLink.text().trim();
                                const courseUrl = courseLink.attr('href')?.trim() || '';
                                const fullCourseUrl = courseUrl.startsWith('http')
                                    ? courseUrl
                                    : `https://bb.sustech.edu.cn${courseUrl}`;

                                // Find announcement information
                                const announcement: Announcement = { content: '', url: '' };
                                const courseDataBlock = $(courseLi).find('div.courseDataBlock');

                                if (courseDataBlock.length) {
                                    // Remove "公告: " label for cleaner text
                                    const spanLabel = courseDataBlock.find('span.dataBlockLabel');
                                    if (spanLabel.length) {
                                        spanLabel.remove();
                                    }

                                    // Extract announcement details
                                    const annLink = courseDataBlock.find('a[href]');
                                    if (annLink.length) {
                                        announcement.content = annLink.text().trim();
                                        const annUrl = annLink.attr('href')?.trim() || '';
                                        announcement.url = annUrl.startsWith('http')
                                            ? annUrl
                                            : `https://bb.sustech.edu.cn${annUrl}`;
                                    }
                                }

                                // Store the course data
                                courses[termId].push({
                                    name: courseName,
                                    url: fullCourseUrl,
                                    announcement: announcement
                                });
                            });
                        }
                    }
                }
            });

            // After successful course retrieval, save the cookie jar
            this.saveCookieJar();

            outputChannel.info('getCoursesByTerm', `✅ Successfully retrieved ${Object.keys(courses).length} terms with courses`);
            return courses;

        } catch (error) {
            outputChannel.error('getCoursesByTerm', `Failed to get courses: ${error}`);
            return {};
        }
    }

    /**
     * Get course sidebar menu structure
     */
    public async getCourseSidebarMenu(url: string): Promise<SidebarCategory> {
        try {
            // Send request and follow redirects
            const response = await this.fetch(url, {
                method: 'GET',
                redirect: 'follow',
                headers: this.headers
            });

            if (response.status !== 200) {
                // outputChannel.appendLine(`❌ Failed to get course page: ${response.status}`);
                return {};
            }

            const finalUrl = response.url;
            // outputChannel.appendLine(`🔀 Redirected to: ${finalUrl}`);

            // Parse HTML
            const html = await response.text();
            const $ = cheerio.load(html);

            // Extract sidebar structure
            const sidebarStructure = this.extractSidebarLinks($);
            return sidebarStructure;

        } catch (error) {
            // outputChannel.appendLine(`❌ Failed to get course sidebar: ${error}`);
            return {};
        }
    }

    /**
     * Extract sidebar links from course HTML
     */
    private extractSidebarLinks($: cheerio.CheerioAPI | cheerio.Root): SidebarCategory {
        const sidebarMenu: SidebarCategory = {};

        // Find course menu ul tag
        const menuUl = $('#courseMenuPalette_contents');
        if (!menuUl.length) {
            // outputChannel.appendLine("❌ Course menu not found");
            return {};
        }

        // Course ID (for constructing correct Announcements link)
        const htmlString = $.html();
        const courseIdMatch = htmlString.match(/course_id=(_\d+_\d+)/);
        const courseId = courseIdMatch ? courseIdMatch[1] : null;

        let currentCategory: string | null = null;

        menuUl.find('li').each((_, element) => {
            // Handle category title (h3)
            const categoryTag = $(element).find('h3');
            if (categoryTag.length) {
                currentCategory = categoryTag.text().trim();
                sidebarMenu[currentCategory] = [];
                return; // Skip further parsing for this li
            }

            // Handle course content links
            const linkTag = $(element).find('a[href]');
            if (linkTag.length) {
                const linkText = linkTag.text().trim();
                let linkUrl = linkTag.attr('href') || '';

                // Ensure URL is absolute
                if (!linkUrl.startsWith('http')) {
                    linkUrl = `https://bb.sustech.edu.cn${linkUrl}`;
                }

                // Special handling for Announcements (replace URL)
                if (linkText.includes('Announcements') && courseId) {
                    linkUrl = `https://bb.sustech.edu.cn/webapps/blackboard/execute/announcement?method=search&context=course_entry&course_id=${courseId}&handle=announcements_entry&mode=view`;
                }

                // Add to current category
                if (currentCategory && Array.isArray(sidebarMenu[currentCategory])) {
                    (sidebarMenu[currentCategory] as Array<{ title: string; url: string }>).push({
                        title: linkText,
                        url: linkUrl
                    });
                } else {
                    // If no category, store in root structure
                    sidebarMenu[linkText] = linkUrl;
                }
            }
        });

        return sidebarMenu;
    }

    /**
     * Get content from a page
     */
    public async getPageContent(url: string): Promise<PageStructure> {
        try {
            // Send request and follow redirects
            const response = await this.fetch(url, {
                method: 'GET',
                redirect: 'follow',
                headers: this.headers
            });

            if (response.status !== 200) {
                // outputChannel.appendLine(`❌ Failed to get page content: ${response.status}`);
                return {};
            }

            const finalUrl = response.url;
            // outputChannel.appendLine(`🔀 Redirected to: ${finalUrl}`);

            // Parse HTML
            const html = await response.text();
            const $ = cheerio.load(html);

            // Extract file structure
            const pageContent = this.extractFileStructure($);
            return pageContent;

        } catch (error) {
            // outputChannel.appendLine(`❌ Failed to get page content: ${error}`);
            return {};
        }
    }

    /**
     * Extract file structure from page HTML
     */
    private extractFileStructure($: cheerio.CheerioAPI | cheerio.Root): PageStructure {
        if (!$) {
            // outputChannel.appendLine("❌ Parsing failed, cannot extract file structure");
            return {};
        }

        const fileStructure: PageStructure = {};

        // Traverse all content areas
        $('li.clearfix.liItem.read').each((_, item) => {
            // Get week title
            const weekTitleTag = $(item).find('h3');
            if (!weekTitleTag.length) {
                return;
            }

            const weekTitle = weekTitleTag.text().trim();
            let content = '';

            // 1. Extract text information with newlines preserved
            const detailsDiv = $(item).find('div.details');
            if (detailsDiv.length) {
                // Preserve newlines in content text
                content = detailsDiv.text().replace(/\s+/g, ' ').trim();
            }

            // 2. Get file list
            const files: Array<{ name: string; url: string }> = [];
            $(item).find('li').each((_, fileLi) => {
                const fileLink = $(fileLi).find('a[href]');
                if (fileLink.length) {
                    const fileName = fileLink.text().trim();
                    const fileUrl = fileLink.attr('href')?.trim() || '';

                    // Filter out invalid URLs
                    if (fileUrl.startsWith('#') || fileUrl.includes('close')) {
                        return;
                    }

                    // Convert relative URLs
                    let fullFileUrl = fileUrl;
                    if (!fileUrl.startsWith('http')) {
                        fullFileUrl = `https://bb.sustech.edu.cn${fileUrl}`;
                    }

                    // Ensure filename is not empty
                    if (fileName) {
                        files.push({ name: fileName, url: fullFileUrl });
                    }
                }
            });

            // 3. Organize data structure
            fileStructure[weekTitle] = { text: content, files: files };
        });

        return fileStructure;
    }

    /**
     * Download a file with progress tracking
     */
    public async downloadFile(url: string, savePath: string): Promise<boolean> {
        // 1. Ensure filename is safe
        const fileName = path.basename(savePath).replace(/\s+/g, '_');
        const safeFilePath = path.join(path.dirname(savePath), fileName);

        // 2. Ensure directory exists
        const directory = path.dirname(safeFilePath);
        if (!fs.existsSync(directory)) {
            fs.mkdirSync(directory, { recursive: true });
        }

        try {
            // 3. Try normal download
            const response = await this.fetch(url, {
                method: 'GET',
                redirect: 'follow',
                headers: this.headers
            });

            if (!response.ok) {
                // outputChannel.appendLine(`❌ Download request failed: ${response.status} ${response.statusText}`);
                return false;
            }

            // 4. Get content length for progress tracking
            const contentLength = parseInt(response.headers.get('content-length') || '0', 10);

            // 5. Create a write stream
            const fileStream = fs.createWriteStream(safeFilePath);

            // 6. Setup progress tracking in debug mode
            if (this.debug && contentLength > 0) {
                // outputChannel.appendLine(`⬇️ Downloading: ${fileName} (${(contentLength / 1024 / 1024).toFixed(2)} MB)`);
            }

            // 7. Pipe the response to file
            await pipelineAsync(
                response.body as unknown as NodeJS.ReadableStream,
                fileStream
            );

            // Save cookie jar after successful download in case of session updates
            this.saveCookieJar();

            if (this.debug) {
                // outputChannel.appendLine(`✅ Download complete: ${safeFilePath}`);
            }
            return true;

        } catch (error) {
            // outputChannel.appendLine(`❌ Download failed: ${url} - ${error}`);

            // 8. If file was partially created, delete it
            if (fs.existsSync(safeFilePath)) {
                try {
                    fs.unlinkSync(safeFilePath);
                } catch (unlinkError) {
                    // outputChannel.appendLine(`⚠️ Could not delete incomplete file: ${safeFilePath}`);
                }
            }

            return false;
        }
    }
}
