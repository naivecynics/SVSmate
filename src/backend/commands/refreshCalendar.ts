import * as vscode from "vscode";
import { Schedule, STORE_KEY } from "../models/CalendarModels";
import { fetchIcsText }            from "../services/CalendarService";
import { parseIcs }                from "../parser/CalendarParser";
import { syncCalendar }            from "./syncCalendar";
import { log }        from '../../utils/OutputChannel';

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
  vscode.window.showInformationMessage(
    `Calendar updated – ${incoming.length} events synchronised.`,
  );
  return;
}
