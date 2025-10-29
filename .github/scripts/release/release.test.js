import { describe, it, mock, afterEach, beforeEach } from 'node:test';
import assert from 'node:assert';
import path from 'node:path';
import { main } from './release.js';


describe('release.js', () => {
    let mockFsApi;
    let mockShell;
    let originalEnv;

    beforeEach(() => {
        originalEnv = { ...process.env };
        process.env = { ...process.env };

        mockFsApi = {
            existsSync: mock.fn(() => true),
            readdirSync: mock.fn(() => []),
            readFileSync: mock.fn(() => ''),
        };

        mockShell = mock.fn(() => ({ stdout: '', stderr: '', code: 0 }));
    });

    afterEach(() => {
        process.env = originalEnv;
        mock.reset();
    });

    describe('main()', () => {
        it('should throw an error if branch is not main or release/*', () => {
            process.env.GITHUB_REF_NAME = 'feature';

            assert.throws(() => {
                main(process.env, mockFsApi, process.cwd(), mockShell);
            }, /❌ Invalid branch: feature/);
        });

        describe('single-release mode', () => {
            it('runs "pnpm changeset publish"', () => {
                process.env.ENABLE_MULTI_RELEASE = 'false';
                process.env.GITHUB_REF_NAME = 'main';

                main(process.env, mockFsApi, process.cwd(), mockShell);

                assert.strictEqual(mockShell.mock.callCount(), 1);
                assert.strictEqual(
                    mockShell.mock.calls[0].arguments[0],
                    'pnpm changeset publish'
                );
            });
        });

        describe('multi-release mode', () => {
            it('should just publish if no plan file is found', () => {
                process.env.ENABLE_MULTI_RELEASE = 'true';
                process.env.GITHUB_REF_NAME = 'main';

                mockFsApi.existsSync.mock.mockImplementation(() => false);

                main(process.env, mockFsApi, process.cwd(), mockShell);

                assert.strictEqual(mockShell.mock.callCount(), 1);
                assert.strictEqual(
                    mockShell.mock.calls[0].arguments[0],
                    'pnpm changeset publish'
                );
            });

            it('should create a new release branch based on the plan file', () => {
                process.env.ENABLE_MULTI_RELEASE = 'true';
                process.env.GITHUB_REF_NAME = 'main';

                const plan = {
                    '@scope/pkg-one': {
                        dirName: 'pkg-one',
                        previousMajor: 1,
                        branchName: 'release/pkg-one_v1',
                    },
                };
                const planPath = path.resolve(process.cwd(), '.release-meta', 'maintenance-branches.json');
                mockFsApi.existsSync.mock.mockImplementation((p) => p === planPath);
                mockFsApi.readFileSync.mock.mockImplementation(() => JSON.stringify(plan));

                // Mock shell for branch check (not exists)
                mockShell.mock.mockImplementationOnce(() => ({ stdout: '' })); // git ls-remote returns empty

                main(process.env, mockFsApi, process.cwd(), mockShell);

                const calls = mockShell.mock.calls;
                assert.strictEqual(calls.length, 4, 'Expected 4 shell commands'); // ls-remote, branch, push, publish
                assert.strictEqual(calls[0].arguments[0], 'git ls-remote --heads origin release/pkg-one_v1');
                assert.strictEqual(calls[1].arguments[0], 'git branch release/pkg-one_v1 HEAD~1');
                assert.strictEqual(calls[2].arguments[0], 'git push origin release/pkg-one_v1');
                assert.strictEqual(calls[3].arguments[0], 'pnpm changeset publish');
            });

            it('should skip branch creation if branch already exists', () => {
                process.env.ENABLE_MULTI_RELEASE = 'true';
                process.env.GITHUB_REF_NAME = 'main';

                const plan = {
                    '@scope/pkg-one': { branchName: 'release/pkg-one_v1' },
                };
                mockFsApi.existsSync.mock.mockImplementation(() => true);
                mockFsApi.readFileSync.mock.mockImplementation(() => JSON.stringify(plan));

                // Mock shell for branch check (exists)
                mockShell.mock.mockImplementationOnce(() => ({ stdout: 'exists' }));

                main(process.env, mockFsApi, process.cwd(), mockShell);

                const calls = mockShell.mock.calls;
                assert.strictEqual(calls.length, 2, 'Expected 2 shell commands'); // ls-remote, publish
                assert.strictEqual(calls[0].arguments[0], 'git ls-remote --heads origin release/pkg-one_v1');
                assert.strictEqual(calls[1].arguments[0], 'pnpm changeset publish');
            });

            it('should just publish when on a release branch', () => {
                process.env.ENABLE_MULTI_RELEASE = 'true';
                process.env.GITHUB_REF_NAME = 'release/some-feature';

                main(process.env, mockFsApi, process.cwd(), mockShell);

                assert.strictEqual(mockShell.mock.callCount(), 1);
                assert.strictEqual(mockShell.mock.calls[0].arguments[0], 'pnpm changeset publish');
            });
        });
    });
});