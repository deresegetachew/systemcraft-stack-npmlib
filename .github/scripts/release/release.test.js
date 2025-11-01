import { describe, it, mock, afterEach, beforeEach } from 'node:test';
import assert from 'node:assert';
import path from 'node:path';
import { main } from './release.js';


describe('release.js', () => {
    const planFile = path.resolve(process.cwd(), '.release-meta', 'maintenance-branches.json');
    let mockFsApi;
    let mockShell;
    let originalEnv;

    beforeEach(() => {
        originalEnv = { ...process.env };
        process.env = { ...process.env };

        mockFsApi = {
            existsSync: mock.fn(() => false), // Default to plan file NOT existing
            readdirSync: mock.fn(() => []),
            readFileSync: mock.fn(() => ''),
        };


        mockShell = mock.fn((cmd) => {
            if (cmd.startsWith('git log')) return { stdout: 'chore: update package versions and changelogs' };
            return { stdout: '', stderr: '', code: 0 };
        });
    });

    afterEach(() => {
        process.env = originalEnv;
        mock.reset();
    });

    describe('main()', () => {
        it('should skip release on a feature branch in multi-release mode', () => {
            process.env.ENABLE_MULTI_RELEASE = 'true';
            process.env.GITHUB_REF_NAME = 'feature';
            // For this test, we don't care about the commit message, as it should exit before that.
            mockShell.mock.mockImplementation(() => ({ stdout: 'feat: new feature' }));

            main(process.env, mockFsApi, mockShell);

            // Only one shell command should be run to check the commit message.
            assert.strictEqual(mockShell.mock.callCount(), 1);
            assert.strictEqual(mockShell.mock.calls[0].arguments[0], 'git log -1 --pretty=%B');
        });

        it('should skip release if not a release commit', () => {
            process.env.ENABLE_MULTI_RELEASE = 'true';
            process.env.GITHUB_REF_NAME = 'main';

            // Mock git log to return a non-release commit message
            mockShell.mock.mockImplementation(() => ({ stdout: 'docs: update README' }));

            main(process.env, mockFsApi, mockShell);

            // The only call should be to `git log` to check the commit.
            assert.strictEqual(mockShell.mock.callCount(), 1);
            assert.strictEqual(mockShell.mock.calls[0].arguments[0], 'git log -1 --pretty=%B');
        });

        describe('single-release mode', () => {
            it('should publish from main branch without creating maintenance branches', () => {
                process.env.ENABLE_MULTI_RELEASE = 'false';
                process.env.GITHUB_REF_NAME = 'main';

                // Simulate that a plan file exists, but it should be ignored in single-release mode
                mockFsApi.existsSync.mock.mockImplementation(() => true);
                mockFsApi.readFileSync.mock.mockImplementation(() => JSON.stringify({ '@scope/pkg': { branchName: 'release/pkg_v1' } }));

                main(process.env, mockFsApi, mockShell);

                assert.strictEqual(mockShell.mock.callCount(), 2, 'Should only check commit and publish');
                assert.strictEqual(mockShell.mock.calls[1].arguments[0], 'pnpm changeset publish');
            });

            it('should not publish if commit message is not a release commit', () => {
                process.env.ENABLE_MULTI_RELEASE = 'false';
                process.env.GITHUB_REF_NAME = 'main';

                // Mock git log to return a non-release commit message
                mockShell.mock.mockImplementation(() => ({ stdout: 'feat: some new feature' }));

                main(process.env, mockFsApi, mockShell);

                assert.strictEqual(mockShell.mock.callCount(), 1, 'Should only check commit message');
            });
        });

        describe('multi-release mode', () => {

            it('should publish with no maintenance branches if plan file is empty/missing', () => {
                process.env.ENABLE_MULTI_RELEASE = 'true';
                process.env.GITHUB_REF_NAME = 'main';

                mockFsApi.existsSync.mock.mockImplementation(() => false); // No plan file exists

                main(process.env, mockFsApi, mockShell);

                assert.strictEqual(mockShell.mock.calls.length, 2); // git log + publish
                assert.strictEqual(mockShell.mock.calls[1].arguments[0], 'pnpm changeset publish');
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
                mockFsApi.existsSync.mock.mockImplementation((p) => p === planFile);
                mockFsApi.readFileSync.mock.mockImplementation(() => JSON.stringify(plan));

                // Mock shell for branch check (not exists)
                mockShell.mock.mockImplementation((cmd) => {
                    if (cmd.startsWith('git log')) return { stdout: 'chore: update package versions and changelogs' };
                    if (cmd.startsWith('git ls-remote')) return { stdout: '' }; // branch does not exist
                    return { stdout: '' };
                });

                main(process.env, mockFsApi, mockShell);

                const calls = mockShell.mock.calls;
                assert.strictEqual(calls.length, 5, 'Expected 5 shell commands'); // log, ls-remote, branch, push, publish
                assert.strictEqual(calls[1].arguments[0], 'git ls-remote --heads origin release/pkg-one_v1');
                assert.strictEqual(calls[2].arguments[0], 'git branch release/pkg-one_v1 HEAD~1');
                assert.strictEqual(calls[3].arguments[0], 'git push origin release/pkg-one_v1');
                assert.strictEqual(calls[4].arguments[0], 'pnpm changeset publish');
            });

            it('should skip branch creation if branch already exists', () => {
                process.env.ENABLE_MULTI_RELEASE = 'true';
                process.env.GITHUB_REF_NAME = 'main';

                const plan = {
                    '@scope/pkg-one': { branchName: 'release/pkg-one_v1' },
                };
                mockFsApi.existsSync.mock.mockImplementation((p) => p === planFile);
                mockFsApi.readFileSync.mock.mockImplementation(() => JSON.stringify(plan));

                // Mock shell for branch check (exists)
                mockShell.mock.mockImplementation((cmd) => {
                    if (cmd.startsWith('git log')) return { stdout: 'chore: update package versions and changelogs' };
                    if (cmd.startsWith('git ls-remote')) return { stdout: 'exists' }; // branch exists
                    return { stdout: '' };
                });

                main(process.env, mockFsApi, mockShell);

                const calls = mockShell.mock.calls;
                assert.strictEqual(calls.length, 3, 'Expected 3 shell commands'); // log, ls-remote, publish
                assert.strictEqual(calls[1].arguments[0], 'git ls-remote --heads origin release/pkg-one_v1');
                assert.strictEqual(calls[2].arguments[0], 'pnpm changeset publish');
            });

            it('should only publish when on a release branch', () => {
                process.env.ENABLE_MULTI_RELEASE = 'true';
                process.env.GITHUB_REF_NAME = 'release/some-feature';

                main(process.env, mockFsApi, mockShell);

                // On a release branch, it should check the commit and then publish.
                // No maintenance branches are created.
                assert.strictEqual(mockShell.mock.callCount(), 2);
                assert.strictEqual(mockShell.mock.calls[0].arguments[0], 'git log -1 --pretty=%B');
                assert.strictEqual(mockShell.mock.calls[1].arguments[0], 'pnpm changeset publish');
            });

            it('should ignore plan file when on a release branch', () => {
                process.env.ENABLE_MULTI_RELEASE = 'true';
                process.env.GITHUB_REF_NAME = 'release/some-feature';

                // Simulate that a plan file exists
                mockFsApi.existsSync.mock.mockImplementation(() => true);
                mockFsApi.readFileSync.mock.mockImplementation(() => JSON.stringify({ '@scope/pkg': { branchName: 'release/pkg_v1' } }));

                main(process.env, mockFsApi, mockShell);

                // Should only check commit and publish, not read the plan or create branches.
                assert.strictEqual(mockShell.mock.callCount(), 2);
                assert.strictEqual(mockShell.mock.calls[1].arguments[0], 'pnpm changeset publish');
            });
        });
    });
});