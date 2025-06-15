
import * as vscode from "vscode";
import { Schedule, STORE_KEY } from "../models/CalendarModels";
import { CalendarItem } from "../../frontend/CalendarView";

/**
 * Toggles the `done` state of a calendar item.
 *
 * @param context VS Code extension context.
 * @param item    The calendar item to toggle.
 */
export async function toggleCalendar(
  context: vscode.ExtensionContext,
  item: CalendarItem
): Promise<void> {
  const map: Record<string, Schedule> = context.workspaceState.get(STORE_KEY, {});
  const data = item.getSchedule();

  if (!map[data.uid]) {
    return;
  }

  map[data.uid].done = !map[data.uid].done;
  await context.workspaceState.update(STORE_KEY, map);
}

