import fs from 'node:fs';
import path from 'node:path';
import {
    loadChangesetFiles,
    getPackageInfo,
    runShellCommand,
    exec,
    extractMajorBumpPackagesFromChangesets,
} from '../utils/utils.js';

/**
 * @param {import('../utils/utils.js').FsApi} fsApi
 * @param {string} baseDir
 * @returns {Set<string>}
 */
function getMajorBumpPackages(fsApi, baseDir) {
    const files = loadChangesetFiles(fsApi, baseDir);
    if (files.length === 0) {
        console.log('ℹ️ No changesets found.');
        return new Set();
    }
    return extractMajorBumpPackagesFromChangesets(files);
}

/**
 * @param {import('../utils/utils.js').FsApi} fsApi
 * @param {string} baseDir
 * @returns {Record<string, {dirName: string, previousMajor: number, branchName: string}>}
 */
function planMaintenanceBranches(fsApi, baseDir) {
    const majorBumpPackages = getMajorBumpPackages(fsApi, baseDir);
    const branchPlan = {};

    if (majorBumpPackages.size === 0) {
        console.log('ℹ️ No major version bumps detected. No maintenance branches will be planned.');
        return branchPlan;
    }

    console.log(
        `⚠️ Major version bumps detected for packages: ${Array.from(majorBumpPackages).join(', ')}`
    );

    for (const pkgName of majorBumpPackages) {
        const pkgInfo = getPackageInfo(pkgName, fsApi, baseDir);
        if (!pkgInfo) {
            console.warn(`Could not find package.json for ${pkgName}. Skipping maintenance branch planning.`);
            continue;
        }

        const currentMajor = parseInt(pkgInfo.version.split('.')[0], 10);
        const branchNameForPkg = `release/${pkgInfo.dirName}_v${currentMajor}`;

        branchPlan[pkgName] = {
            dirName: pkgInfo.dirName,
            majorVersion: currentMajor,
            branchName: branchNameForPkg,
        };
    }

    return branchPlan;
}

/**
 * @param {Record<string, any>} plan
 * @param {import('../utils/utils.js').FsApi} fsApi
 * @param {string} baseDir
 */
function writePlanFile(plan, fsApi, baseDir) {
    const metaDir = path.resolve(baseDir, '.release-meta');
    if (!fsApi.existsSync(metaDir)) {
        fsApi.mkdirSync(metaDir, { recursive: true });
    }

    const filePath = path.resolve(metaDir, 'maintenance-branches.json');
    fsApi.writeFileSync(filePath, JSON.stringify(plan, null, 2));
    console.log(`✅ Wrote maintenance branch plan to ${filePath}`);
}

export function main(
    fsApi = fs,
    baseDir = process.cwd(),
    shell = exec
) {
    console.log('🚀 Starting version script...');

    const changesetsDir = path.resolve(baseDir, '.changeset');
    if (!fsApi.existsSync(changesetsDir) || fsApi.readdirSync(changesetsDir).filter(f => f !== 'README.md').length === 0) {
        console.log('✅ No changesets found. Skipping versioning.');
        return;
    }

    const plan = planMaintenanceBranches(fsApi, baseDir);
    writePlanFile(plan, fsApi, baseDir);

    runShellCommand('pnpm changeset version', shell);

    console.log('✅ Version script completed successfully.');
}

if (import.meta.url === `file://${process.argv[1]}`) {
    try {
        main();
    } catch (err) {
        console.error(err.message);
        process.exit(1);
    }
}