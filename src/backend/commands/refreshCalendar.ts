import * as vscode from "vscode";
import { Schedule, STORE_KEY } from "../models/CalendarModels";
import { fetchIcsText }            from "../services/CalendarService";
import { parseIcs }                from "../parser/CalendarParser";
import { log }        from '../../utils/OutputChannel';
import { CookieStore } from '../auth/CookieStore';
import { BBFetch }     from '../http/BBFetch';
import { CredentialManager } from '../auth/CredentialManager';
import { CasClient }  from '../auth/CasClient';
import * as PathManager from '../../utils/pathManager';

/** Blackboard endpoint that returns the personal *.ics* feed URL (text/plain). */
const CAL_FEED_ENDPOINT =
  'https://bb.sustech.edu.cn/webapps/calendar/calendarFeed/url';

/**
 * Refresh Blackboard calendar items stored in `workspaceState`.
 *
 * @param context VS Code extension context (used for state + SecretStorage).
 * @returns The number of events synchronised, `0` on failure.
 */
export async function refreshCalendar(
  context: vscode.ExtensionContext,
): Promise<void> {

  /* ── obtain (or sync) personal feed URL ───────────────────────── */
  let url = await context.secrets.get(STORE_KEY);
  if (!url) {
    await syncCalendar(context);                 // will store into secrets on success
    url = await context.secrets.get(STORE_KEY);
    if (!url) { return; }                      // user cancelled / login failed
  }

  /* ── download *.ics* text ─────────────────────────────────────── */
  let ics: string;
  try {
    ics = await fetchIcsText(url);
  } catch (err) {
    vscode.window.showErrorMessage(`Calendar download failed: ${err}`);
    return;
  }

  /* ── parse & merge into workspaceState ────────────────────────── */
  const incoming = parseIcs(ics);
  const store: Record<string, Schedule> =
    context.workspaceState.get(STORE_KEY, {});

  for (const ev of incoming) {
    store[ev.uid] = {
      ...(store[ev.uid] ?? ev),      // keep existing “done” flag if present
      ...ev,
      done: store[ev.uid]?.done ?? false,
    };
  }

  await context.workspaceState.update(STORE_KEY, store);

  log.info('refreshCalendar', `Calendar updated – ${incoming.length} events synchronised.`);
  vscode.window.showInformationMessage(`Calendar updated.`);
  return;
}

/**
 * Entry‑point for the **svsmate.BB-syncCalendar** command.
 *
 * @param context VS Code extension context (needed for SecretStorage).
 */
 async function syncCalendar(context: vscode.ExtensionContext): Promise<void> {
  /* ── bootstrap HTTP / auth helpers ─────────────────────────────── */
  const cookieStore = new CookieStore(PathManager.getFile('bbCookies'));
  const fetch       = new BBFetch(cookieStore);
  const credMgr   = new CredentialManager(context);
  const casClient = new CasClient(fetch, credMgr);

  /* ── make sure we have a valid session before hitting the API ──── */
  if (!(await casClient.ensureLogin())) {
    // vscode.window.showErrorMessage('Blackboard login failed – unable to sync calendar.');
    return;
  }

  /* ── call the plain‑text endpoint ──────────────────────────────── */
  const res = await fetch.get(CAL_FEED_ENDPOINT, { redirect: 'follow' });
  if (res.status !== 200) {
    log.error('syncCalendar', `HTTP ${res.status} while requesting feed URL`);
    // vscode.window.showErrorMessage(`Failed to fetch calendar feed (HTTP ${res.status}).`);
    return;
  }

  const url = (await res.text()).trim();
  const isValid = /^https?:\/\/.*\.ics(?:\?.*)?$/.test(url);
  if (!isValid) {
    log.error('syncCalendar', `Unexpected response body: «${url.slice(0, 120)}…»`);
    vscode.window.showErrorMessage('Blackboard responded with an invalid calendar URL.');
    return;
  }

  /* ── store in SecretStorage ────────────────────────────────────── */
  await context.secrets.store(STORE_KEY, url);
  log.info('syncCalendar', 'ICS URL stored in SecretStorage');

  /* ── let the user decide what to do with it ────────────────────── */
  // const choice = await vscode.window.showInformationMessage(
  //   'Blackboard calendar URL synced successfully.',
  //   'Copy to Clipboard',
  //   'Open in Browser',
  // );
  //
  // switch (choice) {
  //   case 'Copy to Clipboard':
  //     await vscode.env.clipboard.writeText(url);
  //     vscode.window.showInformationMessage('Calendar URL copied to clipboard.');
  //     break;
  //
  //   case 'Open in Browser':
  //     vscode.env.openExternal(vscode.Uri.parse(url));
  //     break;
  // }
}
