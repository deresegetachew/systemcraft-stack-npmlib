export class GitUtil {
    constructor(shellService) {
        this.shell = shellService;
    }

    async getChangedFiles() {
        const strategies = [
            'git diff --name-only HEAD~1..HEAD',
            'git diff --name-only HEAD^..HEAD'
        ];

        for (const command of strategies) {
            try {
                console.log(`Trying: ${command}`);
                const result = this.shell.exec(command, { stdio: 'pipe' });
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

    checkRemoteBranch(branchName) {
        const result = this.shell.exec(`git ls-remote --heads origin ${branchName}`, { stdio: 'pipe' });
        return result.stdout.trim() !== '';
    }

    createBranch(branchName, fromCommit = 'HEAD~1') {
        this.shell.run(`git branch ${branchName} ${fromCommit}`);
    }

    pushBranch(branchName) {
        this.shell.run(`git push origin ${branchName}`);
    }
}