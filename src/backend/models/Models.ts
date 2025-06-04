/**
 * Plain-text announcement attached to a Blackboard course.
 */
export interface Announcement {
  /** Announcement text, stripped of HTML. */
  content: string;
  /** Absolute URL of the announcement page. */
  url: string;
}

/**
 * Blackboard course metadata returned by the API / scraper.
 */
export interface Course {
  /** Display name shown in Blackboard. */
  name: string;
  /** Absolute entry URL of the course. */
  url: string;
  /** Most recent announcement, if any (empty strings if none). */
  announcement: Announcement;
}

/**
 * Map of term identifier to its courses.  
 * The key is the term ID used in your folder names (e.g. `25spring`).
 */
export type CoursesByTerm = Record<string, Course[]>;

/**
 * A single link inside the course sidebar.
 */
export interface SidebarLink {
  /** Human-readable title shown in the UI. */
  title: string;
  /** Absolute URL of the target page. */
  url: string;
}

/**
 * Parsed sidebar tree.  
 * Key = section title (e.g. “Course Content”);  
 * Value = array of links under that section.
 */
export type Sidebar = Record<string, SidebarLink[]>;

/**
 * Rich-content block inside a Blackboard page.
 */
export interface PageSection {
  /** Text content converted from the original HTML. */
  text: string;
  /** Attached files in this block. */
  files: Array<{ name: string; url: string }>;
}

/**
 * Parsed page structure.  
 * Key = block title (“Week 01”);  
 * Value = block content and attachments.
 */
export type PageContent = Record<string, PageSection>;
