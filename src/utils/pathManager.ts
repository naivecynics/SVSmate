/******************************************************************
 * utils/pathManager.ts
 *
 * A workspace-agnostic path helper for the SVS-Mate extension.
 * - Resolves a single **root directory** from user settings or the
 *   VS Code global-storage folder.
 * - Creates well-known sub-folders and default files at start-up.
 * - Exposes lightweight getters so the rest of the codebase never sees
 *   empty strings or needs to `mkdir`/`writeFile` defensively.
 ******************************************************************/

import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

/** Keys for folders that the extension manages. */
export type FolderKey = 'bb' | 'todo' | 'cache';

/** Keys for single files that live inside those folders. */
export type FileKey = 'bbCookies' | 'todoList';

/** Resolved absolute path to the extension root. */
let rootPath = '';

/** Folder map filled by {@link initPathManager}. */
const folders: Record<FolderKey, string> = {
  bb: '',
  todo: '',
  cache: '',
};

/** File map filled by {@link initPathManager}. */
const files: Record<FileKey, string> = {
  bbCookies: '',
  todoList: '',
};

/* ====================================================================== */
/* Public API                                                             */
/* ====================================================================== */

/**
 * **Must be called once** from `activate(context)` before any other getter.
 *
 * Resolution order for the root directory:
 * 1. `"svsmate.root"` setting (absolute or `~/` path)
 * 2. `context.globalStorageUri` (VS Code–managed per-extension folder)
 *
 * @param context The `ExtensionContext` passed to your `activate` function.
 */
export function initPathManager(context: vscode.ExtensionContext): void {
  /* 1 — read user setting */
  let cfg = vscode.workspace
    .getConfiguration('svsmate')
    .get<string>('root');

  /* 2 — resolve to an absolute path */
  if (!cfg || cfg.trim() === '') {
    rootPath = context.globalStorageUri.fsPath;
  } else if (cfg.startsWith('~')) {
    rootPath = path.join(os.homedir(), cfg.slice(1));
  } else {
    rootPath = path.resolve(cfg);
  }

  /* 3 — create sub-directories */
  folders.bb    = path.join(rootPath, 'bb-vault');
  folders.todo  = path.join(rootPath, 'todo');
  folders.cache = path.join(rootPath, '.cache');

  for (const dir of Object.values(folders)) {
    if (!fs.existsSync(dir)) {fs.mkdirSync(dir, { recursive: true });}
  }

  /* 4 — prepare default files */
  files.bbCookies = path.join(folders.cache, 'cookies.json');
  files.todoList  = path.join(folders.todo,  'tasks.json');

  ensureFile(files.bbCookies, {});
  ensureFile(files.todoList,  {});
}

/**
 * Returns the absolute path of a managed folder.
 * All folders are guaranteed to exist once {@link initPathManager} ran.
 *
 * @param key Folder identifier.
 */
export function getDir(key: FolderKey): string {
  return folders[key];
}

/**
 * Returns the absolute path of a managed file.
 * The file is created lazily with `defaultContent` (JSON-stringified)
 * only when it does not exist yet.
 *
 * @param key             File identifier.
 * @param defaultContent  Initial JSON content used on first run.
 * @returns               Absolute file path.
 */
export function getFile(
  key: FileKey,
  defaultContent: unknown = {},
): string {
  const filePath = files[key];
  ensureFile(filePath, defaultContent);
  return filePath;
}

/**
 * Absolute root directory resolved during {@link initPathManager}.
 */
export function getRoot(): string {
  return rootPath;
}

/**
 * Convenience wrapper: returns the first workspace folder’s path.
 * Throws if the user has no folder open.
 */
export function getWorkspaceDir(): string {
  const ws = vscode.workspace.workspaceFolders?.[0];
  if (!ws) {throw new Error('No workspace folder is open.');}
  return ws.uri.fsPath;
}

/* ====================================================================== */
/* Internal helpers                                                       */
/* ====================================================================== */

/**
 * Creates `file` on disk with `content` if it does not already exist.
 * Parent directories are created automatically.
 */
function ensureFile(file: string, content: unknown): void {
  if (fs.existsSync(file)) {return;}

  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(
    file,
    JSON.stringify(content, null, 2),
    'utf8',
  );
}
