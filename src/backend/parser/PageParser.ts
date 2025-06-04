import * as cheerio from 'cheerio';
import { PageContent } from '../models/Models';

/**
 * Extracts file-centric structure from a Blackboard content page.
 *
 * @param html Raw HTML of the page.
 * @returns    Structured {@link PageContent}.
 */
export function parsePage(html: string): PageContent {
  const $ = cheerio.load(html);
  const page: PageContent = {};

  $('li.clearfix.liItem.read').each((_, li) => {
    const h3 = $(li).find('h3').first();
    if (!h3.length) {return;}

    const section = h3.text().trim();
    if (!section) {return;}

    // Extract text description
    const text = cleanText($(li).find('div.vtbegenerated_div').html() ?? '');

    // Collect files (excluding links inside the h3 itself)
    const files: Array<{ name: string; url: string }> = [];
    $(li)
      .find('a[href]')
      .filter((__, a) => !$(a).closest('h3').length)
      .each((__, a) => {
        const name = $(a).text().trim();
        const url = toAbsolute($(a).attr('href') ?? '');
        if (name && url) {files.push({ name, url });}
      });

    // Fallback: single file whose link is the h3 title
    if (files.length === 0) {
      const link = h3.find('a[href]').first();
      if (link.length) {
        files.push({
          name: section,
          url: toAbsolute(link.attr('href') ?? ''),
        });
      }
    }

    if (files.length) {
      page[section] = { text, files };
    }
  });

  return page;
}

function toAbsolute(href: string): string {
  return href.startsWith('http')
    ? href
    : `https://bb.sustech.edu.cn${href}`;
}

/** Converts rich-text innerHTML to plain text with line breaks. */
function cleanText(raw: string): string {
  return raw
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .trim();
}
