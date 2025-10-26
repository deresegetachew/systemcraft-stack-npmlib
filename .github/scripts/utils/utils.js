import path from 'node:path';


async function ensureDir(d) {
    await fs.mkdir(d, { recursive: true });
}

async function exists(p) {
    try {
        await fs.access(p);
        return true;
    } catch {
        return false;
    }
}

function exec(command, options = {}) {
    console.log(`> ${command}`);
    try {
        return execSync(command, { stdio: 'inherit', ...options });
    } catch (e) {
        console.error(`❌ Command failed: ${command}`);
        process.exit(1);
    }
}

function getPackageInfo(packageName, fsApi, baseDir) {
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

function loadChangesetFiles(fsApi, baseDir) {
    const changesetsDir = path.resolve(baseDir, '.changeset');

    if (!fsApi.existsSync(changesetsDir)) {
        return [];
    }

    return fsApi
        .readdirSync(changesetsDir)
        .filter((f) => f.endsWith('.md'))
        .map((filename) => ({
            filename,
            content: fsApi.readFileSync(path.join(changesetsDir, filename), 'utf-8'),
        }));
}

function runShellCommand(cmd, shellFn = exec, options = {}) {
    console.log(`▶ ${cmd}`);
    return shellFn(cmd, options);
}

export default {
    ensureDir,
    exists,
    getPackageInfo,
    loadChangesetFiles,
    runShellCommand
}