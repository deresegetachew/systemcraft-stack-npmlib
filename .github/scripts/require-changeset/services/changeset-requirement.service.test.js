import { describe, it, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert';
import { ChangesetRequirementService } from './changeset-requirement.service.js';
import { GitUtil } from '../../utils/git.util.js';

describe('ChangesetRequirementService', () => {
    let service;
    let mockGitUtil;
    let mockShellUtil;

    beforeEach(() => {
        mockShellUtil = {
            exec: mock.fn(() => ({ stdout: '' }))
        };

        mockGitUtil = {
            getChangedFilesBetweenRefs: mock.fn(() => []),
            fetchBranch: mock.fn()
        };
    });

    afterEach(() => {
        mock.restoreAll();
    });

    describe('shouldSkipCheck', () => {
        beforeEach(() => {
            // This test suite doesn't need mocks, just create service with defaults
            service = new ChangesetRequirementService();
        });

        it('should skip if not a pull request', () => {
            const context = {
                eventName: 'push',
                payload: {},
                actor: 'user'
            };

            const result = service.shouldSkipCheck(context, '[skip changeset check]');
            assert.strictEqual(result, true);
        });

        it('should skip for Version Packages PR title', () => {
            const context = {
                eventName: 'pull_request',
                payload: {
                    pull_request: {
                        title: 'Version Packages',
                        body: '',
                        head: { ref: 'feature-branch' },
                        labels: []
                    }
                },
                actor: 'user'
            };

            const result = service.shouldSkipCheck(context, '[skip changeset check]');
            assert.strictEqual(result, true);
        });

        it('should skip for github-actions[bot] actor', () => {
            const context = {
                eventName: 'pull_request',
                payload: {
                    pull_request: {
                        title: 'Some PR',
                        body: '',
                        head: { ref: 'feature-branch' },
                        labels: []
                    }
                },
                actor: 'github-actions[bot]'
            };

            const result = service.shouldSkipCheck(context, '[skip changeset check]');
            assert.strictEqual(result, true);
        });

        it('should skip for changeset-release branch', () => {
            const context = {
                eventName: 'pull_request',
                payload: {
                    pull_request: {
                        title: 'Some PR',
                        body: '',
                        head: { ref: 'changeset-release/main' },
                        labels: []
                    }
                },
                actor: 'user'
            };

            const result = service.shouldSkipCheck(context, '[skip changeset check]');
            assert.strictEqual(result, true);
        });

        it('should skip for dependabot[bot] actor', () => {
            const context = {
                eventName: 'pull_request',
                payload: {
                    pull_request: {
                        title: 'Some PR',
                        body: '',
                        head: { ref: 'feature-branch' },
                        labels: []
                    }
                },
                actor: 'dependabot[bot]'
            };

            const result = service.shouldSkipCheck(context, '[skip changeset check]');
            assert.strictEqual(result, true);
        });

        it('should skip if skip label is in PR title', () => {
            const context = {
                eventName: 'pull_request',
                payload: {
                    pull_request: {
                        title: 'Fix bug [skip changeset check]',
                        body: '',
                        head: { ref: 'feature-branch' },
                        labels: []
                    }
                },
                actor: 'user'
            };

            const result = service.shouldSkipCheck(context, '[skip changeset check]');
            assert.strictEqual(result, true);
        });

        it('should skip if skip label is in PR body', () => {
            const context = {
                eventName: 'pull_request',
                payload: {
                    pull_request: {
                        title: 'Fix bug',
                        body: 'This is a minor fix [skip changeset check]',
                        head: { ref: 'feature-branch' },
                        labels: []
                    }
                },
                actor: 'user'
            };

            const result = service.shouldSkipCheck(context, '[skip changeset check]');
            assert.strictEqual(result, true);
        });

        it('should skip if skip label is in PR labels', () => {
            const context = {
                eventName: 'pull_request',
                payload: {
                    pull_request: {
                        title: 'Fix bug',
                        body: '',
                        head: { ref: 'feature-branch' },
                        labels: [{ name: '[skip changeset check]' }]
                    }
                },
                actor: 'user'
            };

            const result = service.shouldSkipCheck(context, '[skip changeset check]');
            assert.strictEqual(result, true);
        });

        it('should not skip for regular PR', () => {
            const context = {
                eventName: 'pull_request',
                payload: {
                    pull_request: {
                        title: 'Fix bug',
                        body: 'Regular PR description',
                        head: { ref: 'feature-branch' },
                        labels: []
                    }
                },
                actor: 'user'
            };

            const result = service.shouldSkipCheck(context, '[skip changeset check]');
            assert.strictEqual(result, false);
        });
    });

    describe('fetchBranches', () => {
        beforeEach(() => {
            // This test suite needs to test shell execution, so use real GitUtil with mocked shell
            service = new ChangesetRequirementService({
                shellUtil: mockShellUtil
                // No gitUtil - let it create real GitUtil with mocked shellUtil
            });
        });

        it('should fetch both base and head branches', async () => {
            // -- Arrange & Act
            await service.fetchBranches('main', 'feature-branch');

            // -- Assert
            assert.strictEqual(mockShellUtil.exec.mock.callCount(), 2);
            assert.ok(mockShellUtil.exec.mock.calls[0].arguments[0].includes('git fetch origin main'));
            assert.ok(mockShellUtil.exec.mock.calls[1].arguments[0].includes('git fetch origin feature-branch'));
        });

        it('should only fetch base branch when head is empty', async () => {
            await service.fetchBranches('main', '');

            assert.strictEqual(mockShellUtil.exec.mock.callCount(), 1);
            assert.ok(mockShellUtil.exec.mock.calls[0].arguments[0].includes('git fetch origin main'));
        });
    });

    describe('getChangedFiles', () => {
        beforeEach(() => {
            // This test suite needs mocked GitUtil to test the service logic
            service = new ChangesetRequirementService({
                shellUtil: mockShellUtil,
                gitUtil: mockGitUtil
            });
        });

        it('should call gitUtil with correct parameters', () => {
            const mockFiles = ['src/file1.js', 'src/file2.js'];
            mockGitUtil.getChangedFilesBetweenRefs.mock.mockImplementationOnce(() => mockFiles);

            const result = service.getChangedFiles('main', 'feature', 'abc123', 'def456');

            assert.deepStrictEqual(result, mockFiles);
            assert.strictEqual(mockGitUtil.getChangedFilesBetweenRefs.mock.callCount(), 1);
            assert.deepStrictEqual(
                mockGitUtil.getChangedFilesBetweenRefs.mock.calls[0].arguments,
                ['main', 'feature', 'abc123', 'def456']
            );
        });
    });

    describe('findChangesetFiles', () => {
        beforeEach(() => {
            // This test suite doesn't need mocks, it's pure logic
            service = new ChangesetRequirementService();
        });

        it('should identify changeset files correctly', () => {
            const files = [
                'src/file1.js',
                '.changeset/major-update.md',
                'README.md',
                '.changeset/minor-fix.md',
                'docs/guide.md'
            ];

            const result = service.findChangesetFiles(files);

            assert.deepStrictEqual(result, [
                '.changeset/major-update.md',
                '.changeset/minor-fix.md'
            ]);
        });

        it('should not match non-changeset md files', () => {
            const files = [
                'README.md',
                'docs/api.md',
                '.changeset/config.json',
                '.changeset/README.md'
            ];

            const result = service.findChangesetFiles(files);

            assert.deepStrictEqual(result, ['.changeset/README.md']);
        });

        it('should return empty array when no files match', () => {
            const files = ['src/index.js', 'README.md'];
            const result = service.findChangesetFiles(files);
            assert.deepStrictEqual(result, []);
        });
    });

    describe('validateChangeset', () => {
        beforeEach(() => {
            // This test suite needs mocked GitUtil for integration testing
            service = new ChangesetRequirementService({
                shellUtil: mockShellUtil,
                gitUtil: mockGitUtil
            });
        });

        function createPRContext(overrides = {}) {
            return {
                eventName: 'pull_request',
                payload: {
                    pull_request: {
                        title: 'Fix bug',
                        body: 'Regular PR description',
                        head: { ref: 'feature-branch', sha: 'def456' },
                        base: { ref: 'main', sha: 'abc123' },
                        labels: [],
                        ...overrides.pull_request
                    }
                },
                actor: 'user',
                ...overrides
            };
        }

        it('should return skip result when shouldSkipCheck returns true', async () => {
            const context = createPRContext({
                eventName: 'push'
            });

            const result = await service.validateChangeset(context);

            assert.strictEqual(result.shouldSkip, true);
            assert.strictEqual(result.skipReason, 'Skip condition met (not PR, bot, release, or skip label)');
            assert.strictEqual(result.hasChangeset, false);
        });

        it('should return success result when changesets are found', async () => {
            const context = createPRContext();
            const mockFiles = ['src/index.js', '.changeset/feature.md'];

            mockGitUtil.getChangedFilesBetweenRefs.mock.mockImplementationOnce(() => mockFiles);

            const result = await service.validateChangeset(context, { fetchBranches: false });

            assert.strictEqual(result.shouldSkip, false);
            assert.strictEqual(result.hasChangeset, true);
            assert.deepStrictEqual(result.changedFiles, mockFiles);
            assert.deepStrictEqual(result.changesetFiles, ['.changeset/feature.md']);
            assert.strictEqual(result.error, null);
        });

        it('should return failure result when no changesets are found', async () => {
            const context = createPRContext();
            const mockFiles = ['src/index.js', 'README.md'];

            mockGitUtil.getChangedFilesBetweenRefs.mock.mockImplementationOnce(() => mockFiles);

            const result = await service.validateChangeset(context, { fetchBranches: false });

            assert.strictEqual(result.shouldSkip, false);
            assert.strictEqual(result.hasChangeset, false);
            assert.deepStrictEqual(result.changedFiles, mockFiles);
            assert.deepStrictEqual(result.changesetFiles, []);
            assert.strictEqual(result.error, null);
        });

        it('should return error result when git operations fail', async () => {
            const context = createPRContext();
            const errorMessage = 'Git command failed';

            mockGitUtil.getChangedFilesBetweenRefs.mock.mockImplementationOnce(() => {
                throw new Error(errorMessage);
            });

            const result = await service.validateChangeset(context, { fetchBranches: false });

            assert.strictEqual(result.shouldSkip, false);
            assert.strictEqual(result.hasChangeset, false);
            assert.strictEqual(result.error, errorMessage);
        });

        it('should use custom skip label', async () => {
            const context = createPRContext({
                pull_request: {
                    title: 'Fix bug [custom skip]'
                }
            });

            const result = await service.validateChangeset(context, {
                skipLabel: '[custom skip]',
                fetchBranches: false
            });

            assert.strictEqual(result.shouldSkip, true);
        });

        it('should fetch branches when fetchBranches is true', async () => {
            const context = createPRContext();
            mockGitUtil.getChangedFilesBetweenRefs.mock.mockImplementationOnce(() => []);

            await service.validateChangeset(context, { fetchBranches: true });

            assert.strictEqual(mockGitUtil.fetchBranch.mock.callCount(), 2);
        });
    });

    describe('generateErrorMessage', () => {
        beforeEach(() => {
            // This test suite doesn't need mocks, it's pure logic
            service = new ChangesetRequirementService();
        });

        it('should generate comprehensive error message', () => {
            const message = service.generateErrorMessage();

            assert.ok(message.includes('No changeset found'));
            assert.ok(message.includes('pnpm changeset'));
            assert.ok(message.includes('github.com/changesets/changesets'));
        });

        it('should return string message', () => {
            const message = service.generateErrorMessage();
            assert.strictEqual(typeof message, 'string');
            assert.ok(message.length > 0);
        });
    });

    describe('constructor', () => {
        it('should create default dependencies when none provided', () => {
            const defaultService = new ChangesetRequirementService();

            assert.ok(defaultService.gitUtil);
            assert.ok(defaultService.shellUtil);
        });

        it('should use injected dependencies', () => {
            const customGitUtil = { test: 'git' };
            const customShellUtil = { test: 'shell' };

            const customService = new ChangesetRequirementService({
                gitUtil: customGitUtil,
                shellUtil: customShellUtil
            });

            assert.strictEqual(customService.gitUtil, customGitUtil);
            assert.strictEqual(customService.shellUtil, customShellUtil);
        });
    });
});