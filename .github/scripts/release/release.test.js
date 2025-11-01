import { describe, it, mock, afterEach, beforeEach } from 'node:test';
import assert from 'node:assert';
import { main } from './release.js';


describe('release.js', () => {
    const planFilePath = '.release-meta/maintenance-branches.json';
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
            resolve: mock.fn(() => planFilePath)
        };


        mockShell = mock.fn((cmd) => {
            if (cmd.startsWith('git diff-tree')) return { stdout: 'packages/lib-one/package.json\npackages/lib-one/CHANGELOG.md\n.changeset/old-change.md' };
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
            mockShell.mock.mockImplementation(() => ({ stdout: 'packages/lib-one/package.json\npackages/lib-one/CHANGELOG.md' }));

            main(process.env, mockFsApi, mockShell);

            assert.strictEqual(mockShell.mock.callCount(), 1);
            assert.ok(!mockShell.mock.calls.some(call => call.arguments[0].includes('changeset publish')));
        });

        it('should skip release if not a release commit', () => {
            process.env.ENABLE_MULTI_RELEASE = 'true';
            process.env.GITHUB_REF_NAME = 'main';

            mockShell.mock.mockImplementation(() => ({ stdout: 'docs/README.md\nsrc/feature.js' }));

            main(process.env, mockFsApi, mockShell);

            assert.strictEqual(mockShell.mock.callCount(), 1);
            assert.ok(!mockShell.mock.calls.some(call => call.arguments[0].includes('changeset publish')));
        });

        describe('single-release mode', () => {
            it('should publish from main branch without creating maintenance branches', () => {
                process.env.ENABLE_MULTI_RELEASE = 'false';
                process.env.GITHUB_REF_NAME = 'main';

                mockShell.mock.mockImplementation((cmd) => {
                    if (cmd.includes('changeset publish')) return { stdout: '' };
                    return { stdout: 'packages/lib-one/package.json\npackages/lib-one/CHANGELOG.md' };
                });

                mockFsApi.existsSync.mock.mockImplementation(() => true);
                mockFsApi.readFileSync.mock.mockImplementation(() => JSON.stringify({ '@scope/pkg': { branchName: 'release/pkg_v1' } }));

                main(process.env, mockFsApi, mockShell);

                assert.strictEqual(mockShell.mock.callCount(), 2, 'Should check commit and publish');
                assert.ok(mockShell.mock.calls.some(call => call.arguments[0] === 'pnpm changeset publish'));
                assert.ok(!mockShell.mock.calls.some(call => call.arguments[0].includes('git branch')));
            });

            it('should not publish if commit message is not a release commit', () => {
                process.env.ENABLE_MULTI_RELEASE = 'false';
                process.env.GITHUB_REF_NAME = 'main';

                mockShell.mock.mockImplementation(() => ({ stdout: 'src/feature.js\ndocs/README.md' }));

                main(process.env, mockFsApi, mockShell);

                assert.strictEqual(mockShell.mock.callCount(), 1, 'Should only check changed files');
                assert.ok(!mockShell.mock.calls.some(call => call.arguments[0].includes('changeset publish')));
            });
        });

        describe('multi-release mode', () => {

            it('should be able publish from a main branch for a valid release commit without a plan file', () => {
                process.env.ENABLE_MULTI_RELEASE = 'true';
                process.env.GITHUB_REF_NAME = 'main';
                mockFsApi.existsSync.mock.mockImplementation(() => false); // No plan file exists

                mockShell.mock.mockImplementation((cmd) => {
                    if (cmd.includes('changeset publish')) return { stdout: '' };
                    return { stdout: 'packages/lib-one/package.json\npackages/lib-one/CHANGELOG.md' };
                });

                main(process.env, mockFsApi, mockShell);

                assert.strictEqual(mockShell.mock.callCount(), 2);
                assert.ok(mockShell.mock.calls.some(call => call.arguments[0] === 'pnpm changeset publish'));
            });


            it('should be able publish from a main branch for a valid release commit with an empty plan file', () => {
                process.env.ENABLE_MULTI_RELEASE = 'true';
                process.env.GITHUB_REF_NAME = 'main';
                mockFsApi.existsSync.mock.mockImplementation(() => true); // Plan file exists
                mockFsApi.readFileSync.mock.mockImplementation(() => JSON.stringify({})); // Empty plan file

                mockShell.mock.mockImplementation((cmd) => {
                    if (cmd.includes('changeset publish')) return { stdout: '' };
                    return { stdout: 'packages/lib-one/package.json\npackages/lib-one/CHANGELOG.md' };
                });

                main(process.env, mockFsApi, mockShell);

                assert.strictEqual(mockShell.mock.callCount(), 2);
                assert.ok(mockShell.mock.calls.some(call => call.arguments[0] === 'pnpm changeset publish'));
            });

            it('should publish directly from main if no maintenance branch plan exists', () => {
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
                mockFsApi.existsSync.mock.mockImplementation((p) => true);
                mockFsApi.readFileSync.mock.mockImplementation(() => JSON.stringify(plan));

                // Mock shell for branch check (not exists)
                mockShell.mock.mockImplementation((cmd) => {
                    if (cmd.startsWith('git diff-tree')) return { stdout: 'packages/pkg-one/package.json\n.changeset/old.md' };
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
                mockFsApi.existsSync.mock.mockImplementation((p) => true);
                mockFsApi.readFileSync.mock.mockImplementation(() => JSON.stringify(plan));

                mockShell.mock.mockImplementation((cmd) => {
                    if (cmd.startsWith('git diff-tree')) return { stdout: 'packages/pkg-one/package.json\n.changeset/old.md' };
                    if (cmd.startsWith('git ls-remote')) return { stdout: 'exists' }; // branch exists
                    return { stdout: '' };
                });

                main(process.env, mockFsApi, mockShell);

                const calls = mockShell.mock.calls;
                assert.strictEqual(calls.length, 3, 'Expected 3 shell commands'); // log, ls-remote, publish
                assert.strictEqual(calls[1].arguments[0], 'git ls-remote --heads origin release/pkg-one_v1');
                assert.strictEqual(calls[2].arguments[0], 'pnpm changeset publish');
            });

            it('should be able to publish from a release branch for a valid release commit', () => {
                process.env.ENABLE_MULTI_RELEASE = 'true';
                process.env.GITHUB_REF_NAME = 'release/some-feature';

                mockShell.mock.mockImplementation((cmd) => {
                    if (cmd.includes('changeset publish')) return { stdout: '' };
                    return { stdout: 'packages/lib-one/package.json\npackages/lib-one/CHANGELOG.md' };
                });

                main(process.env, mockFsApi, mockShell);


                assert.strictEqual(mockShell.mock.callCount(), 2);
                assert.ok(mockShell.mock.calls.some(call => call.arguments[0] === 'pnpm changeset publish'));
                assert.ok(!mockShell.mock.calls.some(call => call.arguments[0].includes('git branch')));
            });

        });
    });
});