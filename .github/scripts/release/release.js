import fs from 'node:fs';
import path from 'node:path';
import { runShellCommand, exec } from '../utils/utils.js';

function planRelease(ctx, branchInfo, fsApi, baseDir) {
  const { isMultiRelease } = ctx;

  if (!isMultiRelease) {
    return [{ type: 'exec', cmd: 'pnpm changeset publish' }]; // Single-release mode just publishes
  }

  if (!branchInfo.isMainBranch) {
    return [{ type: 'exec', cmd: 'pnpm changeset publish' }]; // On a release branch, just publish
  }

  const steps = [];
  const planFile = path.resolve(baseDir, '.release-meta', 'maintenance-branches.json');

  if (fsApi.existsSync(planFile)) {
    const plan = JSON.parse(fsApi.readFileSync(planFile, 'utf-8'));
    for (const pkgName in plan) {
      const { branchName } = plan[pkgName];
      steps.push({ type: 'ensure-maintenance-branch', branchName });
    }
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
        runShellCommand(step.cmd, shell, { stdio: 'inherit' });
        break;
      }

      case 'ensure-maintenance-branch': {
        const { branchName } = step;

        console.log(`Checking for branch '${branchName}'...`);

        const { stdout } = runShellCommand(`git ls-remote --heads origin ${branchName}`, shell, { stdio: 'pipe' });
        const branchExists = stdout.trim() !== '';

        if (!branchExists) {
          console.log(`Creating '${branchName}'...`);
          // Create branch from the commit before the "Version Packages" merge commit
          runShellCommand(`git branch ${branchName} HEAD~1`, shell);
          runShellCommand(`git push origin ${branchName}`, shell);
          console.log(`✅ Created and pushed '${branchName}' from previous commit.`);
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

function getReleaseContext(env) {
  const isMultiRelease = env.ENABLE_MULTI_RELEASE === 'true';
  const branchName = env.GITHUB_REF_NAME;

  return {
    isMultiRelease,
    branchName,
  };
}

function validatePreconditions(ctx) {
  const { branchName } = ctx;
  const isMainBranch = branchName === 'main';
  const isReleaseBranch = Boolean(branchName && branchName.startsWith('release/'));

  if (!isMainBranch && !isReleaseBranch) {
    throw new Error(`❌ Invalid branch: ${branchName}. Please use 'main' or 'release/*' branches when releasing`);
  }
  return { isMainBranch, isReleaseBranch };
}

export function main(
  env = process.env,
  fsApi = fs,
  baseDir = process.cwd(),
  shell = exec
) {
  console.log('🚀 Starting release script...');

  const ctx = getReleaseContext(env);
  const branchInfo = validatePreconditions(ctx);

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
