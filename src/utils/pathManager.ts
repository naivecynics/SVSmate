import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

type FolderKey = 'bb' | 'todo' | 'cache';
type FileKey = 'bbCookies' | 'todoList';

let rootPath = '';

const folders: Record<FolderKey, string> = {
  bb: '',
  todo: '',
  cache: '',
};

const files: Record<FileKey, string> = {
  bbCookies: '',
  todoList: ''
};

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
  folders.cache = path.join(root, '.cache');

  files.bbCookies = path.join(folders.cache, 'cookies.json');
  files.todoList = path.join(folders.todo, 'tasks.json');
}

export function getDir(key: FolderKey): string {
  const folderPath = folders[key];
  if (!fs.existsSync(folderPath)) {
    fs.mkdirSync(folderPath, { recursive: true });
  }
  return folderPath;
}

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

export function getRoot(): string {
  return rootPath;
}

export function getWorkspaceDir(): string {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    throw new Error('No workspace folder is open.');
  }
  return workspaceFolders[0].uri.fsPath;
}
