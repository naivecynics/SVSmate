import * as vscode from 'vscode';
import * as cheerio from 'cheerio';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import axios from 'axios';
import { CookieJar } from 'tough-cookie';
import { wrapper } from 'axios-cookiejar-support';
// import { outputChannel } from '../extension';

interface Course {
    name: string;
    url: string;
    announcement?: Array<[string, string]>; // [text, url] pairs
}

interface CoursesByTerm {
    [term: string]: Course[];
}

interface FileEntry {
    name: string;
    url: string;
}

interface PageContent {
    text: string;
    files: FileEntry[];
}

interface PageStructure {
    [sectionTitle: string]: PageContent;
}

export async function crawlBB() {
    const crawler = new BlackboardCrawler(true); // Enable debug mode

    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'Logging into Blackboard...',
        cancellable: false
    }, async (progress) => {
        const loginSuccess = await crawler.login();
        if (!loginSuccess) {
            return;
        }

        progress.report({ message: 'Getting courses by term...' });
        const coursesByTerm = await crawler.getCoursesByTerm();

        if (Object.keys(coursesByTerm).length === 0) {
            vscode.window.showErrorMessage('No courses found or session expired');
            return;
        }

        // First, select a term
        const termItems = Object.keys(coursesByTerm).map(term => ({
            label: term,
            description: `${coursesByTerm[term].length} courses`
        }));

        const selectedTerm = await vscode.window.showQuickPick(termItems, {
            placeHolder: 'Select a term'
        });

        if (!selectedTerm) {
            return;
        }

        // Then select a course from that term
        const courseItems = coursesByTerm[selectedTerm.label].map(course => ({
            label: course.name,
            description: course.url,
            url: course.url
        }));

        const selectedCourse = await vscode.window.showQuickPick(courseItems, {
            placeHolder: `Select a course from ${selectedTerm.label}`
        });

        if (!selectedCourse) {
            return;
        }

        // Get the course structure
        progress.report({ message: `Getting structure for ${selectedCourse.label}...` });
        const sidebarMenu = await crawler.getCourseSidebarMenu(selectedCourse.url);

        if (Object.keys(sidebarMenu).length === 0) {
            vscode.window.showErrorMessage('Could not get course structure');
            return;
        }

        // Flatten the sidebar menu for the picker
        const menuItems: { label: string, description: string, url: string, section: string }[] = [];
        for (const section in sidebarMenu) {
            for (const item of sidebarMenu[section]) {
                menuItems.push({
                    label: item.title,
                    description: section,
                    url: item.url,
                    section: section
                });
            }
        }

        const selectedMenuItem = await vscode.window.showQuickPick(menuItems, {
            placeHolder: 'Select a content area to download'
        });

        if (!selectedMenuItem) {
            return;
        }

        // Get the content
        progress.report({ message: `Getting content from ${selectedMenuItem.label}...` });
        const pageContent = await crawler.getPageContent(selectedMenuItem.url);

        if (Object.keys(pageContent).length === 0) {
            vscode.window.showInformationMessage('No content found on this page');
            return;
        }

        // Ask for base download location
        const defaultDownloadPath = path.join(
            os.homedir(),
            'Downloads',
            'Blackboard',
            selectedTerm.label,
            selectedCourse.label.replace(/[\\/:*?"<>|]/g, '_'),
            selectedMenuItem.section.replace(/[\\/:*?"<>|]/g, '_'),
            selectedMenuItem.label.replace(/[\\/:*?"<>|]/g, '_')
        );

        const downloadFolder = await vscode.window.showInputBox({
            prompt: 'Enter download folder path',
            value: defaultDownloadPath
        });

        if (!downloadFolder) {
            return;
        }

        // Create the main folder
        if (!fs.existsSync(downloadFolder)) {
            fs.mkdirSync(downloadFolder, { recursive: true });
        }

        // Count total files to download
        let totalFiles = 0;
        for (const section in pageContent) {
            totalFiles += pageContent[section].files.length;
        }

        if (totalFiles === 0) {
            vscode.window.showInformationMessage('No files found in this section');

            // Still save text content
            for (const section in pageContent) {
                if (pageContent[section].text) {
                    const sectionFolder = path.join(downloadFolder, section.replace(/[\\/:*?"<>|]/g, '_'));
                    if (!fs.existsSync(sectionFolder)) {
                        fs.mkdirSync(sectionFolder, { recursive: true });
                    }

                    const textPath = path.join(sectionFolder, 'content.txt');
                    fs.writeFileSync(textPath, pageContent[section].text);
                }
            }
            return;
        }

        // Download all files and save text content
        progress.report({ message: `Downloading ${totalFiles} files...` });
        let downloadedCount = 0;
        let successCount = 0;

        for (const section in pageContent) {
            const sectionFolder = path.join(downloadFolder, section.replace(/[\\/:*?"<>|]/g, '_'));
            if (!fs.existsSync(sectionFolder)) {
                fs.mkdirSync(sectionFolder, { recursive: true });
            }

            // Save text content
            if (pageContent[section].text) {
                const textPath = path.join(sectionFolder, 'content.txt');
                fs.writeFileSync(textPath, pageContent[section].text);
            }

            // Download files
            for (const file of pageContent[section].files) {
                const savePath = path.join(sectionFolder, file.name);
                const success = await crawler.downloadFile(file.url, savePath);

                if (success) {
                    successCount++;
                }

                downloadedCount++;
                progress.report({
                    message: `Downloaded ${downloadedCount}/${totalFiles} files...`,
                    increment: 100 / totalFiles
                });
            }
        }

        vscode.window.showInformationMessage(
            `✅ Downloaded ${successCount}/${totalFiles} files to ${downloadFolder}`
        );
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
    private session: ReturnType<typeof wrapper>;

    constructor(enableDebug: boolean = false) {
        // Initialize crawler
        this.baseUrl = "https://bb.sustech.edu.cn";
        this.loginUrl = `${this.baseUrl}/webapps/login/`;
        this.casUrl = "https://cas.sustech.edu.cn/cas/login";
        this.courseListUrl = `${this.baseUrl}/webapps/portal/execute/tabs/tabAction`;
        this.headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        };
        this.debug = enableDebug;
        this.cookieJar = new CookieJar();
        this.session = wrapper(axios.create({ jar: this.cookieJar }));
    }

    /**
     * Login to Blackboard system via CAS authentication
     * @returns Promise<boolean> indicating login success
     */
    public async login(): Promise<boolean> {
        // Get username and password from user
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
            // Visit Blackboard login page to get CAS redirect
            const bbResponse = await this.session.get(this.loginUrl, this.headers);

            // Use the CAS login URL with service parameter
            const casLoginUrl = `${this.casUrl}?service=${encodeURIComponent(this.loginUrl)}`;

            const casResponse = await this.session.get(casLoginUrl, this.headers);

            // Get execution token
            const $ = cheerio.load(casResponse.data as string);
            const execution = $('input[name="execution"]').val();
            if (!execution) {
                vscode.window.showErrorMessage("❌ Cannot find execution parameter for CAS authentication");
                return false;
            }

            // Submit login form
            const casLoginData = new URLSearchParams({
                username: username,
                password: password,
                execution: execution.toString(),
                _eventId: "submit",
                geolocation: "",
                submit: "登录"
            });

            const casLoginResponse = await this.session.post(
                this.casUrl,
                casLoginData,
                {
                    headers: {
                        ...this.headers,
                        'Content-Type': 'application/x-www-form-urlencoded'
                    },
                    maxRedirects: 5
                }
            );

            // Verify login success
            const responseData = casLoginResponse.data as string;

            // outputChannel.appendLine("cas login response: " + responseData);

            if (responseData.includes("登出") || responseData.toLowerCase().includes("logout")) {
                vscode.window.showInformationMessage("✅ CAS authentication successful, logged into Blackboard!");
                return true;
            } else {
                vscode.window.showErrorMessage("❌ Login failed, possibly incorrect username or password");
                return false;
            }
        } catch (error) {
            vscode.window.showErrorMessage(`❌ Login error: ${error instanceof Error ? error.message : String(error)}`);
            return false;
        }
    }

    /**
     * Update headers with cookies
     */
    // private updateHeaders() {
    //     if (this.cookies.length > 0) {
    //         this.headers['Cookie'] = this.cookies.join('; ');
    //     }
    // }

    /**
     * Get course list from Blackboard organized by terms
     * @returns Promise<CoursesByTerm> Object with term names as keys and course arrays as values
     */
    public async getCoursesByTerm(): Promise<CoursesByTerm> {
        try {
            vscode.window.showInformationMessage("📡 Getting course list...");

            const payload = new URLSearchParams({
                action: "refreshAjaxModule",
                modId: "_3_1",
                tabId: "_1_1",
                tab_tab_group_id: "_1_1"
            });

            const response = await this.session.post(
                this.courseListUrl,
                payload,
                {
                    headers: this.headers
                }
            );

            // if (this.debug) {
            //     outputChannel.appendLine("courseLIstUrl: " + this.courseListUrl);
            //     outputChannel.appendLine("responese: " + response.data);
            // }

            if (response.status !== 200) {
                vscode.window.showErrorMessage("❌ Failed to load course list");
                return {};
            }

            // Save cookies
            // if (response.headers['set-cookie']) {
            //     this.cookies = this.cookies.concat(response.headers['set-cookie']);
            //     this.updateHeaders();
            // }

            const $ = cheerio.load(response.data as string);
            const coursesByTerm: CoursesByTerm = {};

            // Process each term section
            $('h3.termHeading-coursefakeclass').each((index, element) => {
                const termNameFull = $(element).text().trim();
                // Extract term code like "25spring" from term name
                const termMatch = termNameFull.match(/（(Spring|Fall|Summer|Winter) (\d{4})）/);

                let termCode = "unknown";
                if (termMatch) {
                    const season = termMatch[1].toLowerCase();
                    const year = termMatch[2].slice(-2); // Last two digits of year
                    termCode = `${year}${season}`;
                }

                coursesByTerm[termCode] = [];

                // Find the corresponding course list container
                const termIdMatch = $(element).find('a[id^="termToggle"]').attr('id');
                if (termIdMatch) {
                    const termContentId = termIdMatch.replace('termToggle', 'termCourses');
                    const courseListDiv = $(`#${termContentId}`);

                    // Process each course in this term
                    courseListDiv.find('li').each((i, courseElem) => {
                        const courseLink = $(courseElem).find('a[href*="course_id"]');
                        if (courseLink.length) {
                            const courseName = courseLink.text().trim();
                            const courseUrl = courseLink.attr('href') || '';
                            const fullCourseUrl = courseUrl.startsWith('/') ? `${this.baseUrl}${courseUrl}` : courseUrl;

                            coursesByTerm[termCode].push({
                                name: courseName,
                                url: fullCourseUrl
                            });
                        }
                    });
                }
            });

            // Debug output if enabled
            if (this.debug) {
                const debugDir = path.join(process.env.HOME || process.env.USERPROFILE || '', 'Downloads', 'BBMate', 'debug');
                if (!fs.existsSync(debugDir)) {
                    fs.mkdirSync(debugDir, { recursive: true });
                }
                fs.writeFileSync(path.join(debugDir, 'courses.json'), JSON.stringify(coursesByTerm, null, 2));
                vscode.window.showInformationMessage("✅ Debug: Course data saved to ~/Downloads/BBMate/debug/courses.json");
            }

            return coursesByTerm;
        } catch (error) {
            vscode.window.showErrorMessage(`❌ Error getting courses: ${error instanceof Error ? error.message : String(error)}`);
            return {};
        }
    }

    /**
     * Get course list from Blackboard (flat list for backward compatibility)
     * @returns Promise<Array<[string, string]>> Array of [courseName, courseUrl] pairs
     */
    public async getCourses(): Promise<Array<[string, string]>> {
        const coursesByTerm = await this.getCoursesByTerm();
        const flatCourses: Array<[string, string]> = [];

        // Flatten the courses by term structure
        for (const term in coursesByTerm) {
            for (const course of coursesByTerm[term]) {
                flatCourses.push([course.name, course.url]);
            }
        }

        return flatCourses;
    }

    /**
     * Extract sidebar menu structure from a course page
     * @param courseUrl URL of the course
     * @returns Promise<Record<string, Array<{title: string, url: string}>>> Sidebar menu structure
     */
    public async getCourseSidebarMenu(courseUrl: string): Promise<Record<string, Array<{ title: string, url: string }>>> {
        try {
            vscode.window.showInformationMessage(`📡 Processing course structure from ${courseUrl}...`);

            const response = await axios.get(courseUrl, {
                headers: this.headers,
                maxRedirects: 5
            });

            // Save cookies
            // if (response.headers['set-cookie']) {
            //     this.cookies = this.cookies.concat(response.headers['set-cookie']);
            //     this.updateHeaders();
            // }

            const $ = cheerio.load(response.data as string);
            const sidebarMenu: Record<string, Array<{ title: string, url: string }>> = {};

            // Extract course ID for handling announcements
            const courseIdMatch = courseUrl.match(/course_id=(_\d+_\d+)/);
            const courseId = courseIdMatch ? courseIdMatch[1] : null;

            // Find the course menu
            const menuUl = $('#courseMenuPalette_contents');
            if (!menuUl.length) {
                vscode.window.showWarningMessage("⚠️ Course menu not found on page");
                return {};
            }

            let currentCategory: string | null = null;

            menuUl.find('li').each((i, element) => {
                // Check if this is a category header
                const categoryHeader = $(element).find('h3');
                if (categoryHeader.length) {
                    currentCategory = categoryHeader.text().trim();
                    sidebarMenu[currentCategory] = [];
                    return; // Continue to next element
                }

                // Process menu item
                const linkTag = $(element).find('a[href]');
                if (linkTag.length) {
                    const linkText = linkTag.text().trim();
                    let linkUrl = linkTag.attr('href') || '';

                    // Make sure URL is absolute
                    if (linkUrl.startsWith('/')) {
                        linkUrl = `${this.baseUrl}${linkUrl}`;
                    }

                    // Special handling for Announcements
                    if (linkText.includes("Announcements") && courseId) {
                        linkUrl = `${this.baseUrl}/webapps/blackboard/execute/announcement?method=search&context=course_entry&course_id=${courseId}&handle=announcements_entry&mode=view`;
                    }

                    // Add to current category or directly to menu
                    if (currentCategory) {
                        sidebarMenu[currentCategory].push({
                            title: linkText,
                            url: linkUrl
                        });
                    } else {
                        // If no category is active, create a default one
                        if (!sidebarMenu['Main']) {
                            sidebarMenu['Main'] = [];
                        }
                        sidebarMenu['Main'].push({
                            title: linkText,
                            url: linkUrl
                        });
                    }
                }
            });

            // Debug output if enabled
            if (this.debug) {
                const debugDir = path.join(process.env.HOME || process.env.USERPROFILE || '', 'Downloads', 'BBMate', 'debug');
                if (!fs.existsSync(debugDir)) {
                    fs.mkdirSync(debugDir, { recursive: true });
                }
                fs.writeFileSync(
                    path.join(debugDir, 'sidebar_menu.json'),
                    JSON.stringify(sidebarMenu, null, 2)
                );
            }

            return sidebarMenu;
        } catch (error) {
            vscode.window.showErrorMessage(`❌ Error extracting sidebar menu: ${error instanceof Error ? error.message : String(error)}`);
            return {};
        }
    }

    /**
     * Extract content structure from a course page
     * @param pageUrl URL of the page
     * @returns Promise<PageStructure> Content structure with sections and files
     */
    public async getPageContent(pageUrl: string): Promise<PageStructure> {
        try {
            vscode.window.showInformationMessage(`📡 Extracting content from ${pageUrl}...`);

            const response = await axios.get(pageUrl, {
                headers: this.headers,
                maxRedirects: 5
            });

            // Save cookies
            // if (response.headers['set-cookie']) {
            //     this.cookies = this.cookies.concat(response.headers['set-cookie']);
            //     this.updateHeaders();
            // }

            const $ = cheerio.load(response.data as string);
            const pageStructure: PageStructure = {};

            // Extract items from the page
            $('li.clearfix.liItem.read').each((i, element) => {
                // Get section title
                const titleTag = $(element).find('h3');
                if (!titleTag.length) { return; }

                const sectionTitle = titleTag.text().trim();
                let contentText = "";

                // Extract text content
                const detailsDiv = $(element).find('div.details');
                if (detailsDiv.length) {
                    contentText = detailsDiv.text().trim();
                }

                // Extract files
                const files: FileEntry[] = [];
                $(element).find('li a[href]').each((j, fileLink) => {
                    const href = $(fileLink).attr('href') || '';
                    const name = $(fileLink).text().trim();

                    // Skip invalid links
                    if (href.startsWith('#') || href.includes('close') || !name) {
                        return;
                    }

                    // Make sure URL is absolute
                    const fileUrl = href.startsWith('/') ? `${this.baseUrl}${href}` : href;

                    files.push({
                        name,
                        url: fileUrl
                    });
                });

                // Save section data
                pageStructure[sectionTitle] = {
                    text: contentText,
                    files
                };
            });

            // Debug output if enabled
            if (this.debug) {
                const debugDir = path.join(process.env.HOME || process.env.USERPROFILE || '', 'Downloads', 'BBMate', 'debug');
                if (!fs.existsSync(debugDir)) {
                    fs.mkdirSync(debugDir, { recursive: true });
                }
                fs.writeFileSync(
                    path.join(debugDir, 'page_content.json'),
                    JSON.stringify(pageStructure, null, 2)
                );
                fs.writeFileSync(
                    path.join(debugDir, 'page_html.html'),
                    response.data as string
                );
            }

            return pageStructure;
        } catch (error) {
            vscode.window.showErrorMessage(`❌ Error extracting page content: ${error instanceof Error ? error.message : String(error)}`);
            return {};
        }
    }

    /**
     * Get PDF files from a course
     * @param courseUrl URL of the course
     * @returns Promise<Array<[string, string]>> Array of [pdfName, pdfUrl] pairs
     */
    public async getCoursePdfs(courseUrl: string): Promise<Array<[string, string]>> {
        try {
            vscode.window.showInformationMessage(`📡 Crawling materials from ${courseUrl}...`);

            // First check if we need to re-login by trying to access the course
            const response = await axios.get(courseUrl, {
                headers: this.headers,
                maxRedirects: 0,
                validateStatus: (status) => status >= 200 && status < 400
            });

            // Save cookies
            // if (response.headers['set-cookie']) {
            //     this.cookies = this.cookies.concat(response.headers['set-cookie']);
            //     this.updateHeaders();
            // }

            // If we get redirected to CAS, we need to re-login
            const finalUrl = response.headers.location || '';
            if (finalUrl.includes('cas.sustech.edu.cn')) {
                vscode.window.showWarningMessage("⚠️ Session expired, need to login again");
                return [];
            }

            const $ = cheerio.load(response.data as string);
            const pdfs: Array<[string, string]> = [];

            // Find all PDF files
            $('a[href]').each((index: number, element: cheerio.Element) => {
                const href = $(element).attr('href') || '';
                if (href.endsWith('.pdf') || href.includes('/bbcswebdav/')) {
                    let name = $(element).text().trim();
                    if (!name) {
                        name = path.basename(href);
                    }

                    const pdfUrl = href.startsWith('/') ? `${this.baseUrl}${href}` : href;
                    pdfs.push([name, pdfUrl]);
                }
            });

            return pdfs;
        } catch (error) {
            vscode.window.showErrorMessage(`❌ Error getting PDFs: ${error instanceof Error ? error.message : String(error)}`);
            return [];
        }
    }

    /**
     * Download a file from Blackboard
     * @param fileUrl URL of the file
     * @param savePath Path to save the file
     * @returns Promise<boolean> indicating download success
     */
    public async downloadFile(fileUrl: string, savePath: string): Promise<boolean> {
        try {
            // Make filename safe
            const dirname = path.dirname(savePath);
            const basename = path.basename(savePath).replace(/[\\/:*?"<>|]/g, '_');
            const safePath = path.join(dirname, basename);

            // Ensure directory exists
            if (!fs.existsSync(dirname)) {
                fs.mkdirSync(dirname, { recursive: true });
            }

            vscode.window.showInformationMessage(`⬇️ Downloading ${basename}...`);

            const response = await axios.get(fileUrl, {
                headers: this.headers,
                responseType: 'arraybuffer'
            });

            if (response.status === 200) {
                fs.writeFileSync(safePath, Buffer.from(response.data as ArrayBuffer));
                vscode.window.showInformationMessage(`✅ ${basename} download complete!`);
                return true;
            } else {
                vscode.window.showErrorMessage(`❌ Download failed: ${fileUrl}, status code: ${response.status}`);
                return false;
            }
        } catch (error) {
            vscode.window.showErrorMessage(`❌ Error downloading file: ${error instanceof Error ? error.message : String(error)}`);
            return false;
        }
    }
}
