import { describe, it, mock, afterEach, beforeEach } from 'node:test';
import assert from 'node:assert';
import { ReleaseService } from './services/release.service.js';
import { GitUtil } from '../utils/git.util.js';

describe('ReleaseService', () => {
    const planFilePath = '.release-meta/maintenance-branches.json';
    let mockFsApi;
    let mockShellService;
    let mockGitService;
    let releaseService;
    let originalEnv;

    beforeEach(() => {
        originalEnv = { ...process.env };
        process.env = { ...process.env };

        // Mock filesystem
        mockFsApi = {
            existsSync: mock.fn(() => false),
            readdirSync: mock.fn(() => []),
            readFileSync: mock.fn(() => ''),
            resolve: mock.fn(() => planFilePath)
        };

        // Mock shell service
        mockShellService = {
            exec: mock.fn(() => ({ stdout: '' })),
            run: mock.fn(() => ({ stdout: '' }))
        };

        // Mock git service
        mockGitService = {
            getChangedFiles: mock.fn(() => Promise.resolve([])),
            checkRemoteBranch: mock.fn(() => false),
            createBranch: mock.fn(),
            pushBranch: mock.fn()
        };

        // Create release service with mocked dependencies
        releaseService = ReleaseService.create(mockShellService, mockFsApi);
        // Override git service with mock
        releaseService.git = mockGitService;
    });

    afterEach(() => {
        process.env = originalEnv;
        mock.restoreAll();
    });

    describe('main()', () => {
        describe('single-release mode', () => {
            beforeEach(() => {
                process.env.ENABLE_MULTI_RELEASE = 'false';
            });

            it('should skip release if not a release commit', async () => {
                // -- Arrange
                process.env.GITHUB_REF_NAME = 'main';
                mockGitService.getChangedFiles.mock.mockImplementation(() =>
                    Promise.resolve(['src/feature.js', 'docs/README.md'])
                );

                // -- Act
                await releaseService.run(process.env);

                // -- Assert
                assert.strictEqual(mockGitService.getChangedFiles.mock.callCount(), 1);
                assert.strictEqual(mockShellService.run.mock.callCount(), 0, 'Should not execute any commands');
            });

            it('should publish from main branch without creating maintenance branches', async () => {
                // -- Arrange
                process.env.GITHUB_REF_NAME = 'main';
                mockGitService.getChangedFiles.mock.mockImplementation(() =>
                    Promise.resolve(['packages/lib-one/package.json', 'packages/lib-one/CHANGELOG.md'])
                );

                // -- Act
                await releaseService.run(process.env);

                // -- Assert
                assert.strictEqual(mockGitService.getChangedFiles.mock.callCount(), 1);
                // Should call publish command
                const publishCall = mockShellService.run.mock.calls.find(call =>
                    call.arguments[0].includes('changeset publish')
                );
                assert.ok(publishCall, 'Should call changeset publish');
            });

            it('should not publish if commit message is not a release commit', async () => {
                // -- Arrange
                process.env.GITHUB_REF_NAME = 'main';
                mockGitService.getChangedFiles.mock.mockImplementation(() =>
                    Promise.resolve(['src/feature.js', 'docs/README.md'])
                );

                // -- Act
                await releaseService.run(process.env);

                // -- Assert
                assert.strictEqual(mockGitService.getChangedFiles.mock.callCount(), 1);
                // Should not call publish
                const publishCall = mockShellService.run.mock.calls.find(call =>
                    call.arguments[0].includes('changeset publish')
                );
                assert.ok(!publishCall, 'Should not call changeset publish');
            });
        });

        describe('multi-release mode', () => {
            beforeEach(() => {
                process.env.ENABLE_MULTI_RELEASE = 'true';
            });

            it('should skip release if not a release commit', async () => {
                // -- Arrange
                process.env.GITHUB_REF_NAME = 'main';
                mockGitService.getChangedFiles.mock.mockImplementation(() =>
                    Promise.resolve(['src/feature.js', 'docs/README.md'])
                );

                // -- Act
                await releaseService.run(process.env);

                // -- Assert
                assert.strictEqual(mockGitService.getChangedFiles.mock.callCount(), 1);
                assert.strictEqual(mockShellService.run.mock.callCount(), 0);
            });

            it('should skip release on a feature branch in multi-release mode', async () => {
                // -- Arrange
                process.env.GITHUB_REF_NAME = 'feature/test';

                // -- Act
                await releaseService.run(process.env);

                // -- Assert
                // Should not even check changed files
                assert.strictEqual(mockGitService.getChangedFiles.mock.callCount(), 0);
                assert.strictEqual(mockShellService.run.mock.callCount(), 0);
            });

            it('should be able publish from a main branch for a valid release commit without a plan file', async () => {
                // -- Arrange
                process.env.GITHUB_REF_NAME = 'main';
                mockGitService.getChangedFiles.mock.mockImplementation(() =>
                    Promise.resolve(['packages/lib-one/package.json', 'packages/lib-one/CHANGELOG.md'])
                );

                // -- Act
                await releaseService.run(process.env);

                // -- Assert
                assert.strictEqual(mockGitService.getChangedFiles.mock.callCount(), 1);
                const publishCall = mockShellService.run.mock.calls.find(call =>
                    call.arguments[0].includes('changeset publish')
                );
                assert.ok(publishCall, 'Should call changeset publish');
            });

            it('should create a new release branch based on the plan file', async () => {
                // -- Arrange
                process.env.GITHUB_REF_NAME = 'main';
                mockFsApi.existsSync.mock.mockImplementation(() => true);
                mockFsApi.readFileSync.mock.mockImplementation(() =>
                    JSON.stringify({
                        '@scope/lib-one': { branchName: 'release/lib-one@1.0.0' }
                    })
                );
                mockGitService.getChangedFiles.mock.mockImplementation(() =>
                    Promise.resolve(['packages/lib-one/package.json'])
                );
                mockGitService.checkRemoteBranch.mock.mockImplementation(() => false);

                // -- Act
                await releaseService.run(process.env);

                // -- Assert
                assert.strictEqual(mockGitService.checkRemoteBranch.mock.callCount(), 1);
                assert.strictEqual(mockGitService.createBranch.mock.callCount(), 1);
                assert.strictEqual(mockGitService.pushBranch.mock.callCount(), 1);
            });

            it('should skip branch creation if branch already exists', async () => {
                // -- Arrange
                process.env.GITHUB_REF_NAME = 'main';
                mockFsApi.existsSync.mock.mockImplementation(() => true);
                mockFsApi.readFileSync.mock.mockImplementation(() =>
                    JSON.stringify({
                        '@scope/lib-one': { branchName: 'release/lib-one@1.0.0' }
                    })
                );
                mockGitService.getChangedFiles.mock.mockImplementation(() =>
                    Promise.resolve(['packages/lib-one/package.json'])
                );
                mockGitService.checkRemoteBranch.mock.mockImplementation(() => true);

                // -- Act
                await releaseService.run(process.env);

                // -- Assert
                assert.strictEqual(mockGitService.checkRemoteBranch.mock.callCount(), 1);
                assert.strictEqual(mockGitService.createBranch.mock.callCount(), 0, 'Should not create branch');
                assert.strictEqual(mockGitService.pushBranch.mock.callCount(), 0, 'Should not push branch');
            });

            it('should be able to publish from a release branch for a valid release commit', async () => {
                // -- Arrange
                process.env.GITHUB_REF_NAME = 'release/lib-one@1.0.0';
                mockGitService.getChangedFiles.mock.mockImplementation(() =>
                    Promise.resolve(['packages/lib-one/package.json'])
                );

                // -- Act
                await releaseService.run(process.env);

                // -- Assert
                assert.strictEqual(mockGitService.getChangedFiles.mock.callCount(), 1);
                const publishCall = mockShellService.run.mock.calls.find(call =>
                    call.arguments[0].includes('changeset publish')
                );
                assert.ok(publishCall, 'Should call changeset publish');
            });
        });
    });
});