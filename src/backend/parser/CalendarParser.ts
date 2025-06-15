import * as ical from "node-ical";
import { Schedule } from "../models/CalendarModels";

/**
 * Convert a `node-ical` VEVENT into a lightweight {@link Schedule}.
 * 
 * @param ev Event from node-ical parser.
 */
export function toCalendarItem(ev: ical.VEvent): Schedule {
  return {
    uid: ev.uid ?? crypto.randomUUID(),
    title: ev.summary ?? "(untitled)",
    start: ev.start.toISOString(),
    end: ev.end.toISOString(),
    done: false,
  };
}

/**
 * Parse raw ICS text and return a list of {@link Schedule}s.
 * 
 * @param icsText Raw `.ics` file content.
 */
export function parseIcs(icsText: string): Schedule[] {
  const parsed = ical.parseICS(icsText);
  const items: Schedule[] = [];

  for (const key in parsed) {
    const entry = parsed[key];
    if (entry.type === "VEVENT" && entry.start && entry.end) {
      items.push(toCalendarItem(entry as ical.VEvent));
    }
  }

  return items;
}
