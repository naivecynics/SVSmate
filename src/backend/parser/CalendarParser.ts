import * as ical from "node-ical";
import { Schedule } from "../models/CalendarModels";

/**
 * Convert a `node-ical` VEVENT into a lightweight {@link Schedule}.
 * 
 * The UID is normalized to `title::end` for consistency and deduplication.
 * 
 * @param ev Event from node-ical parser.
 */
export function toSchedule(ev: ical.VEvent): Schedule {
  const title = ev.summary ?? "(untitled)";
  const end = ev.end.toISOString();

  return {
    uid: `${title}::${end}`,
    title,
    start: ev.start.toISOString(),
    end,
    done: false,
  };
}

/**
 * Parse raw ICS text and return a list of unique {@link Schedule}s.
 * 
 * If duplicate (title + end) exist, only the latest one is kept.
 * 
 * @param icsText Raw `.ics` file content.
 */
export function parseIcs(icsText: string): Schedule[] {
  const parsed = ical.parseICS(icsText);
  const seen = new Map<string, Schedule>();

  for (const key in parsed) {
    const entry = parsed[key];
    if (entry.type === "VEVENT" && entry.start && entry.end && entry.summary) {
      const item = toSchedule(entry as ical.VEvent);
      const uniqueKey = item.uid;

      const existing = seen.get(uniqueKey);
      if (!existing || new Date(item.end) > new Date(existing.end)) {
        seen.set(uniqueKey, item);
      }
    }
  }

  return Array.from(seen.values());
}

