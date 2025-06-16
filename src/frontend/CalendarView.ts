import * as vscode from "vscode";
import { Schedule, STORE_KEY } from "../backend/models/CalendarModels";
import { format } from "date-fns";

export class CalendarViewProvider
  implements vscode.TreeDataProvider<CalendarItem>, vscode.Disposable
{
  private readonly _onDidChangeTreeData = new vscode.EventEmitter<
    CalendarItem | undefined
  >();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(private readonly context: vscode.ExtensionContext) {}

  refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }

  getTreeItem(element: CalendarItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: CalendarItem): Promise<CalendarItem[]> {
    if (element) {return [];}

    const map: Record<string, Schedule> = this.context.workspaceState.get(
      STORE_KEY,
      {},
    );

    const future = Object.values(map).filter(
      i => new Date(i.end) > new Date(),
    );
    future.sort((a, b) => +new Date(a.end) - +new Date(b.end));

    return future.map(ev => new CalendarItem(ev, this.context));
  }

  dispose() {
    /* nothing yet */
  }
}

export class CalendarItem extends vscode.TreeItem {
  constructor(
    private readonly data: Schedule,
    private readonly ctx: vscode.ExtensionContext,
  ) {
    super(data.title, vscode.TreeItemCollapsibleState.None);
    this.contextValue = 'calendarItem';

    const ddl = format(new Date(data.end), "MM-dd HH:mm");
    this.description = ddl;
    this.tooltip = `${ddl} • ${data.title}`;

    this.resourceUri = vscode.Uri.parse("calendar:" + data.uid);
    this.command = {
      command: "svsmate.toggleCalendar",
      title: "Toggle done",
      arguments: [this],
    };

    if (data.done) {
      this.iconPath = new vscode.ThemeIcon("check", new vscode.ThemeColor("testing.iconPassed")); // ✔️
      this.label = data.title;
      this.tooltip += ' (Done)';
    } else {
      this.iconPath = new vscode.ThemeIcon("circle-large-outline", new vscode.ThemeColor("editorHint.foreground")); // ○
      this.label = data.title;
    }
  }
  getSchedule(): Schedule {
    return this.data;
  }
}
