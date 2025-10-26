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
        it('should throw an error if .changeset directory does not exist', () => {
            process.env.GITHUB_REF_NAME = 'main';
            mockFsApi.existsSync.mock.mockImplementationOnce(() => false);

            assert.throws(() => {
                main(process.env, mockFsApi, process.cwd(), mockShell);
            }, /❌ .changeset directory does not exist/);
        });

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
            it('should publish on release branch if no major bump packages are found on main branch', () => {
                process.env.ENABLE_MULTI_RELEASE = 'true';
                process.env.GITHUB_REF_NAME = 'main';

                main(process.env, mockFsApi, process.cwd(), mockShell);

                assert.strictEqual(mockShell.mock.callCount(), 1);
                assert.strictEqual(
                    mockShell.mock.calls[0].arguments[0],
                    'pnpm changeset publish'
                );
            });

            it('should create a new release branch when on main branch and major bump is detected', () => {
                process.env.ENABLE_MULTI_RELEASE = 'true';
                process.env.GITHUB_REF_NAME = 'main';

                // Mock getMajorBumpPackages
                mockFsApi.readdirSync.mock.mockImplementationOnce(() => ['major-bump.md']);
                mockFsApi.readFileSync.mock.mockImplementationOnce(() => '---\n"@scope/pkg-one": major\n---\n\nSummary.');

                // Mock getPackageInfo
                const pkgInfo = { version: '1.2.3', dirName: 'pkg-one' };
                const packageJsonPath = path.join(process.cwd(), 'packages', 'pkg-one', 'package.json');
                mockFsApi.existsSync.mock.mockImplementation((p) => p === packageJsonPath || p.endsWith('.changeset'));
                mockFsApi.readFileSync.mock.mockImplementation((p) => {
                    if (p.endsWith('major-bump.md')) return '---\n"@scope/pkg-one": major\n---\n\nSummary.';
                    if (p === packageJsonPath) return JSON.stringify({ name: '@scope/pkg-one', version: '1.2.3' });
                    return '';
                });

                // Mock shell for branch check (not exists)
                mockShell.mock.mockImplementationOnce(() => ''); // git ls-remote returns empty

                main(process.env, mockFsApi, process.cwd(), mockShell);

                const calls = mockShell.mock.calls;
                assert.strictEqual(calls.length, 4, 'Expected 4 shell commands'); // 1 ls-remote, 1 branch, 1 push, 1 publish
                assert.strictEqual(calls[0].arguments[0], 'git ls-remote --heads origin release/pkg-one_v1');
                assert.strictEqual(calls[1].arguments[0], 'git branch release/pkg-one_v1');
                assert.strictEqual(calls[2].arguments[0], 'git push origin release/pkg-one_v1');
                assert.strictEqual(calls[3].arguments[0], 'pnpm changeset publish');
            });

            it('should create new release branches for multiple major bumps', () => {
                process.env.ENABLE_MULTI_RELEASE = 'true';
                process.env.GITHUB_REF_NAME = 'main';

                mockFsApi.readdirSync.mock.mockImplementationOnce(() => ['major1.md', 'major2.md']);
                mockFsApi.readFileSync.mock.mockImplementation((p) => {
                    if (p.endsWith('major1.md')) return '---\n"@scope/pkg-one": major\n---\n\nSummary.';
                    if (p.endsWith('major2.md')) return '---\n"@scope/pkg-two": major\n---\n\nSummary.';
                    if (p.includes('pkg-one')) return JSON.stringify({ name: '@scope/pkg-one', version: '1.2.3' });
                    if (p.includes('pkg-two')) return JSON.stringify({ name: '@scope/pkg-two', version: '4.5.6' });
                    return '';
                });
                mockFsApi.existsSync.mock.mockImplementation(() => true);
                mockShell.mock.mockImplementation(() => ''); // git ls-remote returns empty

                main(process.env, mockFsApi, process.cwd(), mockShell);

                const calls = mockShell.mock.calls;
                assert.strictEqual(calls.length, 7, 'Expected 7 shell commands'); // 2 * (ls-remote, branch, push) + 1 publish
                assert.strictEqual(calls[0].arguments[0], 'git ls-remote --heads origin release/pkg-one_v1');
                assert.strictEqual(calls[1].arguments[0], 'git branch release/pkg-one_v1');
                assert.strictEqual(calls[2].arguments[0], 'git push origin release/pkg-one_v1');
                assert.strictEqual(calls[3].arguments[0], 'git ls-remote --heads origin release/pkg-two_v4');
                assert.strictEqual(calls[4].arguments[0], 'git branch release/pkg-two_v4');
                assert.strictEqual(calls[5].arguments[0], 'git push origin release/pkg-two_v4');
                assert.strictEqual(calls[6].arguments[0], 'pnpm changeset publish');
            });

            it('should correctly parse various major bump formats from changesets', () => {
                process.env.ENABLE_MULTI_RELEASE = 'true';
                process.env.GITHUB_REF_NAME = 'main';

                const complexChangesetContent = `
                                        ---
                                        "@scope/pkg-one": major
                                        '@scope/pkg-two': major
                                        "@scope/pkg-three" : major
                                        "@scope/pkg-four":minor
                                        "@scope/pkg-five": patch
                                        ---

                                        Summary for a complex changeset.
                                                        `;

                mockFsApi.readdirSync.mock.mockImplementationOnce(() => ['complex.md']);
                mockFsApi.readFileSync.mock.mockImplementation((p) => {
                    if (p.endsWith('complex.md')) return complexChangesetContent;
                    if (p.includes('pkg-one')) return JSON.stringify({ name: '@scope/pkg-one', version: '1.0.0' });
                    if (p.includes('pkg-three')) return JSON.stringify({ name: '@scope/pkg-three', version: '3.0.0' });
                    return '';
                });
                mockFsApi.existsSync.mock.mockImplementation(() => true);
                mockShell.mock.mockImplementation(() => ''); // git ls-remote returns empty

                main(process.env, mockFsApi, process.cwd(), mockShell);

                const calls = mockShell.mock.calls;
                // Expects branches for pkg-one and pkg-three. It should ignore pkg-two (single quotes) as it's an invalid format.
                assert.strictEqual(calls.length, 7, 'Expected 7 shell commands for 2 valid major bumps'); // 2 * (ls-remote, branch, push) + 1 publish
                assert.ok(calls.some(c => c.arguments[0].includes('release/pkg-one_v1')));
                assert.ok(calls.some(c => c.arguments[0].includes('release/pkg-three_v3')));
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