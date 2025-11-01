import path from 'node:path';

export class PackageUtil {
    constructor(fsApi) {
        this.fs = fsApi;
    }

    getPackageInfo(packageName, baseDir) {
        const packageDirName = packageName.split('/').pop();
        const packagePath = path.resolve(baseDir, 'packages', packageDirName);
        const packageJsonPath = path.join(packagePath, 'package.json');

        if (!this.fs.existsSync(packageJsonPath)) {
            return null;
        }

        const packageJson = JSON.parse(this.fs.readFileSync(packageJsonPath, 'utf-8'));
        return {
            version: packageJson.version,
            dirName: packageDirName,
        };
    }

    loadChangesetFiles(baseDir) {
        const changesetsDir = path.resolve(baseDir, '.changeset');

        if (!this.fs.existsSync(changesetsDir)) {
            return [];
        }

        return this.fs
            .readdirSync(changesetsDir)
            .filter((f) => f.endsWith('.md') && f !== 'README.md')
            .map((filename) => ({
                filename,
                content: this.fs.readFileSync(path.join(changesetsDir, filename), 'utf-8'),
            }));
    }

    static extractMajorBumpPackagesFromChangesets(changesetFiles) {
        const majorBumpPackages = new Set();

        for (const { content } of changesetFiles) {
            const lines = content.split('\n');
            for (const line of lines) {
                if (line.includes(': major')) {
                    // This regex looks for a quoted package name followed by ": major"
                    const match = line.match(/"([^\"]+)"\s*:\s*major/);
                    const packageName = match ? match[1] : null;
                    if (packageName) {
                        majorBumpPackages.add(packageName);
                    }
                }
            }
        }
        return majorBumpPackages;
    }

    static sanitizePackageDir(nameOrDir) {
        // turn @scope/pkg -> at-scope__pkg (safe for artifact folder names)
        return nameOrDir.replaceAll("@", "at-").replaceAll("/", "__");
    }
}

// Function exports for application code
export function getPackageInfo(packageName, fsApi, baseDir) {
    const packageUtil = new PackageUtil(fsApi);
    return packageUtil.getPackageInfo(packageName, baseDir);
}

export function loadChangesetFiles(fsApi, baseDir) {
    const packageUtil = new PackageUtil(fsApi);
    return packageUtil.loadChangesetFiles(baseDir);
}

export function extractMajorBumpPackagesFromChangesets(changesetFiles) {
    return PackageUtil.extractMajorBumpPackagesFromChangesets(changesetFiles);
}

export function sanitizePackageDir(nameOrDir) {
    return PackageUtil.sanitizePackageDir(nameOrDir);
}