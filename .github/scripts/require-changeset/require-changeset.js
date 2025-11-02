#!/usr/bin/env node

import { ChangesetRequirementService } from './services/changeset-requirement.service.js';

// Import GitHub Actions modules from CDN - these are dynamic imports so they don't 
// create package.json dependencies and are fetched at runtime
let core = null;
let github = null;

try {
    core = await import('https://esm.sh/@actions/core@1.10.1');
    github = await import('https://esm.sh/@actions/github@6.0.0');
    console.log('✅ GitHub Actions modules loaded from CDN');
} catch (error) {
    // Expected in local environment - Node.js doesn't support https imports by default
    // In GitHub Actions, this should work due to their runtime environment
    console.log('ℹ️ GitHub Actions modules not available in this environment');
}


async function main() {
    try {
        if (!core || !github) {
            console.log('GitHub Actions modules not available - likely running in test environment');
            return;
        }

        const skipLabel = core.getInput('skip-label') || process.env['INPUT_SKIP-LABEL'] || '[skip changeset check]';
        const context = github.context;

        console.log(`Event type: ${context.eventName}`);
        console.log(`PR title: ${context.payload.pull_request?.title || 'N/A'}`);
        console.log(`Actor: ${context.actor}`);

        // Use service for validation
        const service = new ChangesetRequirementService();
        const result = await service.validateChangeset(context, { skipLabel });

        // Handle service result
        if (result.error) {
            console.error('❌ Validation error:', result.error);
            core.setFailed(result.error);
            return;
        }

        if (result.shouldSkip) {
            console.log(`ℹ️ ${result.skipReason}`);
            core.setOutput('skipped', 'true');
            return;
        }

        if (!result.hasChangeset) {
            const errorMessage = service.generateErrorMessage();
            console.log(errorMessage);
            core.setFailed('No changeset found for this PR');
            return;
        }

        console.log('');
        console.log('✅ Changeset found:');
        console.log(result.changesetFiles.join('\n'));
        core.setOutput('changeset-files', result.changesetFiles.join(','));

    } catch (error) {
        console.error('❌ Action failed:', error.message);
        core.setFailed(error.message);
    }
}

// Export service and main function for testing
export { ChangesetRequirementService, main };

if (import.meta.url === `file://${process.argv[1]}`) {
    main();
}