import { describe, it, mock, afterEach, beforeEach } from 'node:test';
import assert from 'node:assert';
import {
    extractMajorBumpPackagesFromChangesets,
    getPackageInfo,
    getChangedFiles,
    loadChangesetFiles,
    sanitizePackageDir,
    runShellCommand,
    __testExec as exec,
} from './utils.js';


describe('utils.js', () => {
    let mockFsApi;
    let mockCPApi;


    beforeEach(() => {
        mockFsApi = {
            existsSync: mock.fn(),
            readdirSync: mock.fn(),
            readFileSync: mock.fn(),
        };

        mockCPApi = {
            execSync: mock.fn()
        }
    });

    afterEach(() => {
        mock.reset();
    });

    describe('extractMajorBumpPackagesFromChangesets()', () => {
        it('should return an empty set for empty input', () => {
            // -- Arrange
            const emptyFiles = [];

            // -- Act
            const result = extractMajorBumpPackagesFromChangesets(emptyFiles);

            // -- Assert
            assert.deepStrictEqual(result, new Set());
        });

        it('should extract a single major bump package', () => {
            // -- Arrange
            const files = [{ content: '---\n"@scope/pkg-one": major\n---' }];

            // -- Act
            const result = extractMajorBumpPackagesFromChangesets(files);

            // -- Assert
            assert.deepStrictEqual(result, new Set(['@scope/pkg-one']));
        });

        it('should extract multiple major bump packages from different files', () => {
            // -- Arrange
            const files = [
                { content: '---\n"@scope/pkg-one": major\n---' },
                { content: '---\n"@scope/pkg-two": major\n---' },
                { content: '---\n"@scope/pkg-three": minor\n---' },
            ];

            // -- Act
            const result = extractMajorBumpPackagesFromChangesets(files);

            // -- Assert
            assert.deepStrictEqual(result, new Set(['@scope/pkg-one', '@scope/pkg-two']));
        });

        it('should handle various formatting of the major bump line', () => {
            // -- Arrange
            const files = [{ content: '  "@scope/pkg-one" : major  ' }];

            // -- Act
            const result = extractMajorBumpPackagesFromChangesets(files);

            // -- Assert
            assert.deepStrictEqual(result, new Set(['@scope/pkg-one']));
        });

        it('should ignore invalid lines', () => {
            // -- Arrange
            const files = [{ content: "'@scope/pkg-one': major" }];

            // -- Act
            const result = extractMajorBumpPackagesFromChangesets(files);

            // -- Assert
            assert.deepStrictEqual(result, new Set());
        });
    });

    describe('getPackageInfo()', () => {
        it('should return null if package.json does not exist', () => {
            // -- Arrange
            mockFsApi.existsSync.mock.mockImplementation(() => false);

            // -- Act
            const result = getPackageInfo('@scope/pkg-one', mockFsApi, process.cwd());

            // -- Assert
            assert.strictEqual(result, null);
        });

        it('should return package info if package.json exists', () => {
            // -- Arrange
            mockFsApi.existsSync.mock.mockImplementation(() => true);
            mockFsApi.readFileSync.mock.mockImplementation(() => JSON.stringify({ version: '1.2.3' }));

            // -- Act
            const result = getPackageInfo('@scope/pkg-one', mockFsApi, process.cwd());

            // -- Assert
            const expected = {
                version: '1.2.3',
                dirName: 'pkg-one',
            };
            assert.deepStrictEqual(result, expected);
        });
    });

    describe('loadChangesetFiles()', () => {
        it('should return an empty array if .changeset directory does not exist', () => {
            // -- Arrange
            mockFsApi.existsSync.mock.mockImplementation(() => false);

            // -- Act
            const result = loadChangesetFiles(mockFsApi, process.cwd());

            // -- Assert
            assert.deepStrictEqual(result, []);
        });

        it('should load and read changeset files', () => {
            // -- Arrange
            mockFsApi.existsSync.mock.mockImplementation(() => true);
            mockFsApi.readdirSync.mock.mockImplementation(() => ['one.md', 'two.md', 'README.md']);
            mockFsApi.readFileSync.mock.mockImplementation((p) => {
                if (p.endsWith('one.md')) return 'content one';
                if (p.endsWith('two.md')) return 'content two';
                return '';
            });

            // -- Act
            const result = loadChangesetFiles(mockFsApi, process.cwd());

            // -- Assert
            const expected = [
                { filename: 'one.md', content: 'content one' },
                { filename: 'two.md', content: 'content two' },
            ];
            assert.deepStrictEqual(result, expected);
        });
    });

    describe('sanitizePackageDir()', () => {
        it('should handle simple names', () => {
            // -- Arrange & Act & Assert
            assert.strictEqual(sanitizePackageDir('pkg-one'), 'pkg-one');
        });

        it('should handle scoped package names', () => {
            // -- Arrange & Act & Assert
            assert.strictEqual(sanitizePackageDir('@scope/pkg-one'), 'at-scope__pkg-one');
        });

        it('should handle multiple slashes and at-signs', () => {
            // -- Arrange & Act & Assert
            assert.strictEqual(sanitizePackageDir('@scope/@nested/pkg'), 'at-scope__at-nested__pkg');
        });
    });

    describe('runShellCommand()', () => {
        it('should call the provided shell function with the command and options', () => {
            // -- Arrange
            const mockShellFn = mock.fn();
            const cmd = 'echo "hello"';
            const options = { stdio: 'pipe' };

            // -- Act
            runShellCommand(cmd, mockShellFn, options);

            // -- Assert
            assert.strictEqual(mockShellFn.mock.callCount(), 1);
            assert.strictEqual(mockShellFn.mock.calls[0].arguments[0], cmd);
            assert.deepStrictEqual(mockShellFn.mock.calls[0].arguments[1], options);
        });
    });

    describe('exec()', () => {

        it('should return an object with stdout when command succeeds', () => {
            // -- Arrange
            mockCPApi.execSync.mock.mockImplementationOnce(() => 'mocked output');

            // -- Act
            const result = exec('test command', {}, mockCPApi);

            // -- Assert
            assert.deepStrictEqual(result, { stdout: 'mocked output' },);
            assert.strictEqual(mockCPApi.execSync.mock.callCount(), 1);
            assert.strictEqual(mockCPApi.execSync.mock.calls[0].arguments[0], 'test command');
        });

        it('should return an object with empty stdout if command output is null/undefined', () => {
            // -- Arrange
            mockCPApi.execSync.mock.mockImplementationOnce(() => null);

            // -- Act
            const result = exec('test command without output', {}, mockCPApi);

            // -- Assert
            assert.deepStrictEqual(result, { stdout: '' });
        });

        it('should return an object with stdout when stdio is pipe (Buffer output)', () => {
            // -- Arrange
            mockCPApi.execSync.mock.mockImplementationOnce(() => Buffer.from('piped output')); // execSync returns Buffer for pipe

            // -- Act
            const result = exec('test command with pipe', { stdio: 'pipe' }, mockCPApi);

            // -- Assert
            assert.deepStrictEqual(result, { stdout: 'piped output' });
            assert.strictEqual(mockCPApi.execSync.mock.callCount(), 1);
            assert.deepStrictEqual(mockCPApi.execSync.mock.calls[0].arguments[1], { stdio: 'pipe' });
        });

        it('should exit process on command failure', () => {
            // -- Arrange
            // Temporarily replace the global process.exit with a mock function
            const mockExit = mock.method(process, 'exit');
            mockExit.mock.mockImplementation(() => {
                // Do nothing instead of exiting
            });

            mockCPApi.execSync.mock.mockImplementationOnce(() => { throw new Error('Command failed'); });

            // -- Act
            exec('failing command', {}, mockCPApi);

            // -- Assert
            assert.strictEqual(mockExit.mock.callCount(), 1, 'process.exit should have been called once');
            assert.strictEqual(mockExit.mock.calls[0].arguments[0], 1, 'process.exit should be called with code 1');
        });

        it('should throw error instead of exiting when stdio is pipe', () => {
            // -- Arrange
            const mockExit = mock.method(process, 'exit');
            mockExit.mock.mockImplementation(() => {
                // Do nothing instead of exiting
            });

            mockCPApi.execSync.mock.mockImplementationOnce(() => { throw new Error('Command failed'); });

            // -- Act & Assert
            assert.throws(() => {
                exec('failing command', { stdio: 'pipe' }, mockCPApi);
            }, /Command failed/);

            // Should not call process.exit when stdio is pipe
            assert.strictEqual(mockExit.mock.callCount(), 0, 'process.exit should not be called when stdio is pipe');
        });
    });

    describe('getChangedFiles()', () => {
        it('should return changed files from HEAD~1..HEAD command', async () => {
            // -- Arrange
            const mockShell = mock.fn();
            mockShell.mock.mockImplementationOnce(() => ({
                stdout: 'packages/lib-one/package.json\npackages/lib-one/CHANGELOG.md\nsrc/index.js\n'
            }));

            // -- Act
            const result = await getChangedFiles(mockShell);

            // -- Assert
            assert.deepStrictEqual(result, [
                'packages/lib-one/package.json',
                'packages/lib-one/CHANGELOG.md',
                'src/index.js'
            ]);
            assert.strictEqual(mockShell.mock.callCount(), 1);
            assert.strictEqual(mockShell.mock.calls[0].arguments[0], 'git diff --name-only HEAD~1..HEAD');
        });

        it('should fallback to HEAD^..HEAD if first command fails', async () => {
            // -- Arrange
            const mockShell = mock.fn();
            let callCount = 0;
            mockShell.mock.mockImplementation((cmd) => {
                callCount++;
                if (callCount === 1) {
                    throw new Error('First command failed');
                } else {
                    return { stdout: 'packages/lib-two/package.json\nREADME.md\n' };
                }
            });

            // -- Act
            const result = await getChangedFiles(mockShell);

            // -- Assert
            assert.deepStrictEqual(result, [
                'packages/lib-two/package.json',
                'README.md'
            ]);
            assert.strictEqual(mockShell.mock.callCount(), 2);
            assert.strictEqual(mockShell.mock.calls[1].arguments[0], 'git diff --name-only HEAD^..HEAD');
        });

        it('should return empty array if both commands fail', async () => {
            // -- Arrange
            const mockShell = mock.fn();
            mockShell.mock.mockImplementation(() => { throw new Error('Command failed'); });

            // -- Act
            const result = await getChangedFiles(mockShell);

            // -- Assert
            assert.deepStrictEqual(result, []);
            assert.strictEqual(mockShell.mock.callCount(), 2);
        });

        it('should filter out empty lines from git output', async () => {
            // -- Arrange
            const mockShell = mock.fn();
            mockShell.mock.mockImplementationOnce(() => ({
                stdout: 'file1.js\n\nfile2.js\n\n'
            }));

            // -- Act
            const result = await getChangedFiles(mockShell);

            // -- Assert
            assert.deepStrictEqual(result, ['file1.js', 'file2.js']);
        });

        it('should handle empty output from git command', async () => {
            // -- Arrange
            const mockShell = mock.fn();
            mockShell.mock.mockImplementationOnce(() => ({ stdout: '' }));

            // -- Act
            const result = await getChangedFiles(mockShell);

            // -- Assert
            assert.deepStrictEqual(result, []);
        });
    });
});