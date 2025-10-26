const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function exec(command, options = {}) {
  console.log(`> ${command}`);
  try {
    return execSync(command, { stdio: 'inherit', ...options });
  } catch (e) {
    console.error(`❌ Command failed: ${command}`);
    process.exit(1);
  }
}

/**
 * @returns {Set<string>} A set of package names with major version bumps.
 */
function getMajorBumpPackages() {
  const changesetsDir = path.resolve(process.cwd(), '.changeset');
  if (!fs.existsSync(changesetsDir)) {
    console.log('ℹ️ No changesets found.');
    return new Set();
  }

  const majorBumpPackages = new Set();
  const changesetFiles = fs.readdirSync(changesetsDir).filter(f => f.endsWith('.md'));

  for (const file of changesetFiles) {
    const content = fs.readFileSync(path.join(changesetsDir, file), 'utf-8');
    const lines = content.split('\n');
    for (const line of lines) {
      if (line.includes(': major')) {
        const packageName = line.split(':')[0].replace(/['"-]/g, '').trim();
        majorBumpPackages.add(packageName);
      }
    }
  }

  return majorBumpPackages;
}

function getPackageInfo(packageName) {
  // This is a simplified lookup. Assumes packages are in `packages/`.
  // A more robust solution would parse pnpm-workspace.yaml.
  const packageDirName = packageName.split('/').pop();
  const packagePath = path.resolve(process.cwd(), 'packages', packageDirName);
  const packageJsonPath = path.join(packagePath, 'package.json');

  if (!fs.existsSync(packageJsonPath)) {
    return null;
  }

  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
  return {
    version: packageJson.version,
    dirName: packageDirName,
  };
}

function main() {
  console.log('🚀 Starting release script...');

  const isMultiRelease = process.env.ENABLE_MULTI_RELEASE === 'true';
  const currentBranch = process.env.GITHUB_REF_NAME;

  console.log(`🔍 Current branch: ${currentBranch}`);
  console.log(`🔍 Multi-release mode: ${process.env.ENABLE_MULTI_RELEASE}`);

  if (!isMultiRelease) {
    console.log('ℹ️ Single-release mode detected. Running standard publish.');
    exec('pnpm changeset publish');
    return;
  }

  console.log('ℹ️ Multi-release mode detected.');

  if (currentBranch !== 'main') {
    console.log(`ℹ️ Not on main branch (current: ${currentBranch}). Running standard publish for this branch.`);
    exec('pnpm changeset publish');
    return;
  }

  console.log('🌿 On main branch. Checking for major releases to create maintenance branches...');

  const majorBumpPackages = getMajorBumpPackages();

  if (majorBumpPackages.size === 0) {
    console.log('✅ No major version bumps found. Proceeding with standard publish.');
  } else {
    console.log(`⚠️ Found ${majorBumpPackages.size} packages with major bumps:`, Array.from(majorBumpPackages));

    for (const pkgName of majorBumpPackages) {
      const pkgInfo = getPackageInfo(pkgName);
      if (!pkgInfo) {
        console.warn(`Could not find package.json for ${pkgName}. Skipping.`);
        continue;
      }

      const currentMajor = pkgInfo.version.split('.')[0];
      const branchName = `release/${pkgInfo.dirName}_v${currentMajor}`;

      console.log(`Checking for maintenance branch for ${pkgName}@${pkgInfo.version}...`);

      const branchExists = exec(`git ls-remote --heads origin ${branchName}`, { stdio: 'pipe' }).toString().trim() !== '';

      if (branchExists) {
        console.log(`✅ Branch '${branchName}' already exists.`);
      } else {
        console.log(`‼️ Branch '${branchName}' does not exist. Creating it now...`);
        exec(`git branch ${branchName}`);
        exec(`git push origin ${branchName}`);
        console.log(`✅ Successfully created and pushed branch '${branchName}'.`);
      }
    }
  }

  console.log('🏃 Running changeset publish...');
  exec('pnpm changeset publish');
  console.log('✅ Release process completed successfully.');
}

main();
