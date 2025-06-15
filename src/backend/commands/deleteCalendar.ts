import * as vscode from "vscode";
import { Schedule, STORE_KEY } from "../models/CalendarModels";
import { CalendarItem } from "../../frontend/CalendarView";

/**
 * Deletes a specific calendar item (by CalendarItem), or all calendar items if no item is passed.
 *
 * @param context VS Code extension context (used for workspaceState access).
 * @param item    Optional CalendarItem. If provided, only this item will be deleted.
 */
export async function deleteCalendar(
  context: vscode.ExtensionContext,
  item?: CalendarItem
): Promise<void> {
  const map: Record<string, Schedule> = context.workspaceState.get(STORE_KEY, {});

  if (item) {
    const schedule = item.getSchedule();

    if (!map[schedule.uid]) {
      vscode.window.showWarningMessage("Calendar item not found.");
      return;
    }

    delete map[schedule.uid];
    await context.workspaceState.update(STORE_KEY, map);
    // vscode.window.showInformationMessage(`Deleted: ${schedule.title}`);
  } else {
    const confirmed = await vscode.window.showWarningMessage(
      "Are you sure you want to delete all calendar items?",
      { modal: true },
      "Delete All"
    );
    if (confirmed !== "Delete All") {
      return;
    }

    await context.workspaceState.update(STORE_KEY, {});
    vscode.window.showInformationMessage("All calendar items deleted.");
  }
}
