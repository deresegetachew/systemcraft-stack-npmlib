import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { FsUtil } from './fs.util.js';

describe('FsUtil', () => {
    let mockFs;
    let fsUtil;

    beforeEach(() => {
        mockFs = {
            mkdir: async () => { },
            access: async () => { },
            readFile: async () => '{\"name\": \"test-package\"}'
        };
        fsUtil = new FsUtil(mockFs);
    });

    describe('ensureDir()', () => {
        it('should create directory with recursive option', async () => {
            let capturedPath;
            let capturedOptions;
            mockFs.mkdir = async (path, options) => {
                capturedPath = path;
                capturedOptions = options;
            };

            await fsUtil.ensureDir('/test/path');

            assert.strictEqual(capturedPath, '/test/path');
            assert.deepStrictEqual(capturedOptions, { recursive: true });
        });
    });

    describe('exists()', () => {
        it('should return true if path exists', async () => {
            mockFs.access = async () => { }; // No error means file exists

            const result = await fsUtil.exists('/test/path');

            assert.strictEqual(result, true);
        });

        it('should return false if path does not exist', async () => {
            mockFs.access = async () => { throw new Error('File not found'); };

            const result = await fsUtil.exists('/test/path');

            assert.strictEqual(result, false);
        });
    });

    describe('getPackageName()', () => {
        it('should return package name from package.json', async () => {
            mockFs.readFile = async () => '{"name": "test-package"}';

            const result = await fsUtil.getPackageName('/test/package');

            assert.strictEqual(result, 'test-package');
        });

        it('should return directory name if package.json is invalid', async () => {
            mockFs.readFile = async () => { throw new Error('File not found'); };

            const result = await fsUtil.getPackageName('/test/package-dir');

            assert.strictEqual(result, 'package-dir');
        });

        it('should return directory name if package name is invalid', async () => {
            mockFs.readFile = async () => '{"version": "1.0.0"}'; // No name field

            const result = await fsUtil.getPackageName('/test/package-dir');

            assert.strictEqual(result, 'package-dir');
        });
    });
});