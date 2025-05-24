import * as vscode from 'vscode';
import * as cheerio from 'cheerio';
import * as path from 'path';
import * as fs from 'fs';
import { CookieJar } from 'tough-cookie';
import { outputChannel } from '../../utils/OutputChannel';
import * as PathManager from '../../utils/pathManager';
import fetchCookie from 'fetch-cookie';
import * as tough from 'tough-cookie';
import { promisify } from 'util';
import { pipeline } from 'stream';
import fetch from 'node-fetch';
import xml2js from 'xml2js';

// Type definition for Cheerio root object
type CheerioRoot = ReturnType<typeof cheerio.load>;
const pipelineAsync = promisify(pipeline);

/**
 * Interface representing an announcement in a Blackboard course.
 */
interface Announcement {
    /** The content/text of the announcement. */
    content: string;
    /** The URL to the full announcement. */
    url: string;
}

/**
 * Interface representing a Blackboard course.
 */
interface Course {
    /** The name/title of the course. */
    name: string;
    /** The URL to access the course. */
    url: string;
    /** The latest announcement for the course. */
    announcement: Announcement;
}

/**
 * Interface representing the structure of courses organized by academic terms.
 * @example
 * {
 *   "23spring": [{name: "CS101", url: "...", announcement: {...}}],
 *   "23fall": [{name: "CS102", url: "...", announcement: {...}}]
 * }
 */
interface CoursesByTerm {
    /** Key is term name (e.g., "23spring"), value is array of courses. */
    [termName: string]: Course[];
}

/**
 * Interface representing the structure of a course's sidebar menu.
 * Contains categories (like "Content", "Assignments") and their associated links.
 */
interface SidebarCategory {
    /** Key is category name, value is either an array of links or a direct URL string. */
    [categoryName: string]: Array<{ title: string; url: string }> | string;
}

/**
 * Interface representing the content of a single page in Blackboard.
 */
interface PageContent {
    /** The text content of the page. */
    text: string;
    /** Array of files attached to the page. */
    files: Array<{ name: string; url: string }>;
}

/**
 * Interface representing the structure of a Blackboard page.
 * Maps section titles to their content.
 */
interface PageStructure {
    /** Key is section title, value is the content of that section. */
    [sectionTitle: string]: PageContent;
}

/**
 * The main class for interacting with Blackboard via web scraping and automation.
 * Handles login, cookie management, and course retrieval.
 */
export class BlackboardCrawler {
    /** Base URL for Blackboard instance. */
    private baseUrl: string;
    /** URL for login endpoint. */
    private loginUrl: string;
    /** URL for CAS authentication. */
    private casUrl: string;
    /** URL for course list. */
    private courseListUrl: string;
    /** HTTP headers used in requests. */
    private headers: Record<string, string>;
    /** Flag to enable debug output. */
    private debug: boolean;
    /** Cookie jar for session management. */
    private cookieJar: CookieJar;
    /** Fetch function with cookie support. */
    private fetch: typeof fetch;
    /** Path to cookie storage file. */
    private cookieFilePath: string;

