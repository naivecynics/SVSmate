import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as vscode from 'vscode';
import {
  initPathManager,
  getDir,
  getFile,
  getRoot,
  getWorkspaceDir
} from '../../utils/pathManager';

suite('Path Manager Test Suite', () => {
  const testGlobalStorage = path.join(os.homedir(), '.svsmate', 'test-temp', 'storage');

  const mockContext: Partial<vscode.ExtensionContext> = {
    globalStorageUri: vscode.Uri.file(testGlobalStorage)
  };

  setup(() => {
    if (fs.existsSync(testGlobalStorage)) {
      fs.rmSync(testGlobalStorage, { recursive: true, force: true });
    }
    const testFilePath = path.join(os.homedir(), '.svsmate', '.cache', 'cookies.json');
    if (fs.existsSync(testFilePath)) {
      fs.unlinkSync(testFilePath);
    }
  });

  test('initPathManager() sets paths correctly (fallback to ~/.svsmate)', () => {
    initPathManager(mockContext as vscode.ExtensionContext);
    const root = getRoot();
    assert.strictEqual(root, path.join(os.homedir(), '.svsmate'));

    const bbDir = getDir('bb');
    assert.ok(fs.existsSync(bbDir));
  });

  test('getFile() creates file with default content', () => {
    initPathManager(mockContext as vscode.ExtensionContext);

    const filePath = getFile('bbCookies', { hello: 'world' });
    assert.ok(fs.existsSync(filePath));

    const contents = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    assert.deepStrictEqual(contents, { hello: 'world' });
  });

  test('getWorkspaceDir() returns workspace folder path', () => {
    const workspaceDir = getWorkspaceDir();
    assert.ok(workspaceDir.includes('testWorkspace'));
    assert.ok(fs.existsSync(workspaceDir));
  });
});
