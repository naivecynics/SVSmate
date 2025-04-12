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
                "Lectures": {
                    ".": "Lectures",
                    "week 1": {
                        ".": "week 1",
                    }
                }
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
        // const courses = await crawler.getCoursesByTerm();
        const courses = await crawler.parseVault();

        if (!courses || Object.keys(courses).length === 0) {
            vscode.window.showWarningMessage('No courses found');
            outputChannel.warn('updateCourseJson', 'No courses found');
            return;
        }

        outputChannel.info('updateCourseJson', `✅ Retrieved ${Object.keys(courses).length} terms with courses`);

        // Check if the courseJson file exists
        if (fs.existsSync(courseJsonPath)) {
            // Read the existing courseJson file
            const fileContent = fs.readFileSync(courseJsonPath, 'utf8');
            try {
                courseJsonOld = JSON.parse(fileContent);
            } catch (error) {
                outputChannel.error('updateCourseJson', `Failed to parse existing courseJson: ${error}`);
                return;
            }
        }
    });
};

export async function crawlBB(context: vscode.ExtensionContext) {
    const crawler = new BlackboardCrawler();

    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'Blackboard Crawler',
        cancellable: true
    }, async (progress, token) => {
        outputChannel.info('crawlBB', 'Logging in...');
        let loginSuccess = await crawler.login(context);

        if (!loginSuccess) {
            vscode.window.showErrorMessage('❌ Failed to login to Blackboard');
            outputChannel.error('crawlBB', 'Login failed');
            return;
        }

        vscode.window.showInformationMessage('✅ Successfully logged in to Blackboard');
        outputChannel.info('crawlBB', 'Login successful');

        // Get course list
        progress.report({ message: 'Getting course list...' });
        outputChannel.info('crawlBB', 'Getting course list...');
        const courses = await crawler.getCoursesByTerm();

        if (!courses || Object.keys(courses).length === 0) {
            vscode.window.showWarningMessage('No courses found');
            outputChannel.warn('crawlBB', 'No courses found');
            return;
        }

        outputChannel.info('crawlBB', '✅ Retrieved ${Object.keys(courses).length} terms with courses');

        const baseDownloadPath = globalConfig.ConfigFolderPath.BlackboardSaveFolder;

        // Process each term and course
        for (const [termId, termCourses] of Object.entries(courses)) {
            progress.report({ message: `Processing term: ${termId}` });

            // Create term directory
            const termPath = path.join(baseDownloadPath, termId);
            if (!fs.existsSync(termPath)) {
                fs.mkdirSync(termPath, { recursive: true });
            }

            // Process each course in term
            for (const course of termCourses) {
                if (token.isCancellationRequested) {
                    // outputChannel.appendLine('Operation cancelled by user');
                    return;
                }

                // outputChannel.appendLine(`\n🔍 Processing course: ${course.name}`);
                progress.report({ message: `Processing: ${course.name}` });

                // Create course directory (ensure safe filename)
                const courseName = course.name.replace(/[<>:"/\\|?*]/g, '_');
                const coursePath = path.join(termPath, courseName);
                if (!fs.existsSync(coursePath)) {
                    fs.mkdirSync(coursePath, { recursive: true });
                }

                // Save announcement if available
                if (course.announcement.content) {
                    // outputChannel.appendLine(`📢 Announcement: ${course.announcement.content}`);
                    fs.writeFileSync(
                        path.join(coursePath, 'announcement.txt'),
                        `${course.announcement.content}\nURL: ${course.announcement.url}`
                    );
                }

                // Get course sidebar
                progress.report({ message: `Getting sidebar for: ${course.name}` });
                const sidebar = await crawler.getCourseSidebarMenu(course.url);

                if (!sidebar || Object.keys(sidebar).length === 0) {
                    // outputChannel.appendLine('❌ Failed to parse course sidebar');
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
                                // outputChannel.appendLine('Operation cancelled by user');
                                return;
                            }

                            // outputChannel.appendLine(`\n📁 Processing: ${category} - ${page.title}`);
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

                                // Save section text content
                                if (content.text) {
                                    fs.writeFileSync(path.join(sectionPath, 'content.txt'), content.text);
                                }

                                // Download files
                                for (const file of content.files) {
                                    if (token.isCancellationRequested) {
                                        // outputChannel.appendLine('Operation cancelled by user');
                                        return;
                                    }

                                    const fileName = file.name.replace(/[<>:"/\\|?*]/g, '_');
                                    const filePath = path.join(sectionPath, fileName);

                                    progress.report({ message: `Downloading: ${fileName}` });
                                    // outputChannel.appendLine(`⬇️ Downloading: ${file.name}`);

                                    await crawler.downloadFile(file.url, filePath);
                                }
                            }
                        }
                    }
                }
            }
        }

        vscode.window.showInformationMessage('✅ Blackboard content download complete!');
        // outputChannel.appendLine('\n✅ All course content downloaded successfully!');
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

    public async checkLogin(): Promise<boolean> {
        try {
            // 第一步：访问 Blackboard 首页获取重定向 URL
            const bbResponse = await this.fetch(this.baseUrl, {
                headers: this.headers,
            });
            // 这里取 response.url 作为跳转前的信息
            const bbResponseUrl = bbResponse.url;
            // 使用 CAS 登录 URL，并带上 service 参数（登录成功后会跳回 loginUrl）
            const casLoginUrl = `${this.casUrl}?service=${encodeURIComponent(this.loginUrl)}`;

            // 第二步：获取 CAS 登录页面，提取隐藏域数据（例如 execution）
            const casResponse = await this.fetch(casLoginUrl, {
                headers: this.headers,
            });

            if (casResponse.status === 200) {
                outputChannel.info('checkLogin', 'User is logged in, redirecting...');
                return true; // 已登录
            } else if (casResponse.status === 302) {
                outputChannel.info('checkLogin', 'User is not logged in, redirecting to CAS login...');
                return false; // 未登录
            } else {
                throw new Error(`Unexpected response status: ${casResponse.status}`);
            }
        } catch (error) {
            outputChannel.error('checkLogin', `Error checking login status: ${error}`);
            return false;
        }
    }

    /**
     * 使用 CAS 认证登录 Blackboard
     */
    public async login(context: vscode.ExtensionContext): Promise<boolean> {
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
                vscode.window.showErrorMessage('❌ Username or password is required!');
                return false;
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
                outputChannel.error('login', `Failed to save credentials: ${error}`);
            }
        }

        try {
            // 第一步：访问 Blackboard 首页获取重定向 URL
            const bbResponse = await this.fetch(this.baseUrl, {
                headers: this.headers,
            });
            // 这里取 response.url 作为跳转前的信息
            const bbResponseUrl = bbResponse.url;
            // 使用 CAS 登录 URL，并带上 service 参数（登录成功后会跳回 loginUrl）
            const casLoginUrl = `${this.casUrl}?service=${encodeURIComponent(this.loginUrl)}`;

            // 第二步：获取 CAS 登录页面，提取隐藏域数据（例如 execution）
            const casResponse = await this.fetch(casLoginUrl, {
                headers: this.headers,
            });
            const casHtml = await casResponse.text();
            const $ = cheerio.load(casHtml);
            const execution = $('input[name="execution"]').val();
            if (!execution) {
                outputChannel.error('login', 'Cannot find execution parameter for CAS authentication');
                return false;
            }

            // 第三步：提交登录表单
            const formData = new URLSearchParams();
            formData.append('username', username);
            formData.append('password', password);
            formData.append('execution', execution.toString());
            formData.append('_eventId', "submit");
            formData.append('geolocation', "");
            formData.append('submit', "登录");

            const casLoginResponse = await this.fetch(casLoginUrl, {
                method: 'POST',
                headers: {
                    ...this.headers,
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: formData,
                // 设置为 manual 以便我们捕获 location header（ticket URL）
                redirect: 'manual'
            });

            // 从响应头中获取重定向地址（ticket URL）
            const ticketUrl = casLoginResponse.headers.get('location');

            if (!ticketUrl) {
                vscode.window.showErrorMessage("❌ Wrong username or password!");
                return false;
            }

            if (!ticketUrl.includes('https://bb.sustech.edu.cn')) {
                vscode.window.showErrorMessage("❌ Login verification failed!");
                return false;
            } else {
                // Save cookies after successful login
                this.saveCookieJar();
                vscode.window.showInformationMessage("✅ CAS 认证成功，已登录到 Blackboard！");
                return true;
            }
        } catch (error) {
            vscode.window.showErrorMessage(`❌ Login error: ${error instanceof Error ? error.message : String(error)}`);
            return false;
        }
    }

    /**
     * Get courses organized by term
     */
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

    public async parseVault(): Promise<CoursesByTerm | null> {
        console.log("📡 正在获取课程列表...");

        // Blackboard course list URL and request payload
        const courseListUrl = 'https://bb.sustech.edu.cn/webapps/portal/execute/tabs/tabAction';
        const payload = new URLSearchParams({
            "action": "refreshAjaxModule",
            "modId": "_3_1",
            "tabId": "_1_1",
            "tab_tab_group_id": "_1_1"
        });

        const headers = {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'Mozilla/5.0',
            'Accept': 'text/html,application/xhtml+xml,application/xml'
        };

        try {
            const response = await this.fetch(courseListUrl, {
                method: 'POST',
                headers: headers,
                body: payload
            });

            if (response.status !== 200) {
                console.log("❌ 课程列表加载失败");
                return null;
            }

            const xmlData = await response.text();
            // save the xmlData to a file for debugging
            fs.writeFileSync('debug/xmlData.html', xmlData, 'utf-8');
            console.log("✅ 已保存 XML 数据到 debug/xmlData.xml 用于调试");

            // Parse XML to extract CDATA content
            const parser = new xml2js.Parser({
                explicitArray: false,
                trim: true,
                explicitCharkey: true,
                explicitRoot: true // 明确保留根节点
            });

            const result = await parser.parseStringPromise(xmlData);

            // save the result to a file for debugging
            fs.writeFileSync('debug/result.json', JSON.stringify(result, null, 2), 'utf-8');
            console.log("✅ 已保存解析结果到 debug/result.json 用于调试");

            // Extract HTML content from CDATA section
            let htmlContent = '';
            if (result && result.contents && result.contents._) {
                htmlContent = result.contents._;
            }

            if (!htmlContent) {
                console.log("⚠️ 提取的 HTML 为空，可能解析错误");
                return null;
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
                let termId = 'unknown';

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
                                const fullCourseUrl = `https://bb.sustech.edu.cn${courseUrl}`;

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
                                        announcement.url = `https://bb.sustech.edu.cn${annLink.attr('href')?.trim() || ''}`;
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

            // // Debug output if needed
            // if (true) {
            //     // Ensure debug directory exists
            //     if (!fs.existsSync('debug')) {
            //         fs.mkdirSync('debug', { recursive: true });
            //     }

            //     // Save the raw XML for debugging
            //     fs.writeFileSync('debug/debug-main-page.html', xmlData, 'utf-8');
            //     console.log("✅ 已保存页面 HTML 到 debug/debug-main-page.html 用于调试");

            //     // Save extracted course data
            //     fs.writeFileSync('debug/courses.json', JSON.stringify(courses, null, 4), 'utf-8');
            //     console.log("✅ 课程数据已成功保存到 debug/courses.json！");
            // }

            return courses;
        } catch (error) {
            console.error(`❌ 解析错误: ${error}`);
            return null;
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
