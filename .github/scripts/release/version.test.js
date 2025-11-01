import { describe, it, mock, afterEach, beforeEach } from 'node:test';
import assert from 'node:assert';
import path from 'node:path';
import { main } from './version.js';

describe('version.js', () => {
    let mockFsApi;
    let mockShell;

    beforeEach(() => {
        mockFsApi = {
            existsSync: mock.fn(),
            readdirSync: mock.fn(),
            readFileSync: mock.fn(),
            writeFileSync: mock.fn(),
            mkdirSync: mock.fn(),
        };

        mockShell = mock.fn(() => ({ stdout: '', stderr: '', code: 0 }));
        mock.reset();
    });

    afterEach(() => {
        mock.reset();
    });

    describe('main()', () => {
        it('should skip if no changesets are found', () => {
            // -- Arrange
            mockFsApi.existsSync.mock.mockImplementation(() => true);
            mockFsApi.readdirSync.mock.mockImplementation(() => ['README.md']);

            // -- Act
            main(mockFsApi, process.cwd(), mockShell);

            // -- Assert
            assert.strictEqual(mockFsApi.writeFileSync.mock.callCount(), 0);
            assert.strictEqual(mockShell.mock.callCount(), 0);
        });

        it('should write an empty plan file if no major bumps are detected', () => {
            // -- Arrange
            mockFsApi.existsSync.mock.mockImplementation(() => true);
            mockFsApi.readdirSync.mock.mockImplementation(() => ['minor-bump.md']);
            mockFsApi.readFileSync.mock.mockImplementation(() => '---\n"@scope/pkg-one": minor\n---\n\nSummary.');

            // -- Act
            main(mockFsApi, process.cwd(), mockShell);

            // -- Assert
            const planPath = path.resolve(process.cwd(), '.release-meta', 'maintenance-branches.json');
            assert.strictEqual(mockFsApi.writeFileSync.mock.callCount(), 1);
            assert.strictEqual(mockFsApi.writeFileSync.mock.calls[0].arguments[0], planPath);
            assert.deepStrictEqual(JSON.parse(mockFsApi.writeFileSync.mock.calls[0].arguments[1]), {});

            assert.strictEqual(mockShell.mock.callCount(), 1);
            assert.strictEqual(mockShell.mock.calls[0].arguments[0], 'pnpm changeset version');
        });

        it('should plan a maintenance branch for a single major bump', () => {
            // -- Arrange
            mockFsApi.existsSync.mock.mockImplementation(() => true);
            mockFsApi.readdirSync.mock.mockImplementation(() => ['major-bump.md']);
            mockFsApi.readFileSync.mock.mockImplementation((p) => {
                if (p.endsWith('major-bump.md')) return '---\n"@scope/pkg-one": major\n---\n\nSummary.';
                if (p.endsWith('package.json')) return JSON.stringify({ name: '@scope/pkg-one', version: '2.5.0' });
                return '';
            });

            // -- Act
            main(mockFsApi, process.cwd(), mockShell);

            // -- Assert
            const planPath = path.resolve(process.cwd(), '.release-meta', 'maintenance-branches.json');
            assert.strictEqual(mockFsApi.writeFileSync.mock.callCount(), 1);
            assert.strictEqual(mockFsApi.writeFileSync.mock.calls[0].arguments[0], planPath);

            const writtenPlan = JSON.parse(mockFsApi.writeFileSync.mock.calls[0].arguments[1]);
            const expectedPlan = {
                '@scope/pkg-one': {
                    dirName: 'pkg-one',
                    majorVersion: 2,
                    branchName: 'release/pkg-one_v2',
                },
            };
            assert.deepStrictEqual(writtenPlan, expectedPlan);

            assert.strictEqual(mockShell.mock.callCount(), 1);
            assert.strictEqual(mockShell.mock.calls[0].arguments[0], 'pnpm changeset version');
        });

        it('should plan branches for multiple major bumps', () => {
            mockFsApi.readdirSync.mock.mockImplementation(() => ['major1.md', 'major2.md']);

            mockFsApi.existsSync.mock.mockImplementation(() => true);

            mockFsApi.readFileSync.mock.mockImplementation((p) => {
                if (p.endsWith('major1.md')) return '---\n"@scope/pkg-one": major\n---\n\nSummary.';
                if (p.endsWith('major2.md')) return '---\n"@scope/pkg-two": major\n---\n\nSummary.';
                if (p.endsWith(path.join('pkg-one', 'package.json'))) return JSON.stringify({ name: '@scope/pkg-one', version: '1.2.3' });
                if (p.endsWith(path.join('pkg-two', 'package.json'))) return JSON.stringify({ name: '@scope/pkg-two', version: '4.5.6' });
                return '';
            });

            main(mockFsApi, process.cwd(), mockShell);

            const writtenPlan = JSON.parse(mockFsApi.writeFileSync.mock.calls[0].arguments[1]);
            const expectedPlan = {
                '@scope/pkg-one': {
                    dirName: 'pkg-one',
                    majorVersion: 1,
                    branchName: 'release/pkg-one_v1',
                },
                '@scope/pkg-two': {
                    dirName: 'pkg-two',
                    majorVersion: 4,
                    branchName: 'release/pkg-two_v4',
                },
            };
            assert.deepStrictEqual(writtenPlan, expectedPlan);

            assert.strictEqual(mockShell.mock.callCount(), 1);
            assert.strictEqual(mockShell.mock.calls[0].arguments[0], 'pnpm changeset version');
        });
    });
});