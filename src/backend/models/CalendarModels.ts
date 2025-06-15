/** Single event parsed from the Blackboard ICS feed (or user-added). */
export interface Schedule {
  /** Blackboard-generated UID (or random UUID on manual insert). */
  uid: string;
  /** Item title – taken from SUMMARY. */
  title: string;
  /** ISO string representing the start timestamp. */
  start: string;
  /** ISO string representing the end (deadline) timestamp. */
  end: string;
  /** User-controlled completion flag. */
  done: boolean;
}

/** Key under which the calendar map is stored in workspaceState. */
export const STORE_KEY = "bb_calendar";

/** SecretStorage key that holds the ICS feed url. */
export const SEC_ICS_URL = "bb_ics_url";
