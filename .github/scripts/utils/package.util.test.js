import { describe, it, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert';
import { PackageUtil } from './package.util.js';

describe('PackageUtil', () => {
    let mockFsApi;
    let packageUtil;

    beforeEach(() => {
        mockFsApi = {
            existsSync: mock.fn(),
            readdirSync: mock.fn(),
            readFileSync: mock.fn(),
        };
        packageUtil = new PackageUtil(mockFsApi);
    });

    afterEach(() => {
        mock.reset();
    });

    describe('getPackageInfo()', () => {
        it('should return null if package.json does not exist', () => {
            mockFsApi.existsSync.mock.mockImplementation(() => false);

            const result = packageUtil.getPackageInfo('@scope/pkg-one', process.cwd());

            assert.strictEqual(result, null);
        });

        it('should return package info if package.json exists', () => {
            mockFsApi.existsSync.mock.mockImplementation(() => true);
            mockFsApi.readFileSync.mock.mockImplementation(() => JSON.stringify({ version: '1.2.3' }));

            const result = packageUtil.getPackageInfo('@scope/pkg-one', process.cwd());

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

            const result = packageUtil.loadChangesetFiles(process.cwd());

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

            const result = packageUtil.loadChangesetFiles(process.cwd());

            const expected = [
                { filename: 'one.md', content: 'content one' },
                { filename: 'two.md', content: 'content two' },
            ];
            assert.deepStrictEqual(result, expected);
        });
    });

    describe('extractMajorBumpPackagesFromChangesets()', () => {
        it('should return an empty set for empty input', () => {
            const emptyFiles = [];

            const result = PackageUtil.extractMajorBumpPackagesFromChangesets(emptyFiles);

            assert.deepStrictEqual(result, new Set());
        });

        it('should extract a single major bump package', () => {
            const files = [{ content: '---\n"@scope/pkg-one": major\n---' }];

            const result = PackageUtil.extractMajorBumpPackagesFromChangesets(files);

            assert.deepStrictEqual(result, new Set(['@scope/pkg-one']));
        });

        it('should extract multiple major bump packages from different files', () => {
            const files = [
                { content: '---\n"@scope/pkg-one": major\n---' },
                { content: '---\n"@scope/pkg-two": major\n---' },
                { content: '---\n"@scope/pkg-three": minor\n---' },
            ];

            const result = PackageUtil.extractMajorBumpPackagesFromChangesets(files);

            assert.deepStrictEqual(result, new Set(['@scope/pkg-one', '@scope/pkg-two']));
        });

        it('should handle various formatting of the major bump line', () => {
            const files = [{ content: '  "@scope/pkg-one" : major  ' }];

            const result = PackageUtil.extractMajorBumpPackagesFromChangesets(files);

            assert.deepStrictEqual(result, new Set(['@scope/pkg-one']));
        });

        it('should ignore invalid lines', () => {
            const files = [{ content: "'@scope/pkg-one': major" }];

            const result = PackageUtil.extractMajorBumpPackagesFromChangesets(files);

            assert.deepStrictEqual(result, new Set());
        });
    });

    describe('sanitizePackageDir()', () => {
        it('should handle simple names', () => {
            assert.strictEqual(PackageUtil.sanitizePackageDir('pkg-one'), 'pkg-one');
        });

        it('should handle scoped package names', () => {
            assert.strictEqual(PackageUtil.sanitizePackageDir('@scope/pkg-one'), 'at-scope__pkg-one');
        });

        it('should handle multiple slashes and at-signs', () => {
            assert.strictEqual(PackageUtil.sanitizePackageDir('@scope/@nested/pkg'), 'at-scope__at-nested__pkg');
        });
    });
});