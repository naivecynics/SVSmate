import { BBFetch } from '../http/BBFetch';
import { parseCourseList } from '../parser/CourseListParser';
import { parseSidebar } from '../parser/SidebarParser';
import { parsePage } from '../parser/PageParser';
import {
  CoursesByTerm,
  Sidebar,
  PageContent,
} from '../models/CourseModels';

/**
 * High-level façade that coordinates HTTP calls and parsers
 * to provide ready-to-use course data for the VS Code command layer.
 */
export class CourseService {
  /**
   * @param fetch  Pre-authenticated HTTP client.
   */
  constructor(private readonly fetch: BBFetch) {}

  /**
   * Retrieves all courses grouped by term.
   */
  async listCourses(): Promise<CoursesByTerm> {
    const body = new URLSearchParams({
      action: 'refreshAjaxModule',
      modId: '_3_1',
      tabId: '_1_1',
      tab_tab_group_id: '_1_1',
    });

    const res = await this.fetch.post(
      'https://bb.sustech.edu.cn/webapps/portal/execute/tabs/tabAction',
      body,
    );
    if (res.status !== 200) {throw new Error('Failed to fetch course list');}
    const xml = await res.text();
    return parseCourseList(xml);
  }

  /**
   * Parses the sidebar of a single course.
   *
   * @param courseURL Absolute URL of the course entry page.
   */
  async getSidebar(courseURL: string): Promise<Sidebar> {
    const res = await this.fetch.get(courseURL, { redirect: 'follow' });
    if (res.status !== 200) {throw new Error('Failed to fetch course page');}
    const html = await res.text();
    return parseSidebar(html);
  }

  /**
   * Retrieves a content page and converts it into structured data.
   *
   * @param pageURL Absolute URL of the Blackboard content page.
   */
  async getPage(pageURL: string): Promise<PageContent> {
    const res = await this.fetch.get(pageURL, { redirect: 'follow' });
    if (res.status !== 200) {throw new Error('Failed to fetch page');}
    const html = await res.text();
    return parsePage(html);
  }
}