    /**
     * Creates a new instance of BlackboardCrawler.
     * @param enableDebug - Enable or disable debug output (default: false).
     */
    constructor(enableDebug: boolean = false) {
        this.baseUrl = "https://bb.sustech.edu.cn";
        this.loginUrl = `${this.baseUrl}/webapps/login/`;
        this.casUrl = "https://cas.sustech.edu.cn/cas/login";
        this.courseListUrl = `${this.baseUrl}/webapps/portal/execute/tabs/tabAction`;
        this.headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        };
        this.debug = enableDebug;
        this.cookieFilePath = PathManager.getFile('bbCookies');
        // Load cookie jar from file or create a new one
        this.cookieJar = this.loadCookieJar();
        // Explicitly type fetch with the necessary types
        const fetchWithCookie = fetchCookie(fetch);
        // Use fetchWithCookie where needed
        this.fetch = fetchWithCookie as unknown as typeof fetch;
    }

    /**
     * Load cookie jar from file if it exists, or create a new one.
     * @returns The loaded or newly created cookie jar.
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
     * Save the cookie jar to a file for persistence between sessions.
     */
    private saveCookieJar(): void {
        try {
            const json = this.cookieJar.serializeSync();
            fs.writeFileSync(this.cookieFilePath, JSON.stringify(json));

            if (this.debug) {
                outputChannel.info('saveCookieJar', 'Cookies saved successfully');
            }
        } catch (error) {
            outputChannel.error('saveCookieJar', `Failed to save cookies: ${error}`);
        }
    }

    /**
     * Checks if the user is already logged into Blackboard.
     * @returns true if logged in, false otherwise.
     */
    public async checkLogin(): Promise<boolean> {
        try {
            const response = await this.fetch(`${this.baseUrl}/ultra/course`, {
                headers: this.headers,
                redirect: 'manual'
            });

            if (response.status === 200) {
                outputChannel.info('checkLogin', 'User is logged in');
                return true;
            }

            if (response.status === 302) {
                const location = response.headers.get('location') || '';
                if (location.includes('cas.sustech.edu.cn')) {
                    outputChannel.info('checkLogin', 'User is not logged in, needs CAS authentication');
                    return false;
                }
            }

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
     * Completes the CAS login process for Blackboard.
     * @param context - The extension context used to store credentials.
     * @returns true if login is successful, false otherwise.
     */
    public async login(context: vscode.ExtensionContext): Promise<boolean> {
        try {
            const credentials = await this.getCredentials(context);
            if (!credentials) {
                return false;
            }

            const casParams = await this.prepareCasAuthentication();
            if (!casParams) {
                outputChannel.error('login', 'Failed to prepare CAS authentication');
                return false;
            }

            const ticketUrl = await this.authenticateWithCas(
                credentials.username,
                credentials.password,
                casParams.execution
            );

            if (!ticketUrl) {
                vscode.window.showErrorMessage("Authentication failed. Please check your credentials.");
                return false;
            }

            const validationSuccess = await this.validateServiceTicket(ticketUrl);
            if (!validationSuccess) {
                vscode.window.showErrorMessage("Failed to validate CAS ticket");
                return false;
            }

            this.saveCookieJar();
            vscode.window.showInformationMessage("Successfully logged in to Blackboard!");
            return true;
        } catch (error) {
            outputChannel.error('login', `Login process failed: ${error}`);
            vscode.window.showErrorMessage(`Login error: ${error instanceof Error ? error.message : String(error)}`);
            return false;
        }
    }

    /**
     * Ensures the user is logged in, retrying login if necessary after clearing cookies.
     * @param context - The extension context used to store credentials.
     * @returns true if login is successful, false otherwise.
     */
    async ensureLogin(context: vscode.ExtensionContext): Promise<boolean> {
        let alreadyLoggedIn = await this.checkLogin();
        if (alreadyLoggedIn) { return true; }

        let loginSuccess = await this.login(context);
        if (loginSuccess) { return true; }

        try {
            const cookieFile = PathManager.getFile('bbCookies');
            if (fs.existsSync(cookieFile)) {
                fs.unlinkSync(cookieFile);
            }
            vscode.window.showWarningMessage('Login failed once, retrying after clearing cookies...');
        } catch (err) {
            console.error('Failed to delete cookie file:', err);
        }

        loginSuccess = await this.login(context);
        if (!loginSuccess) { vscode.window.showErrorMessage('Failed to login to Blackboard after retry. Check your VPN status.'); }

        return loginSuccess;
    }

    /**
     * Retrieves user credentials from storage or prompts for them if not found.
     * @param context - The extension context used for credential storage.
     * @returns The credentials object containing username and password, or null if credentials are not available.
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
                vscode.window.showErrorMessage('Username and password are required!');
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
    * Prepares the CAS authentication by extracting the execution parameter from the CAS login page.
    * 
    * @returns The execution parameter required for CAS login, or null if it fails to retrieve it.
    */
    private async prepareCasAuthentication(): Promise<{ execution: string } | null> {
        try {
            // Create the service URL that CAS will redirect to after successful authentication
            const serviceUrl = encodeURIComponent(this.loginUrl);
            const casLoginUrl = `${this.casUrl}?service=${serviceUrl}`;

            // Fetch the CAS login page
            const response = await this.fetch(casLoginUrl, {
                headers: this.headers,
                redirect: 'follow'
            });

            // Check if the response is successful
            if (response.status !== 200) {
                outputChannel.error('prepareCasAuthentication', `Failed to get CAS login page: ${response.status}`);
                return null;
            }

            // Parse the HTML to extract the execution parameter
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
    * Submits user credentials to the CAS server to authenticate the user.
    * 
    * @param username - The username to be used for authentication.
    * @param password - The password associated with the username.
    * @param execution - The execution parameter obtained from the CAS login page.
    * @returns The URL containing the service ticket if authentication is successful, or null if authentication fails.
    */
    private async authenticateWithCas(username: string, password: string, execution: string): Promise<string | null> {
        try {
            // Prepare the CAS login URL with the service parameter
            const serviceUrl = encodeURIComponent(this.loginUrl);
            const casLoginUrl = `${this.casUrl}?service=${serviceUrl}`;

            // Prepare the form data for authentication
            const formData = new URLSearchParams();
            formData.append('username', username);
            formData.append('password', password);
            formData.append('execution', execution);
            formData.append('_eventId', "submit");
            formData.append('geolocation', "");
            formData.append('submit', "登录");

            // Submit the form to CAS
            const response = await this.fetch(casLoginUrl, {
                method: 'POST',
                headers: {
                    ...this.headers,
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: formData,
                redirect: 'manual' // Don't follow redirects automatically
            });

            // Check if authentication was successful (302 redirect to a ticket URL)
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

                // If location contains ticket, the authentication was successful
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
    * Validates the CAS service ticket to complete the login process.
    * 
    * @param ticketUrl - The URL containing the service ticket received after authentication.
    * @returns true if ticket validation is successful, false otherwise.
    */
    private async validateServiceTicket(ticketUrl: string): Promise<boolean> {
        try {
            // Follow the redirect with the ticket to complete the authentication process
            const response = await this.fetch(ticketUrl, {
                headers: this.headers,
                redirect: 'follow'
            });

            // Check if we were successfully logged in (status 200)
            if (response.status === 200) {
                const finalUrl = response.url;

                // Verify we're on Blackboard (not an error page)
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

    /**
    * Retrieves the list of courses grouped by term from the Blackboard portal.
    * 
    * @returns An object with courses grouped by term. Returns an empty object if the request fails.
    */
    public async getCoursesByTerm(): Promise<CoursesByTerm> {
        // Prepare request payload for the course list
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

            // Parse the XML response to extract HTML content
            const parser = new xml2js.Parser({
                explicitArray: false,
                trim: true,
                explicitCharkey: true,
                explicitRoot: true
            });

            if (this.debug) {
                const debugFilePath = path.join(PathManager.getDir('debug'), 'courseList.xml');
                fs.writeFileSync(debugFilePath, xmlData);
                outputChannel.info('getCoursesByTerm', `XML data saved to ${debugFilePath}`);
            }

            const result = await parser.parseStringPromise(xmlData);

            // Extract HTML content from the parsed XML
            let htmlContent = '';
            if (result && result.contents && result.contents._) {
                htmlContent = result.contents._;
            }

            if (!htmlContent) {
                outputChannel.warn('getCoursesByTerm', "Couldn't extract HTML content from response");
                return {};
            }

            // Parse the HTML content with cheerio to extract course data
            const $ = cheerio.load(htmlContent);
            const courses: CoursesByTerm = {};

            // Iterate through all terms and their courses
            $('h3.termHeading-coursefakeclass').each((_, term) => {
                const termName = $(term).text().trim();
                let termId = termName; // Use full term name as fallback

                const match = termName.match(/（(Spring|Fall|Summer|Winter) (\d{4})）/);
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
                            // Iterate through the course items in the list
                            courseListDiv.find('li').each((_, courseLi) => {
                                const courseLink = $(courseLi).find('a[href]').first();

                                // Skip announcements
                                if (!courseLink.length || courseLink.attr('href')?.includes('announcement')) {
                                    return;
                                }

                                const courseName = courseLink.text().trim();
                                const courseUrl = courseLink.attr('href')?.trim() || '';
                                const fullCourseUrl = courseUrl.startsWith('http') 
                                    ? courseUrl 
                                    : `https://bb.sustech.edu.cn${courseUrl}`;

                                const announcement: Announcement = { content: '', url: '' };
                                const courseDataBlock = $(courseLi).find('div.courseDataBlock');

                                if (courseDataBlock.length) {
                                    const spanLabel = courseDataBlock.find('span.dataBlockLabel');
                                    if (spanLabel.length) {
                                        spanLabel.remove();
                                    }

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

            // Save cookies after successful retrieval of courses
            this.saveCookieJar();

            outputChannel.info('getCoursesByTerm', `Successfully retrieved ${Object.keys(courses).length} terms with courses`);
            return courses;

        } catch (error) {
            outputChannel.error('getCoursesByTerm', `Failed to get courses: ${error}`);
            return {};
        }
    }

    /**
     * Get course sidebar menu structure.
     * @param url - The URL of the course page from which to extract the sidebar menu.
     * @returns An object representing the sidebar structure, categorized by the sidebar menu.
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
                return {};
            }

            const finalUrl = response.url;

            // Parse the HTML content
            const html = await response.text();
            const $ = cheerio.load(html);

            // Extract sidebar structure
            const sidebarStructure = this.extractSidebarLinks($);
            return sidebarStructure;

        } catch (error) {
            return {};
        }
    }

    /**
    * Extract the sidebar links from the course HTML page.
    * 
    * @param $ - The cheerio-loaded HTML content.
    * @returns An object representing the sidebar categories and their corresponding links.
    */
    private extractSidebarLinks($: CheerioRoot): SidebarCategory {
        const sidebarMenu: SidebarCategory = {};

        // Find the course menu
        const menuUl = $('#courseMenuPalette_contents');
        if (!menuUl.length) {
            return {};
        }

        // Extract course ID (for building correct announcements link)
        const htmlString = $.html();
        const courseIdMatch = htmlString.match(/course_id=(_\d+_\d+)/);
        const courseId = courseIdMatch ? courseIdMatch[1] : null;

        let currentCategory: string | null = null;

        // Iterate through each menu item
        menuUl.find('li').each((_: number, element) => {
            const categoryTag = $(element).find('h3');
            if (categoryTag.length) {
                currentCategory = categoryTag.text().trim();
                if (currentCategory) {
                    sidebarMenu[currentCategory] = [];
                }
                return; // Skip further parsing for this item
            }

            // Handle course content links
            const linkTag = $(element).find('a[href]');
            if (linkTag.length) {
                const linkText = linkTag.text().trim();
                let linkUrl = linkTag.attr('href') || '';

                // Make sure the URL is absolute
                if (!linkUrl.startsWith('http')) {
                    linkUrl = `https://bb.sustech.edu.cn${linkUrl}`;
                }

                // Special handling for announcements (replace URL)
                if (linkText.includes('Announcements') && courseId) {
                    linkUrl = `https://bb.sustech.edu.cn/webapps/blackboard/execute/announcement?method=search&context=course_entry&course_id=${courseId}&handle=announcements_entry&mode=view`;
                }

                // Add to the current category
                if (currentCategory && Array.isArray(sidebarMenu[currentCategory])) {
                    (sidebarMenu[currentCategory] as Array<{ title: string; url: string }>).push({
                        title: linkText,
                        url: linkUrl
                    });
                } else {
                    sidebarMenu[linkText] = linkUrl;
                }
            }
        });

        return sidebarMenu;
    }

    /**
    * Retrieve content from a page and parse its structure.
    * 
    * @param url - The URL of the page to fetch and parse.
    * @returns An object representing the page content structure.
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
                outputChannel.error('getPageContent', `Failed to fetch page. Status: ${response.status}`);
                return {};
            }

            const finalUrl = response.url;

            // Parse the HTML content
            const html = await response.text();
            const $ = cheerio.load(html);

            if (this.debug
                && finalUrl === 'https://bb.sustech.edu.cn/webapps/blackboard/content/listContent.jsp?course_id=_7065_1&content_id=_531840_1&mode=reset') {
                const debugDir = PathManager.getDir('debug');
                const debugFilePath = path.join(debugDir, `page.html`);
                fs.writeFileSync(debugFilePath, html);
                outputChannel.info('getPageContent', `HTML data saved to ${debugFilePath}`);
            }

            // Extract file structure from the page content
            const pageContent = this.extractFileStructure($);
            return pageContent;

        } catch (error) {
            return {};
        }
    }

    /**
    * Extract the file structure from the page HTML content.
    * 
    * @param $ - The cheerio-loaded HTML content.
    * @returns An object representing the file structure with text and file links.
    */
    private extractFileStructure($: CheerioRoot): PageStructure {
        if (!$) {
            return {};
        }

        const fileStructure: PageStructure = {};

        // Iterate through list items containing the content
        $('li.clearfix.liItem.read').each((_: number, item) => {
            const weekTitleTag = $(item).find('h3');
            if (!weekTitleTag.length) { return; }

            const titleText = weekTitleTag.text().trim();

            const vtbDiv = $(item).find('div.vtbegenerated_div');
            let content = '';
            if (vtbDiv.length) {
                let rawText = vtbDiv.html() || '';
                rawText = rawText.replace(/<br\s*\/?>/gi, '\n')
                    .replace(/<[^>]+>/g, '')
                    .replace(/&nbsp;/g, ' ')
                    .replace(/[ \t]+/g, ' ')
                    .trim();
                const meaningfulText = rawText.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]+/g, '');
                content = meaningfulText.length >= 10 ? rawText : '';
            }

            const files: Array<{ name: string; url: string }> = [];

            // Extract all file links (skip those inside h3 tags)
            const attachedFiles = $(item).find('a[href]').filter((_, el) => {
                return !$(el).closest('h3').length;
            });

            if (attachedFiles.length > 0) {
                attachedFiles.each((_: number, fileLink) => {
                    const $fileLink = $(fileLink);
                    const fileName = $fileLink.text().trim();
                    let fileUrl = $fileLink.attr('href')?.trim() || '';

                    if (fileUrl && !fileUrl.startsWith('http')) {
                        fileUrl = `https://bb.sustech.edu.cn${fileUrl}`;
                    }

                    if (fileName && fileUrl) {
                        files.push({ name: fileName, url: fileUrl });
                    }
                });
            } else {
                // Handle the case for single file (fallback)
                const linkTag = weekTitleTag.find('a[href]');
                if (linkTag.length) {
                    let fileUrl = linkTag.attr('href')?.trim() || '';
                    if (fileUrl && !fileUrl.startsWith('http')) {
                        fileUrl = `https://bb.sustech.edu.cn${fileUrl}`;
                    }
                    if (titleText && fileUrl) {
                        files.push({ name: titleText, url: fileUrl });
                    }
                }
            }

            // Store the content and files for each week
            if (titleText && files.length > 0) {
                fileStructure[titleText] = {
                    text: content,
                    files: files
                };
            }
        });

        if (Object.keys(fileStructure).length === 0) {
            outputChannel.warn('extractFileStructure', `No valid files found on this page`);
        }

        return fileStructure;
    }

    /**
    * Download a file with progress tracking and save it to the specified path.
    * 
    * @param context - The extension context used for ensuring the login status.
    * @param url - The URL of the file to be downloaded.
    * @param savePath - The path where the file will be saved.
    * @returns true if the file was downloaded successfully, false otherwise.
    */
    public async downloadFile(context: vscode.ExtensionContext, url: string, savePath: string): Promise<boolean> {
        // Ensure user is logged in
        await this.ensureLogin(context);

        // Ensure the filename is safe (e.g., replace spaces with underscores)
        const fileName = path.basename(savePath).replace(/\s+/g, '_');
        const safeFilePath = path.join(path.dirname(savePath), fileName);

        // Ensure directory exists
        const directory = path.dirname(safeFilePath);
        if (!fs.existsSync(directory)) {
            fs.mkdirSync(directory, { recursive: true });
        }

        try {
            // Try to download the file
            const response = await this.fetch(url, {
                method: 'GET',
                redirect: 'follow',
                headers: this.headers
            });

            if (!response.ok) {
                return false;
            }

            // Get content length for progress tracking
            const contentLength = parseInt(response.headers.get('content-length') || '0', 10);

            // Create write stream for the downloaded file
            const fileStream = fs.createWriteStream(safeFilePath);

            // Track download progress in debug mode
            if (this.debug && contentLength > 0) {
                // outputChannel.appendLine(` Downloading: ${fileName} (${(contentLength / 1024 / 1024).toFixed(2)} MB)`);
            }

            // Pipe the file content to the file system
            await pipelineAsync(
                response.body as unknown as NodeJS.ReadableStream,
                fileStream
            );

            // Save cookies after successful download
            this.saveCookieJar();

            if (this.debug) {
                // outputChannel.appendLine(`Download complete: ${safeFilePath}`);
            }

            return true;

        } catch (error) {
            // Delete incomplete file if it exists
            if (fs.existsSync(safeFilePath)) {
                try {
                    fs.unlinkSync(safeFilePath);
                } catch (unlinkError) {
                    // outputChannel.appendLine(`Could not delete incomplete file: ${safeFilePath}`);
                }
            }

            return false;
        }
    }
}
