import path from 'node:path';
import {
    loadChangesetFiles,
    getPackageInfo,
    PackageUtil,

} from '../../utils/package.util.js';

export class VersionService {
    constructor(shellUtil, fsApi) {
        this.shell = shellUtil;
        this.fs = fsApi;
    }

    static create(shell, fsApi) {

        return new VersionService(shell, fsApi);
    }

    getMajorBumpPackages(baseDir) {
        const files = loadChangesetFiles(this.fs, baseDir);
        if (files.length === 0) {
            console.log('ℹ️ No changesets found.');
            return new Set();
        }
        return PackageUtil.extractMajorBumpPackagesFromChangesets(files);
    }

    generateMaintenancePlan(majorBumpPackages, baseDir) {
        const plan = {};

        for (const packageName of majorBumpPackages) {
            const pkgInfo = getPackageInfo(packageName, this.fs, baseDir);
            if (!pkgInfo) {
                console.warn(`⚠️ Package info not found for ${packageName}. Skipping...`);
                continue;
            }

            const branchName = `release/${pkgInfo.dirName}@${pkgInfo.version}`;
            plan[packageName] = { branchName, version: pkgInfo.version, dirName: pkgInfo.dirName };
            console.log(`📋 Planned maintenance branch: ${branchName}`);
        }

        return plan;
    }

    writePlanFile(plan, baseDir) {
        const releaseMetaDir = path.resolve(baseDir, '.release-meta');
        const planFilePath = path.join(releaseMetaDir, 'maintenance-branches.json');

        if (!this.fs.existsSync(releaseMetaDir)) {
            this.fs.mkdirSync(releaseMetaDir, { recursive: true });
        }

        this.fs.writeFileSync(planFilePath, JSON.stringify(plan, null, 2), 'utf-8');
        console.log(`✅ Plan written to: ${planFilePath}`);
    }

    runChangesetVersion() {
        this.shell.run('pnpm changeset version');
    }

    async run(env = process.env, baseDir = process.cwd()) {
        console.log('🔄 Starting version script...');

        const majorBumpPackages = this.getMajorBumpPackages(baseDir);

        if (majorBumpPackages.size === 0) {
            console.log('ℹ️ No major version bumps detected. Writing empty plan file.');
            this.writePlanFile({}, baseDir);
            return;
        }

        console.log(`🔍 Major bump packages detected: ${Array.from(majorBumpPackages).join(', ')}`);

        const plan = this.generateMaintenancePlan(majorBumpPackages, baseDir);
        this.writePlanFile(plan, baseDir);

        console.log('📦 Running changeset version...');
        this.runChangesetVersion();

        console.log('✅ Version script completed successfully.');
    }

}

// Legacy function export for backward compatibility
export function createVersionService(shell, fsApi) {
    return VersionService.create(shell, fsApi);
}