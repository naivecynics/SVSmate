import * as cheerio from 'cheerio';
import { parseStringPromise } from 'xml2js';
import {
  Course,
  CoursesByTerm,
  Announcement,
} from '../models/Course';

/**
 * Parses the XML response returned by Blackboard’s “refreshAjaxModule”
 * endpoint and converts it to a `{ termId → Course[] }` map.
 *
 * @param xml  Raw XML body.
 * @returns    Structured course list.
 */
export async function parseCourseList(xml: string): Promise<CoursesByTerm> {
  // 1. The XML wraps an HTML blob inside `<contents>`
  const parsed = await parseStringPromise(xml, {
    explicitArray: false,
    trim: true,
    explicitCharkey: true,
  }) as { contents?: { _: string } };

  const html = parsed?.contents?._ ?? '';
  const $ = cheerio.load(html);

  const terms: CoursesByTerm = {};

  $('h3.termHeading-coursefakeclass').each((_, h3) => {
    const termName = $(h3).text().trim();
    const termId = normaliseTerm(termName);
    terms[termId] = [];

    const anchor = $(h3).find('a[id]');
    const idMatch = anchor.attr('id')?.match(/termCourses__\d+_\d+/);
    if (!idMatch) return;
    const listId = `_3_1${idMatch[0]}`;
    const listDiv = $(`div#${listId}`);

    listDiv.find('li').each((__, li) => {
      const a = $(li).find('a[href]').first();
      if (!a.length || a.attr('href')?.includes('announcement')) return;

      const name = a.text().trim();
      const url = absolute(a.attr('href') ?? '');

      const announcement: Announcement = { content: '', url: '' };
      const block = $(li).find('div.courseDataBlock');
      if (block.length) {
        block.find('span.dataBlockLabel').remove();
        const ann = block.find('a[href]').first();
        if (ann.length) {
          announcement.content = ann.text().trim();
          announcement.url = absolute(ann.attr('href') ?? '');
        }
      }

      const course: Course = { name, url, announcement };
      terms[termId]!.push(course);
    });
  });

  return terms;
}

/** Converts relative URL to absolute one. */
function absolute(href: string): string {
  return href.startsWith('http')
    ? href
    : `https://bb.sustech.edu.cn${href}`;
}

/** Derives folder-style term ID, e.g. `（Spring 2025）` → `25spring`. */
function normaliseTerm(termName: string): string {
  const m = termName.match(/（(Spring|Fall|Summer|Winter)\s+(\d{4})）/);
  if (!m) return termName; // fallback
  const season = m[1].toLowerCase();
  const year = m[2].slice(-2);
  return `${year}${season}`;
}
