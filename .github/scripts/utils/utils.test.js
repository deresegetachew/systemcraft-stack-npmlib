import { describe, it, mock, afterEach, beforeEach } from 'node:test';
import assert from 'node:assert';
import path from 'node:path';
import {
    extractMajorBumpPackagesFromChangesets,
    getPackageInfo,
    loadChangesetFiles,
    sanitizePackageDir,
    runShellCommand,
} from './utils.js';

describe('utils.js', () => {
    let mockFsApi;

    beforeEach(() => {
        mockFsApi = {
            existsSync: mock.fn(),
            readdirSync: mock.fn(),
            readFileSync: mock.fn(),
        };
    });

    afterEach(() => {
        mock.reset();
    });

    describe('extractMajorBumpPackagesFromChangesets()', () => {
        it('should return an empty set for empty input', () => {
            const result = extractMajorBumpPackagesFromChangesets([]);
            assert.deepStrictEqual(result, new Set());
        });

        it('should extract a single major bump package', () => {
            const files = [{ content: '---\n"@scope/pkg-one": major\n---' }];
            const result = extractMajorBumpPackagesFromChangesets(files);
            assert.deepStrictEqual(result, new Set(['@scope/pkg-one']));
        });

        it('should extract multiple major bump packages from different files', () => {
            const files = [
                { content: '---\n"@scope/pkg-one": major\n---' },
                { content: '---\n"@scope/pkg-two": major\n---' },
                { content: '---\n"@scope/pkg-three": minor\n---' },
            ];
            const result = extractMajorBumpPackagesFromChangesets(files);
            assert.deepStrictEqual(result, new Set(['@scope/pkg-one', '@scope/pkg-two']));
        });

        it('should handle various formatting of the major bump line', () => {
            const files = [{ content: '  "@scope/pkg-one" : major  ' }];
            const result = extractMajorBumpPackagesFromChangesets(files);
            assert.deepStrictEqual(result, new Set(['@scope/pkg-one']));
        });

        it('should ignore invalid lines', () => {
            const files = [{ content: "'@scope/pkg-one': major" }]; // single quotes are not matched
            const result = extractMajorBumpPackagesFromChangesets(files);
            assert.deepStrictEqual(result, new Set());
        });
    });

    describe('getPackageInfo()', () => {
        it('should return null if package.json does not exist', () => {
            mockFsApi.existsSync.mock.mockImplementation(() => false);
            const result = getPackageInfo('@scope/pkg-one', mockFsApi, process.cwd());
            assert.strictEqual(result, null);
        });

        it('should return package info if package.json exists', () => {
            mockFsApi.existsSync.mock.mockImplementation(() => true);
            mockFsApi.readFileSync.mock.mockImplementation(() => JSON.stringify({ version: '1.2.3' }));

            const result = getPackageInfo('@scope/pkg-one', mockFsApi, process.cwd());

            const expected = {
                version: '1.2.3',
                dirName: 'pkg-one',
            };
            assert.deepStrictEqual(result, expected);
        });
    });

    describe('loadChangesetFiles()', () => {
        it('should return an empty array if .changeset directory does not exist', () => {
            mockFsApi.existsSync.mock.mockImplementation(() => false);
            const result = loadChangesetFiles(mockFsApi, process.cwd());
            assert.deepStrictEqual(result, []);
        });

        it('should load and read changeset files', () => {
            mockFsApi.existsSync.mock.mockImplementation(() => true);
            mockFsApi.readdirSync.mock.mockImplementation(() => ['one.md', 'two.md', 'README.md']);
            mockFsApi.readFileSync.mock.mockImplementation((p) => {
                if (p.endsWith('one.md')) return 'content one';
                if (p.endsWith('two.md')) return 'content two';
                return '';
            });

            const result = loadChangesetFiles(mockFsApi, process.cwd());

            const expected = [
                { filename: 'one.md', content: 'content one' },
                { filename: 'two.md', content: 'content two' },
            ];
            assert.deepStrictEqual(result, expected);
        });
    });

    describe('sanitizePackageDir()', () => {
        it('should handle simple names', () => {
            assert.strictEqual(sanitizePackageDir('pkg-one'), 'pkg-one');
        });

        it('should handle scoped package names', () => {
            assert.strictEqual(sanitizePackageDir('@scope/pkg-one'), 'at-scope__pkg-one');
        });

        it('should handle multiple slashes and at-signs', () => {
            assert.strictEqual(sanitizePackageDir('@scope/@nested/pkg'), 'at-scope__at-nested__pkg');
        });
    });

    describe('runShellCommand()', () => {
        it('should call the provided shell function with the command and options', () => {
            const mockShellFn = mock.fn();
            const cmd = 'echo "hello"';
            const options = { stdio: 'pipe' };

            runShellCommand(cmd, mockShellFn, options);

            assert.strictEqual(mockShellFn.mock.callCount(), 1);
            assert.strictEqual(mockShellFn.mock.calls[0].arguments[0], cmd);
            assert.deepStrictEqual(mockShellFn.mock.calls[0].arguments[1], options);
        });
    });
});