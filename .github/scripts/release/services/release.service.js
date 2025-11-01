import { GitUtil } from '../../utils/git.util.js';


export class ReleaseService {
    constructor(gitService, shellService, fsApi) {
        this.git = gitService;
        this.shell = shellService;
        this.fs = fsApi;
    }

    static create(shell, fsApi) {
        const gitService = new GitUtil(shell);
        return new ReleaseService(gitService, shell, fsApi);
    }

    planRelease(ctx) {
        const { isMultiRelease, isMainBranch } = ctx;
        const steps = [];
        const planFilePath = this.fs.resolve(process.cwd(), '.release-meta', 'maintenance-branches.json');
        const planFileExists = this.fs.existsSync(planFilePath);
        const plan = planFileExists ? JSON.parse(this.fs.readFileSync(planFilePath, 'utf-8')) : {};

        if (Object.getOwnPropertyNames(plan).length > 0 && isMultiRelease && isMainBranch) {
            for (const pkgName in plan) {
                const { branchName } = plan[pkgName];
                steps.push({ type: 'ensure-maintenance-branch', branchName });
            }
        }

        steps.push({ type: 'exec', cmd: 'pnpm changeset publish' });

        console.log(`planned release steps: ${steps.map((s) => s.type).join(', ')}`);
        return steps;
    }

    executeSteps(steps) {
        for (const step of steps) {
            switch (step.type) {
                case 'log-warn': {
                    console.warn(step.msg);
                    break;
                }

                case 'exec': {
                    this.shell.run(step.cmd, { stdio: 'inherit' });
                    break;
                }

                case 'ensure-maintenance-branch': {
                    this.ensureMaintenanceBranch(step.branchName);
                    break;
                }

                default:
                    throw new Error(`Unknown step type: ${step.type}`);
            }
        }
    }

    ensureMaintenanceBranch(branchName) {
        console.log(`Checking for branch '${branchName}'...`);

        const branchExists = this.git.checkRemoteBranch(branchName);

        if (!branchExists) {
            console.log(`Creating '${branchName}'...`);
            this.git.createBranch(branchName, 'HEAD~1');
            this.git.pushBranch(branchName);
            console.log(`✅ Created and pushed '${branchName}' from previous commit.`);
        } else {
            console.log(`✅ Branch '${branchName}' already exists.`);
        }
    }

    getReleaseContext(env) {
        const isMultiRelease = env.ENABLE_MULTI_RELEASE === 'true';
        const branchName = env.GITHUB_REF_NAME;
        const isReleaseBranch = Boolean(branchName && branchName.startsWith('release/'));
        const isMainBranch = branchName === 'main';

        return {
            isMultiRelease,
            branchName,
            isReleaseBranch,
            isMainBranch
        };
    }

    async validatePreconditions(ctx) {
        const { branchName, isMultiRelease, isReleaseBranch, isMainBranch } = ctx;

        // Check branch conditions first to avoid unnecessary git calls
        if (!isMainBranch && !isReleaseBranch && isMultiRelease) {
            console.warn(`Skipping release : on branch ${branchName}. for Multi-Release mode .`);
            return { proceedWithRelease: false };
        }

        const changedFiles = await this.git.getChangedFiles();
        const latestChangesAreReleaseChanges = changedFiles.some(file =>
            file.endsWith('package.json') || file.endsWith('CHANGELOG.md')
        );

        console.log(`Checking for release commit by inspecting changed files in HEAD...`);

        if (latestChangesAreReleaseChanges) {
            console.log('✅ Versioning changes detected (package.json, CHANGELOG.md, or .changeset/ files modified). Proceeding with release.');
            return { proceedWithRelease: true };
        }

        return { proceedWithRelease: false };
    }

    async run(env = process.env) {
        console.log('🚀 Starting release script...');

        const ctx = this.getReleaseContext(env);
        const { proceedWithRelease } = await this.validatePreconditions(ctx);

        console.log(`🔍 Current branch: ${ctx.branchName}`);
        console.log(`🔍 Multi-release mode: ${ctx.isMultiRelease}`);
        console.log(`Proceed with release: ${proceedWithRelease}`);

        if (!proceedWithRelease) {
            console.log('ℹ️ Skipping release process: No steps to execute.');
            return;
        }

        const steps = this.planRelease(ctx);
        console.log('📝 Planned steps:', steps.map((s) => s.type).join(', '));

        this.executeSteps(steps);
        console.log('✅ Release process completed successfully.');
    }
}