import { promises as fs } from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import process from 'node:process';


export async function ensureDir(d) {
    await fs.mkdir(d, { recursive: true });
}

export async function exists(p) {
    try {
        await fs.access(p);
        return true;
    } catch {
        return false;
    }
}

export function exec(command, options = {}) {
    console.log(`> ${command}`);
    try {
        return execSync(command, { stdio: 'inherit', ...options });
    } catch (e) {
        console.error(`❌ Command failed: ${command}`);
        process.exit(1);
    }
}

export function getPackageInfo(packageName, fsApi, baseDir) {
    const packageDirName = packageName.split('/').pop();
    const packagePath = path.resolve(baseDir, 'packages', packageDirName);
    const packageJsonPath = path.join(packagePath, 'package.json');

    if (!fsApi.existsSync(packageJsonPath)) {
        return null;
    }

    const packageJson = JSON.parse(fsApi.readFileSync(packageJsonPath, 'utf-8'));
    return {
        version: packageJson.version,
        dirName: packageDirName,
    };

}

export function loadChangesetFiles(fsApi, baseDir) {
    const changesetsDir = path.resolve(baseDir, '.changeset');

    if (!fsApi.existsSync(changesetsDir)) {
        return [];
    }

    return fsApi
        .readdirSync(changesetsDir)
        .filter((f) => f.endsWith('.md') && f !== 'README.md')
        .map((filename) => ({
            filename,
            content: fsApi.readFileSync(path.join(changesetsDir, filename), 'utf-8'),
        }));
}

export function extractMajorBumpPackagesFromChangesets(changesetFiles) {
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

export function runShellCommand(cmd, shellFn = exec, options = {}) {
    console.log(`▶ ${cmd}`);
    return shellFn(cmd, options);
}

export function sanitizePackageDir(nameOrDir) {
    // turn @scope/pkg -> at-scope__pkg (safe for artifact folder names)
    return nameOrDir.replaceAll("@", "at-").replaceAll("/", "__");
}

export async function getPackageName(pkgDir) {
    try {
        const pkgJson = JSON.parse(await fs.readFile(path.join(pkgDir, "package.json"), "utf8"));
        if (pkgJson && typeof pkgJson.name === "string") return pkgJson.name;
    } catch {
        // ignore
    }
    return path.basename(pkgDir);
}