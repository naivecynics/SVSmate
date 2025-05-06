"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const assert = __importStar(require("assert"));
// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
const vscode = __importStar(require("vscode"));
const pathUtils_1 = require("../utils/pathUtils");
suite('Extension Test Suite', () => {
    vscode.window.showInformationMessage('Start all tests.');
    test('Sample test', () => {
        assert.strictEqual(-1, [1, 2, 3].indexOf(5));
        assert.strictEqual(-1, [1, 2, 3].indexOf(0));
    });
});
suite('PathUtils Test Suite', () => {
    suite('safe function', () => {
        test('replaces illegal characters with underscores', () => {
            assert.strictEqual((0, pathUtils_1.safe)('file<>:"/\\|?*name'), 'file_________name');
            // Test control characters (0x00-0x1F)
            assert.strictEqual((0, pathUtils_1.safe)('file\u0000\u001Fname'), 'file__name');
        });
        test('prepends underscore to reserved names', () => {
            assert.strictEqual((0, pathUtils_1.safe)('CON'), '_CON');
            assert.strictEqual((0, pathUtils_1.safe)('con'), '_con'); // Case insensitive check
            assert.strictEqual((0, pathUtils_1.safe)('COM1'), '_COM1');
            assert.strictEqual((0, pathUtils_1.safe)('LPT9'), '_LPT9');
            // Non-reserved name should remain unchanged
            assert.strictEqual((0, pathUtils_1.safe)('regular'), 'regular');
        });
        test('removes leading and trailing spaces and dots', () => {
            assert.strictEqual((0, pathUtils_1.safe)('  filename  '), 'filename');
            assert.strictEqual((0, pathUtils_1.safe)('..filename..'), 'filename');
            assert.strictEqual((0, pathUtils_1.safe)(' . filename . '), 'filename');
        });
        test('returns underscore for empty or fully sanitized strings', () => {
            assert.strictEqual((0, pathUtils_1.safe)(''), '_');
            assert.strictEqual((0, pathUtils_1.safe)('...'), '_');
            assert.strictEqual((0, pathUtils_1.safe)('   '), '_');
        });
        test('truncates names longer than 255 characters', () => {
            const longName = 'a'.repeat(300);
            const result = (0, pathUtils_1.safe)(longName);
            assert.strictEqual(result.length, 255);
            assert.strictEqual(result, 'a'.repeat(255));
        });
    });
    // suite('safeEnsureDir function', () => {
    // 	// Mock fs module methods
    // 	let existsSyncOriginal: typeof fs.existsSync;
    // 	let mkdirSyncOriginal: typeof fs.mkdirSync;
    // 	let mockExistsReturn: boolean;
    // 	let existsSyncCalls: string[];
    // 	let mkdirSyncCalls: Array<{ path: string, options?: any }>;
    // 	setup(() => {
    // 		existsSyncOriginal = fs.existsSync;
    // 		mkdirSyncOriginal = fs.mkdirSync;
    // 		mockExistsReturn = false;
    // 		existsSyncCalls = [];
    // 		mkdirSyncCalls = [];
    // 		// Mock fs.existsSync
    // 		fs.existsSync = (pathLike: fs.PathLike): boolean => {
    // 			existsSyncCalls.push(pathLike.toString());
    // 			return mockExistsReturn;
    // 		};
    // 		// Mock fs.mkdirSync
    // 		fs.mkdirSync = (pathLike: fs.PathLike, options?: fs.MakeDirectoryOptions | number): void => {
    // 			mkdirSyncCalls.push({
    // 				path: pathLike.toString(),
    // 				options: options
    // 			});
    // 		};
    // 	});
    // 	teardown(() => {
    // 		// Restore original functions
    // 		fs.existsSync = existsSyncOriginal;
    // 		fs.mkdirSync = mkdirSyncOriginal;
    // 	});
    // 	test('creates directory with sanitized name if it does not exist', () => {
    // 		mockExistsReturn = false; // Directory doesn't exist
    // 		const basePath = '/test/path';
    // 		const dirName = 'unsafe:name?';
    // 		const expectedPath = path.join(basePath, safe(dirName));
    // 		const result = safeEnsureDir(basePath, dirName);
    // 		// Check the returned path
    // 		assert.strictEqual(result, expectedPath);
    // 		// Check that existsSync was called correctly
    // 		assert.strictEqual(existsSyncCalls.length, 1);
    // 		assert.strictEqual(existsSyncCalls[0], expectedPath);
    // 		// Check that mkdirSync was called with the right parameters
    // 		assert.strictEqual(mkdirSyncCalls.length, 1);
    // 		assert.strictEqual(mkdirSyncCalls[0].path, expectedPath);
    // 		assert.deepStrictEqual(mkdirSyncCalls[0].options, { recursive: true });
    // 	});
    // 	test('returns path without creating directory if it already exists', () => {
    // 		mockExistsReturn = true; // Directory already exists
    // 		const basePath = '/test/path';
    // 		const dirName = 'unsafe:name?';
    // 		const expectedPath = path.join(basePath, safe(dirName));
    // 		const result = safeEnsureDir(basePath, dirName);
    // 		// Check the returned path
    // 		assert.strictEqual(result, expectedPath);
    // 		// Check that existsSync was called correctly
    // 		assert.strictEqual(existsSyncCalls.length, 1);
    // 		assert.strictEqual(existsSyncCalls[0], expectedPath);
    // 		// Check that mkdirSync was NOT called
    // 		assert.strictEqual(mkdirSyncCalls.length, 0);
    // 	});
    // });
});
//# sourceMappingURL=extension.test.js.map