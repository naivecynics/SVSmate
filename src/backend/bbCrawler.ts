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

export async function crawlBB() {
    const crawler = new BlackboardCrawler(true); // Enable debug mode

    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'Blackboard Crawler',
        cancellable: true
    }, async (progress, token) => {
        // Try to load cookies first
        progress.report({ message: 'Loading cookies...' });
        const cookiesLoaded = await crawler.loadCookies();
        let loginSuccess = false;

        if (cookiesLoaded) {
            // Test if session is valid
            progress.report({ message: 'Testing session...' });
            loginSuccess = await crawler.testSession();
            if (!loginSuccess) {
                // If session invalid, perform login
                progress.report({ message: 'Logging in...' });
                loginSuccess = await crawler.login();
            } else {
                vscode.window.showInformationMessage('✅ Successfully reconnected to Blackboard using saved session');
            }
        } else {
            // No cookies, do normal login
            progress.report({ message: 'Logging in...' });
            loginSuccess = await crawler.login();
        }

        if (!loginSuccess) {
            vscode.window.showErrorMessage('❌ Failed to login to Blackboard');
            return;
        }

        // Save cookies for future use
        await crawler.saveCookies();

        // Get course list
        progress.report({ message: 'Getting course list...' });
        const courses = await crawler.getCoursesByTerm();

        if (!courses || Object.keys(courses).length === 0) {
            vscode.window.showWarningMessage('No courses found');
            return;
        }

        outputChannel.appendLine(`✅ Retrieved ${Object.keys(courses).length} terms with courses`);

        // Ask user to select download location
        const downloadFolder = await vscode.window.showOpenDialog({
            canSelectMany: false,
            canSelectFolders: true,
            canSelectFiles: false,
            openLabel: 'Select Download Location'
        });

        if (!downloadFolder || downloadFolder.length === 0) {
            vscode.window.showInformationMessage('Download cancelled');
            return;
        }

        const baseDownloadPath = globalConfig.ConfigFilePath.BlackboardSaveFolder;

        // Process each term and course
        for (const [termId, termCourses] of Object.entries(courses)) {
            outputChannel.appendLine(`\n📚 Processing term: ${termId}`);
            progress.report({ message: `Processing term: ${termId}` });

            // Create term directory
            const termPath = path.join(baseDownloadPath, termId);
            if (!fs.existsSync(termPath)) {
                fs.mkdirSync(termPath, { recursive: true });
            }

            // Process each course in term
            for (const course of termCourses) {
                if (token.isCancellationRequested) {
                    outputChannel.appendLine('Operation cancelled by user');
                    return;
                }

                outputChannel.appendLine(`\n🔍 Processing course: ${course.name}`);
                progress.report({ message: `Processing: ${course.name}` });

                // Create course directory (ensure safe filename)
                const courseName = course.name.replace(/[<>:"/\\|?*]/g, '_');
                const coursePath = path.join(termPath, courseName);
                if (!fs.existsSync(coursePath)) {
                    fs.mkdirSync(coursePath, { recursive: true });
                }

                // Save announcement if available
                if (course.announcement.content) {
                    outputChannel.appendLine(`📢 Announcement: ${course.announcement.content}`);
                    fs.writeFileSync(
                        path.join(coursePath, 'announcement.txt'),
                        `${course.announcement.content}\nURL: ${course.announcement.url}`
                    );
                }

                // Get course sidebar
                progress.report({ message: `Getting sidebar for: ${course.name}` });
                const sidebar = await crawler.getCourseSidebarMenu(course.url);

                if (!sidebar || Object.keys(sidebar).length === 0) {
                    outputChannel.appendLine('❌ Failed to parse course sidebar');
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
                                outputChannel.appendLine('Operation cancelled by user');
                                return;
                            }

                            outputChannel.appendLine(`\n📁 Processing: ${category} - ${page.title}`);
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
                                        outputChannel.appendLine('Operation cancelled by user');
                                        return;
                                    }

                                    const fileName = file.name.replace(/[<>:"/\\|?*]/g, '_');
                                    const filePath = path.join(sectionPath, fileName);

                                    progress.report({ message: `Downloading: ${fileName}` });
                                    outputChannel.appendLine(`⬇️ Downloading: ${file.name}`);

                                    await crawler.downloadFile(file.url, filePath);
                                }
                            }
                        }
                    }
                }
            }
        }

        vscode.window.showInformationMessage('✅ Blackboard content download complete!');
        outputChannel.appendLine('\n✅ All course content downloaded successfully!');
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
    private cookieStoragePath: string;

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
        this.cookieJar = new CookieJar();
        // 使用 fetch-cookie 包装 node-fetch，并将 cookieJar 传入
        this.fetch = fetchCookie(fetch, this.cookieJar);

        // Set cookie storage path in user's home directory
        this.cookieStoragePath = path.join(os.homedir(), '.vscode-bb-cookies.json');
    }

    /**
     * Load cookies from storage file
     */
    public async loadCookies(): Promise<boolean> {
        try {
            if (fs.existsSync(this.cookieStoragePath)) {
                const data = fs.readFileSync(this.cookieStoragePath, 'utf-8');
                const json = JSON.parse(data);
                this.cookieJar = CookieJar.deserializeSync(json);
                this.fetch = fetchCookie(fetch, this.cookieJar);
                outputChannel.appendLine("✅ Cookies loaded from storage");
                return true;
            }
        } catch (error) {
            outputChannel.appendLine(`❌ Failed to load cookies: ${error}`);
        }
        return false;
    }

    /**
     * Save cookies to storage file for persistence
     */
    public async saveCookies(): Promise<boolean> {
        try {
            const data = this.cookieJar.serializeSync();
            fs.writeFileSync(this.cookieStoragePath, JSON.stringify(data));
            outputChannel.appendLine("✅ Cookies saved to storage");
            return true;
        } catch (error) {
            outputChannel.appendLine(`❌ Failed to save cookies: ${error}`);
            return false;
        }
    }

    /**
     * Test if the current session is valid
     */
    public async testSession(): Promise<boolean> {
        try {
            const response = await this.fetch(this.baseUrl, {
                headers: this.headers,
                redirect: 'follow'
            });

            const html = await response.text();
            // If page contains login form or redirects to CAS, session is invalid
            if (html.includes('CAS') || html.includes('login') || response.url.includes('cas.sustech.edu.cn')) {
                outputChannel.appendLine("❌ Session expired or invalid");
                return false;
            }

            outputChannel.appendLine("✅ Session valid");
            return true;
        } catch (error) {
            outputChannel.appendLine(`❌ Error testing session: ${error}`);
            return false;
        }
    }

    /**
     * 使用 CAS 认证登录 Blackboard
     */
    public async login(): Promise<boolean> {
        // 从 VSCode 输入框中获取学号与密码
        const username = await vscode.window.showInputBox({
            prompt: 'Enter your SUSTech username',
            placeHolder: 'e.g., 12210101'
        });
        if (!username) {
            vscode.window.showErrorMessage('Username is required');
            return false;
        }

        const password = await vscode.window.showInputBox({
            prompt: 'Enter your SUSTech password',
            password: true
        });
        if (!password) {
            vscode.window.showErrorMessage('Password is required');
            return false;
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
            outputChannel.appendLine("Getting the execution token");
            const $ = cheerio.load(casHtml);
            const execution = $('input[name="execution"]').val();
            if (!execution) {
                vscode.window.showErrorMessage("❌ Cannot find execution parameter for CAS authentication");
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

            outputChannel.appendLine("Submitting CAS login form");
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
            outputChannel.appendLine("CAS login response ticket: " + ticketUrl);

            if (!ticketUrl) {
                vscode.window.showErrorMessage("❌ Wrong username or password!");
                return false;
            }

            if (!ticketUrl.includes('https://bb.sustech.edu.cn')) {
                outputChannel.appendLine("❌ Still redirected to CAS after login");
                vscode.window.showErrorMessage("❌ Login verification failed!");
                return false;
            } else {
                outputChannel.appendLine("✅ Successfully logged into BB");
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
        outputChannel.appendLine("📡 Getting course list...");

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
                headers: {
                    ...this.headers,
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: payload
            });

            if (response.status !== 200) {
                outputChannel.appendLine(`❌ Course list request failed with status: ${response.status}`);
                return {};
            }

            const xmlData = await response.text();

            // If in debug mode, save the raw XML data
            if (this.debug) {
                const debugDir = path.join(os.homedir(), 'vscode-bb-debug');
                if (!fs.existsSync(debugDir)) {
                    fs.mkdirSync(debugDir, { recursive: true });
                }
                fs.writeFileSync(path.join(debugDir, 'xmlData.html'), xmlData, 'utf-8');
                outputChannel.appendLine("✅ Saved XML data for debugging");
            }

            // Parse XML to extract CDATA content
            const parser = new xml2js.Parser({
                explicitArray: false,
                trim: true,
                explicitCharkey: true,
                explicitRoot: true
            });

            const result = await parser.parseStringPromise(xmlData);

            // Debug: save parsed result
            if (this.debug) {
                const debugDir = path.join(os.homedir(), 'vscode-bb-debug');
                fs.writeFileSync(path.join(debugDir, 'result.json'), JSON.stringify(result, null, 2), 'utf-8');
            }

            // Extract HTML content from CDATA section
            let htmlContent = '';
            if (result && result.contents && result.contents._) {
                htmlContent = result.contents._;
            }

            if (!htmlContent) {
                outputChannel.appendLine("⚠️ Extracted HTML is empty, possible parsing error");
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

            outputChannel.appendLine(`✅ Successfully retrieved ${Object.keys(courses).length} terms with courses`);
            return courses;

        } catch (error) {
            outputChannel.appendLine(`❌ Error parsing courses: ${error}`);
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
                outputChannel.appendLine(`❌ Failed to get course page: ${response.status}`);
                return {};
            }

            const finalUrl = response.url;
            outputChannel.appendLine(`🔀 Redirected to: ${finalUrl}`);

            // Parse HTML
            const html = await response.text();
            const $ = cheerio.load(html);

            // Debug: Save full HTML page
            if (this.debug) {
                const debugDir = path.join(os.homedir(), 'vscode-bb-debug');
                if (!fs.existsSync(debugDir)) {
                    fs.mkdirSync(debugDir, { recursive: true });
                }
                fs.writeFileSync(path.join(debugDir, 'debug-site-page.html'), html, 'utf-8');
            }

            // Extract sidebar structure
            const sidebarStructure = this.extractSidebarLinks($);

            if (this.debug && Object.keys(sidebarStructure).length > 0) {
                const debugDir = path.join(os.homedir(), 'vscode-bb-debug');
                fs.writeFileSync(path.join(debugDir, 'sidebar_links.json'),
                    JSON.stringify(sidebarStructure, null, 4), 'utf-8');
            }

            return sidebarStructure;

        } catch (error) {
            outputChannel.appendLine(`❌ Failed to get course sidebar: ${error}`);
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
            outputChannel.appendLine("❌ Course menu not found");
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
                outputChannel.appendLine(`❌ Failed to get page content: ${response.status}`);
                return {};
            }

            const finalUrl = response.url;
            outputChannel.appendLine(`🔀 Redirected to: ${finalUrl}`);

            // Parse HTML
            const html = await response.text();
            const $ = cheerio.load(html);

            // Extract file structure
            const pageContent = this.extractFileStructure($);

            if (this.debug) {
                const debugDir = path.join(os.homedir(), 'vscode-bb-debug');
                if (!fs.existsSync(debugDir)) {
                    fs.mkdirSync(debugDir, { recursive: true });
                }

                // Save JSON and HTML for debugging
                fs.writeFileSync(path.join(debugDir, 'extracted_files.json'),
                    JSON.stringify(pageContent, null, 4), 'utf-8');
                fs.writeFileSync(path.join(debugDir, 'debug-page-page.html'), html, 'utf-8');
            }

            return pageContent;

        } catch (error) {
            outputChannel.appendLine(`❌ Failed to get page content: ${error}`);
            return {};
        }
    }

    /**
     * Extract file structure from page HTML
     */
    private extractFileStructure($: cheerio.CheerioAPI | cheerio.Root): PageStructure {
        if (!$) {
            outputChannel.appendLine("❌ Parsing failed, cannot extract file structure");
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
                outputChannel.appendLine(`❌ Download request failed: ${response.status} ${response.statusText}`);
                return false;
            }

            // 4. Get content length for progress tracking
            const contentLength = parseInt(response.headers.get('content-length') || '0', 10);

            // 5. Create a write stream
            const fileStream = fs.createWriteStream(safeFilePath);

            // 6. Setup progress tracking in debug mode
            if (this.debug && contentLength > 0) {
                outputChannel.appendLine(`⬇️ Downloading: ${fileName} (${(contentLength / 1024 / 1024).toFixed(2)} MB)`);
            }

            // 7. Pipe the response to file
            await pipelineAsync(
                response.body as unknown as NodeJS.ReadableStream,
                fileStream
            );

            if (this.debug) {
                outputChannel.appendLine(`✅ Download complete: ${safeFilePath}`);
            }
            return true;

        } catch (error) {
            outputChannel.appendLine(`❌ Download failed: ${url} - ${error}`);

            // 8. If file was partially created, delete it
            if (fs.existsSync(safeFilePath)) {
                try {
                    fs.unlinkSync(safeFilePath);
                } catch (unlinkError) {
                    outputChannel.appendLine(`⚠️ Could not delete incomplete file: ${safeFilePath}`);
                }
            }

            return false;
        }
    }
}
