import * as assert from 'assert';
import * as vscode from 'vscode';

suite('Example Test Suite', () => {
  test('Sample test pipeline pass!', () => {
    assert.strictEqual([1, 2, 3].indexOf(5), -1);
    assert.strictEqual([1, 2, 3].indexOf(0), -1);
  });
});

