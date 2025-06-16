import * as vscode from 'vscode';

import { clearAccount } from './backend/commands/clearAccount';

import { updateCourse } from './backend/commands/updateCourse';
import { updateTerm } from './backend/commands/updateTerm';
import { downloadMaterial } from './backend/commands/downloadMaterial';
import { deleteMaterial } from './backend/commands/deleteMaterial';

import { refreshCalendar } from "./backend/commands/refreshCalendar";
import { deleteCalendar } from "./backend/commands/deleteCalendar";
import { toggleCalendar } from "./backend/commands/toggleCalendar";

import { FolderViewProvider } from "./frontend/FolderView";
import { BBMaterialViewProvider, BBMaterialItem } from "./frontend/BBMaterialView";
import { CalendarViewProvider, CalendarItem } from "./frontend/CalendarView";
import { initStatusBar } from "./frontend/statusBarItem";

import { log } from './utils/OutputChannel';
import * as PathManager from './utils/pathManager';

export async function activate(context: vscode.ExtensionContext) {

    PathManager.initPathManager(context);
    log.info('SVSmate Main', 'SVSmate activated!');

    // ------------------------------------------------
    //                   credential
    // ------------------------------------------------
    initStatusBar(context);
    context.subscriptions.push(

        vscode.commands.registerCommand('svsmate.clearAccount', async () => {
            await clearAccount(context);
        }),
    
    );

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

        vscode.commands.registerCommand('svsmate.downloadMaterialToWorkspace', async (item: BBMaterialItem) => {
            await downloadMaterial(context, item, true);
        }),

        vscode.commands.registerCommand('svsmate.deleteMaterial', async (item: BBMaterialItem) => {
            await deleteMaterial(item);
        }),

    );

    // ------------------------------------------------
    //                    calendar
    // ------------------------------------------------
    const calendarViewProvider = new CalendarViewProvider(context);
    vscode.window.registerTreeDataProvider('calendarView', calendarViewProvider);
    context.subscriptions.push(

      vscode.commands.registerCommand("svsmate.refreshCalendar", async () => {
        await refreshCalendar(context);
        calendarViewProvider.refresh();
      }),

      vscode.commands.registerCommand("svsmate.deleteCalendar", async (item: CalendarItem) => {
        deleteCalendar(context, item);
        calendarViewProvider.refresh();
      }),

      vscode.commands.registerCommand("svsmate.toggleCalendar", async (item: CalendarItem) => {
        await toggleCalendar(context, item);
        calendarViewProvider.refresh();
      }),

    );
}

export function deactivate() { }
