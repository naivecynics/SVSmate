import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { safe, safeEnsureDir } from '../../utils/pathUtils';

suite('pathUtil Test Suite', () => {

  test('safe() replaces illegal characters', () => {
    const unsafe = 'some<>:"/\\|?*name';
    const expected = 'some_________name'; // 9 characters replaced
    assert.strictEqual(safe(unsafe), expected);
  });

  test('safe() leaves safe names untouched', () => {
    const name = 'normal_name';
    assert.strictEqual(safe(name), name);
  });

  test('safeEnsureDir() creates sanitized directory', () => {
    const tmp = path.join(__dirname, '..', '..', 'out', 'test-temp');
    const rawName = 'bad:/\\*?name';
    const expectedDir = path.join(tmp, safe(rawName));

    // Ensure no leftover
    if (fs.existsSync(expectedDir)) { fs.rmSync(expectedDir, { recursive: true, force: true }); }

    const result = safeEnsureDir(tmp, rawName);
    assert.strictEqual(result, expectedDir);
    assert.ok(fs.existsSync(expectedDir));
  });

});
