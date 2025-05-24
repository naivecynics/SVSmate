import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

type FolderKey = 'bb' | 'todo' | 'notes' | 'debug' | 'cache';
type FileKey = 'bbCookies' | 'todoList';

let rootPath = '';

const folders: Record<FolderKey, string> = {
  bb: '',
  todo: '',
  notes: '',
  debug: '',
  cache: '',
};

const files: Record<FileKey, string> = {
  bbCookies: '',
  todoList: ''
};

/**
 * Initializes the path manager with the given VS Code extension context.
 * Sets up root paths and folder/file mappings based on configuration or defaults.
 * @param context - The VS Code extension context.
 */
export function initPathManager(context: vscode.ExtensionContext) {
  let root = vscode.workspace.getConfiguration('svsmate').get('root') as string | undefined;

  if (!root || root.trim() === '') {
    root = context.globalStorageUri.fsPath;
  } else if (root.startsWith('~')) {
    root = path.join(os.homedir(), root.slice(1));
  }

  rootPath = root;

  folders.bb = path.join(root, 'bb-vault');
  folders.todo = path.join(root, 'todo');
  folders.notes = path.join(root, 'notes');
  folders.debug = path.join(root, 'debug');
  folders.cache = path.join(root, '.cache');

  files.bbCookies = path.join(folders.cache, 'cookies.json');
  files.todoList = path.join(folders.todo, 'tasks.json');
}

/**
 * Retrieves the directory path for a given folder key.
 * Ensures the directory exists by creating it if necessary.
 * @param key - The key representing the folder.
 * @returns The absolute path to the folder.
 */
export function getDir(key: FolderKey): string {
  const folderPath = folders[key];
  if (!fs.existsSync(folderPath)) {
    fs.mkdirSync(folderPath, { recursive: true });
  }
  return folderPath;
}

/**
 * Retrieves the file path for a given file key.
 * Ensures the file and its parent directory exist, creating them if necessary.
 * @param key - The key representing the file.
 * @param defaultContent - The default content to write if the file does not exist.
 * @returns The absolute path to the file.
 */
export function getFile(key: FileKey, defaultContent: object = {}): string {
  const filePath = files[key];
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(defaultContent, null, 2), 'utf-8');
  }
  return filePath;
}

/**
 * Retrieves the root path set by the path manager.
 * @returns The root path as a string.
 */
export function getRoot(): string {
  return rootPath;
}

/**
 * Retrieves the path of the first workspace folder.
 * Throws an error if no workspace folder is open.
 * @returns The absolute path to the workspace folder.
 */
export function getWorkspaceDir(): string {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    throw new Error('No workspace folder is open.');
  }
  return workspaceFolders[0].uri.fsPath;
}
