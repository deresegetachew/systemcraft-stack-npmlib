import { promises as fs } from 'node:fs';
import path from 'node:path';
import * as cp from 'node:child_process';
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

function exec(command, options = {}, cpApi = cp) {
    console.log(`> ${command}`);
    try {
        const output = cpApi.execSync(command, { stdio: 'inherit', ...options });

        if (output === null || output === undefined)
            return { stdout: '' };
        return { stdout: output.toString() };
    } catch (e) {
        console.error(`❌ Command failed: ${command}`);
        // If stdio is 'pipe', throw error to allow caller to handle it
        if (options.stdio === 'pipe') {
            throw e;
        }
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

export function runShellCommand(cmd, shellFn, options = {}) {
    console.log(`▶ ${cmd}`);
    // Use internal exec if no shell function provided or if it's not a function
    const actualShellFn = (typeof shellFn === 'function') ? shellFn : exec;
    return actualShellFn(cmd, options);
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

export async function getChangedFiles(shell) {
    const actualShell = shell || ((cmd, options) => exec(cmd, options));

    const strategies = [
        // Strategy 1: Compare with parent commit (most common)
        'git diff --name-only HEAD~1..HEAD',
        // Strategy 2: Alternative parent syntax
        'git diff --name-only HEAD^..HEAD'
    ];

    for (const command of strategies) {
        try {
            console.log(`Trying: ${command}`);
            const result = actualShell(command, { stdio: 'pipe' });
            const files = result.stdout.split('\n').filter(Boolean);

            console.log(`result.stdout:\n${result.stdout}`);
            console.log(`Files changed:\n${files.join('\n')}`);

            if (files.length > 0) {
                console.log(`✅ Found ${files.length} changed files using: ${command}`);
                return files;
            }
        } catch (error) {
            console.log(`❌ Failed: ${command} - ${error.message}`);
        }
    }

    console.warn('⚠️  No git strategy worked, returning empty array');
    return [];
}

// Export for testing only - do not use directly in application code
export { exec as __testExec };