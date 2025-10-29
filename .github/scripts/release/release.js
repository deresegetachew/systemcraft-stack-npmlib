import fs from 'node:fs';
import path from 'node:path';
import { loadChangesetFiles, getPackageInfo, runShellCommand } from '../utils/utils.js';


function getReleaseContext(env) {
  const isMultiRelease = env.ENABLE_MULTI_RELEASE === 'true';
  const branchName = env.GITHUB_REF_NAME;

  return {
    isMultiRelease,
    branchName,
  };
}


function extractMajorBumpPackagesFromChangesets(changesetFiles) {
  const majorBumpPackages = new Set();

  for (const { content } of changesetFiles) {
    const lines = content.split('\n');
    for (const line of lines) {
      if (line.includes(': major')) {
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


function getMajorBumpPackages(fsApi, baseDir) {
  const files = loadChangesetFiles(fsApi, baseDir);
  if (files.length === 0) {
    console.log('ℹ️ No changesets found.');
    return new Set();
  }
  return extractMajorBumpPackagesFromChangesets(files);
}


function validatePreconditions(ctx, fsApi, baseDir) {
  const { branchName } = ctx;

  const isMainBranch = branchName === 'main';
  const isReleaseBranch = Boolean(branchName && branchName.startsWith('release/'));

  if (!isMainBranch && !isReleaseBranch) {
    throw new Error(
      `❌ Invalid branch: ${branchName}. Please use 'main' or 'release/*' branches when releasing`
    );
  }

  const changesetsDir = path.resolve(baseDir, '.changeset');
  if (!fsApi.existsSync(changesetsDir)) {
    throw new Error(
      '❌ .changeset directory does not exist. Make sure to run this script in the root of the repository where .changeset exists.'
    );
  }

  return {
    isMainBranch,
    isReleaseBranch,
  };
}


function planRelease(ctx, branchInfo, fsApi, baseDir) {
  const { isMultiRelease } = ctx;

  if (!isMultiRelease) {
    return [{ type: 'exec', cmd: 'pnpm changeset publish' }];
  }

  if (!branchInfo.isMainBranch) {
    return [{ type: 'exec', cmd: 'pnpm changeset publish' }];
  }

  const steps = [];

  const majorBumpPackages = getMajorBumpPackages(fsApi, baseDir);

  if (majorBumpPackages.size === 0) {
    // No majors → normal publish.
    console.log('ℹ️ No major version bumps detected.');
    steps.push({ type: 'exec', cmd: 'pnpm changeset publish' });
    return steps;
  }

  console.log(`⚠️ Major version bumps detected for packages: ${Array.from(majorBumpPackages).join(', ')}`);

  for (const pkgName of majorBumpPackages) {
    const pkgInfo = getPackageInfo(pkgName, fsApi, baseDir);
    if (!pkgInfo) {
      steps.push({
        type: 'log-warn',
        msg: `Could not find package.json for ${pkgName}. Skipping maintenance branch creation.`,
      });
      continue;
    }

    const currentMajor = pkgInfo.version.split('.')[0];
    const branchNameForPkg = `release/${pkgInfo.dirName}_v${currentMajor}`;

    steps.push({
      type: 'ensure-maintenance-branch',
      branchName: branchNameForPkg,
    });
  }

  steps.push({ type: 'exec', cmd: 'pnpm changeset publish' });

  return steps;
}


function executeSteps(steps, shell) {
  for (const step of steps) {
    switch (step.type) {
      case 'log-warn': {
        console.warn(step.msg);
        break;
      }

      case 'exec': {
        shell(step.cmd);
        break;
      }

      case 'ensure-maintenance-branch': {
        const { branchName } = step;

        console.log(`Checking for branch '${branchName}'...`);

        const branchExists =
          shell(`git ls-remote --heads origin ${branchName}`, {
            stdio: 'pipe',
          })
            .toString()
            .trim() !== '';

        if (!branchExists) {
          console.log(`Creating '${branchName}'...`);
          shell(`git branch ${branchName}`);
          shell(`git push origin ${branchName}`);
          console.log(`✅ Created and pushed '${branchName}'`);
        } else {
          console.log(`✅ Branch '${branchName}' already exists.`);
        }
        break;
      }

      default:
        throw new Error(`Unknown step type: ${step.type}`);
    }
  }
}


export function main(
  env = process.env,
  fsApi = fs,
  baseDir = process.cwd(),
  shell = runShellCommand
) {
  console.log('🚀 Starting release script...');

  const ctx = getReleaseContext(env);
  const branchInfo = validatePreconditions(ctx, fsApi, baseDir);

  console.log(`🔍 Current branch: ${ctx.branchName}`);
  console.log(`🔍 Multi-release mode: ${ctx.isMultiRelease}`);

  const steps = planRelease(ctx, branchInfo, fsApi, baseDir);

  console.log('📝 Planned steps:', steps.map((s) => s.type).join(', '));

  executeSteps(steps, shell);

  console.log('✅ Release process completed successfully.');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    main();
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}
