import { describe, it, mock, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { VersionService } from './services/version.service.js';

describe('VersionService', () => {
    let mockFsApi;
    let mockShellService;
    let versionService;
    let originalEnv;

    beforeEach(() => {
        originalEnv = { ...process.env };

        // Mock filesystem
        mockFsApi = {
            existsSync: mock.fn(() => true),
            readdirSync: mock.fn(() => ['major-bump.md']),
            readFileSync: mock.fn(),
            mkdirSync: mock.fn(),
            writeFileSync: mock.fn()
        };

        // Mock shell service
        mockShellService = {
            run: mock.fn(() => ({ stdout: '' }))
        };

        versionService = VersionService.create(mockShellService, mockFsApi);
    });

    afterEach(() => {
        process.env = originalEnv;
        mock.restoreAll();
    });

    describe('main()', () => {
        it('should skip if no changesets are found', async () => {
            // -- Arrange
            mockFsApi.existsSync.mock.mockImplementation(() => false);

            // -- Act
            await versionService.run(process.env);

            // -- Assert
            assert.strictEqual(mockFsApi.writeFileSync.mock.callCount(), 1);
            assert.strictEqual(mockShellService.run.mock.callCount(), 0, 'Should not run changeset version');
        });

        it('should write an empty plan file if no major bumps are detected', async () => {
            // -- Arrange
            mockFsApi.readFileSync.mock.mockImplementation(() => `
---
"@scope/lib-one": patch
---

Fix a small bug
            `);

            // -- Act
            await versionService.run(process.env);

            // -- Assert
            assert.strictEqual(mockFsApi.writeFileSync.mock.callCount(), 1);
            const writeCall = mockFsApi.writeFileSync.mock.calls[0];
            const writtenContent = JSON.parse(writeCall.arguments[1]);
            assert.deepStrictEqual(writtenContent, {});
        });

        it('should plan a maintenance branch for a single major bump', async () => {
            // -- Arrange
            mockFsApi.readFileSync.mock.mockImplementation((path) => {
                if (path.includes('.md')) {
                    return `
---
"@scope/lib-one": major
---

Breaking change
                    `;
                } else if (path.includes('package.json')) {
                    return JSON.stringify({
                        name: '@scope/lib-one',
                        version: '2.0.0'
                    });
                }
            });

            // -- Act
            await versionService.run(process.env);

            // -- Assert
            assert.strictEqual(mockFsApi.writeFileSync.mock.callCount(), 1);
            const writeCall = mockFsApi.writeFileSync.mock.calls[0];
            const writtenContent = JSON.parse(writeCall.arguments[1]);

            assert.ok(writtenContent['@scope/lib-one']);
            assert.strictEqual(writtenContent['@scope/lib-one'].version, '2.0.0');
            assert.ok(writtenContent['@scope/lib-one'].branchName.includes('lib-one'));

            assert.strictEqual(mockShellService.run.mock.callCount(), 1);
            assert.ok(mockShellService.run.mock.calls[0].arguments[0].includes('changeset version'));
        });

        it('should plan branches for multiple major bumps', async () => {
            // -- Arrange
            mockFsApi.readdirSync.mock.mockImplementation(() => ['bump1.md', 'bump2.md']);

            let readCount = 0;
            mockFsApi.readFileSync.mock.mockImplementation((path) => {
                if (path.includes('.md')) {
                    readCount++;
                    if (readCount === 1) {
                        return `---\n"@scope/lib-one": major\n---\nBreaking change in lib-one`;
                    } else {
                        return `---\n"@scope/lib-two": major\n---\nBreaking change in lib-two`;
                    }
                } else if (path.includes('lib-one')) {
                    return JSON.stringify({ name: '@scope/lib-one', version: '2.0.0' });
                } else if (path.includes('lib-two')) {
                    return JSON.stringify({ name: '@scope/lib-two', version: '3.0.0' });
                }
            });

            // -- Act
            await versionService.run(process.env);

            // -- Assert
            assert.strictEqual(mockFsApi.writeFileSync.mock.callCount(), 1);
            const writeCall = mockFsApi.writeFileSync.mock.calls[0];
            const writtenContent = JSON.parse(writeCall.arguments[1]);

            assert.ok(writtenContent['@scope/lib-one']);
            assert.ok(writtenContent['@scope/lib-two']);
            assert.strictEqual(mockShellService.run.mock.callCount(), 1);
        });
    });
});