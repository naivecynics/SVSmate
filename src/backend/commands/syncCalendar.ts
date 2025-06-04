import * as vscode from 'vscode';
import { CookieStore } from '../auth/CookieStore';
import { BBFetch }     from '../http/BBFetch';
import { CredentialManager } from '../auth/CredentialManager';
import { CasClient }  from '../auth/CasClient';
import { log }        from '../../utils/OutputChannel';
import * as PathManager from '../../utils/pathManager';

/** Blackboard endpoint that returns the personal *.ics* feed URL (text/plain). */
const CAL_FEED_ENDPOINT =
  'https://bb.sustech.edu.cn/webapps/calendar/calendarFeed/url';

/** SecretStorage key under which the ICS URL is stored. */
const SECRET_KEY = 'bb_ics_url';

/**
 * Entry‑point for the **svsmate.BB-syncCalendar** command.
 *
 * @param context VS Code extension context (needed for SecretStorage).
 */
export async function syncCalendar(context: vscode.ExtensionContext): Promise<void> {
  /* ── bootstrap HTTP / auth helpers ─────────────────────────────── */
  const cookieStore = new CookieStore(PathManager.getFile('bbCookies'));
  const fetch       = new BBFetch(cookieStore);

  const credMgr   = new CredentialManager(context);
  const casClient = new CasClient(fetch, credMgr);

  /* ── make sure we have a valid session before hitting the API ──── */
  if (!(await casClient.ensureLogin())) {
    vscode.window.showErrorMessage('Blackboard login failed – unable to sync calendar.');
    return;
  }

  /* ── call the plain‑text endpoint ──────────────────────────────── */
  const res = await fetch.get(CAL_FEED_ENDPOINT, { redirect: 'follow' });
  if (res.status !== 200) {
    log.error('syncCalendar', `HTTP ${res.status} while requesting feed URL`);
    vscode.window.showErrorMessage(`Failed to fetch calendar feed (HTTP ${res.status}).`);
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
  await context.secrets.store(SECRET_KEY, url);
  log.info('syncCalendar', 'ICS URL stored in SecretStorage');

  /* ── let the user decide what to do with it ────────────────────── */
  const choice = await vscode.window.showInformationMessage(
    'Blackboard calendar URL synced successfully.',
    'Copy to Clipboard',
    'Open in Browser',
  );

  switch (choice) {
    case 'Copy to Clipboard':
      await vscode.env.clipboard.writeText(url);
      vscode.window.showInformationMessage('Calendar URL copied to clipboard.');
      break;

    case 'Open in Browser':
      vscode.env.openExternal(vscode.Uri.parse(url));
      break;
  }
}
