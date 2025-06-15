import * as vscode from 'vscode';

import { clearAccount } from './backend/commands/clearAccount';

import { updateCourse } from './backend/commands/updateCourse';
import { updateTerm } from './backend/commands/updateTerm';
import { downloadMaterial } from './backend/commands/downloadMaterial';
import { deleteMaterial } from './backend/commands/deleteMaterial';

import { syncCalendar } from './backend/commands/syncCalendar';
import { refreshCalendar } from "./backend/commands/refreshCalendar";
import { deleteCalendar } from "./backend/commands/deleteCalendar";

import { FolderViewProvider } from "./frontend/FolderView";
import { BBMaterialViewProvider, BBMaterialItem } from "./frontend/BBMaterialView";
import { CalendarViewProvider, CalendarItem } from "./frontend/CalendarView";
import { registerToggleCommand } from "./frontend/CalendarView";

import { log } from './utils/OutputChannel';
import * as PathManager from './utils/pathManager';
import { CredentialManager } from './backend/auth/CredentialManager';

export async function activate(context: vscode.ExtensionContext) {

    PathManager.initPathManager(context);
    const credentialManager = new CredentialManager(context);
    log.info('SVSmate Main', 'SVSmate activated!');

    // ------------------------------------------------
    //                      file
    // ------------------------------------------------
    const folderViewProvider = FolderViewProvider.create();
    folderViewProvider && vscode.window.registerTreeDataProvider("folderView", folderViewProvider);
    folderViewProvider && context.subscriptions.push(folderViewProvider);

    // ------------------------------------------------
    //                   blaskboard
    // ------------------------------------------------
    const bbMaterialViewProvider = BBMaterialViewProvider.create();
    vscode.window.registerTreeDataProvider("bbMaterialView", bbMaterialViewProvider);
    context.subscriptions.push(

        bbMaterialViewProvider,

        vscode.commands.registerCommand('svsmate.updateTerm', async (item: BBMaterialItem) => {
            await updateTerm(context, item);
        }),

        vscode.commands.registerCommand('svsmate.updateCourse', async (item: BBMaterialItem) => {
            await updateCourse(context, item);
        }),

        vscode.commands.registerCommand('svsmate.downloadMaterial', async (item: BBMaterialItem) => {
            await downloadMaterial(context, item);
        }),

        vscode.commands.registerCommand('svsmate.deleteMaterial', async (item: BBMaterialItem) => {
            await deleteMaterial(item);
        }),

        vscode.commands.registerCommand('svsmate.clearAccount', async () => {
            await clearAccount(context);
        }),

    );

    // ------------------------------------------------
    //                    calendar
    // ------------------------------------------------
    const calendarViewProvider = new CalendarViewProvider(context);
    vscode.window.registerTreeDataProvider('calendarView', calendarViewProvider);
    context.subscriptions.push(

      calendarViewProvider,

      vscode.commands.registerCommand("svsmate.syncCalendar", () => {
        syncCalendar(context);
      }),

      vscode.commands.registerCommand("svsmate.refreshCalendar", async () => {
        await refreshCalendar(context);
        calendarViewProvider.refresh();
      }),

      vscode.commands.registerCommand("svsmate.deleteCalendar", async (item: CalendarItem) => {
        deleteCalendar(context, item);
        calendarViewProvider.refresh();
      }),

    );

    /* toggle-done command */
    registerToggleCommand(context);
}

export function deactivate() { }
