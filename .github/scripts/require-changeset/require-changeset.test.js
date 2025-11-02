import { describe, it, afterEach, mock } from 'node:test';
import assert from 'node:assert';
import { ChangesetRequirementService, main } from './require-changeset.js';

describe('Changeset Requirement GitHub Action', () => {
    afterEach(() => {
        mock.restoreAll();
    });

    describe('Service Export', () => {
        it('should export ChangesetRequirementService', () => {
            assert.ok(ChangesetRequirementService);
            assert.strictEqual(typeof ChangesetRequirementService, 'function');
        });

        it('should allow service instantiation', () => {
            const service = new ChangesetRequirementService();
            assert.ok(service);
            assert.ok(service.shouldSkipCheck);
            assert.ok(service.validateChangeset);
        });
    });

    describe('GitHub Actions Integration', () => {
        it('should handle missing GitHub Actions modules', async () => {
            const result = await main();
            assert.strictEqual(result, undefined);
        });

        it('should export main function', () => {
            assert.ok(main);
            assert.strictEqual(typeof main, 'function');
        });
    });
});

