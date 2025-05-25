import * as assert from 'assert';
import { createSubtasksWithAI } from '../../backend/ai/createSubtasks';
import { generateCodeFromText } from '../../backend/ai/pdfCodeGenerator';
import { suggestTargetPath } from '../../backend/ai/suggestTargetPath';

suite('AI Utility Tests', () => {

    test('should be defined and a function', () => {
        assert.strictEqual(typeof createSubtasksWithAI, 'function');
    });

    test('should be defined and a function', () => {
        assert.strictEqual(typeof generateCodeFromText, 'function');
    });

    test('should be defined and a function', () => {
        assert.strictEqual(typeof suggestTargetPath, 'function');
    });

});
