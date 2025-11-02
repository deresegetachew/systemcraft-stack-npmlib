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

    getChangedFilesBetweenRefs(baseRef, headRef, baseSha, headSha) {
        const strategies = [
            // Strategy 1: Use branch references (most reliable)
            () => {
                if (!headRef) return '';
                try {
                    const result = this.shell.exec(`git diff --name-only origin/${baseRef}...origin/${headRef}`, { stdio: 'pipe' });
                    return result.stdout;
                } catch {
                    return '';
                }
            },

            // Strategy 2: Use SHAs with three-dot syntax (finds merge base automatically)
            () => {
                if (!baseSha || !headSha) return '';
                try {
                    const result = this.shell.exec(`git diff --name-only ${baseSha}...${headSha}`, { stdio: 'pipe' });
                    return result.stdout;
                } catch {
                    return '';
                }
            },

            // Strategy 3: Use SHAs with two-dot syntax
            () => {
                if (!baseSha || !headSha) return '';
                try {
                    const result = this.shell.exec(`git diff --name-only ${baseSha}..${headSha}`, { stdio: 'pipe' });
                    return result.stdout;
                } catch {
                    return '';
                }
            },

            // Strategy 4: Compare HEAD to base branch
            () => {
                try {
                    const result = this.shell.exec(`git diff --name-only origin/${baseRef}...HEAD`, { stdio: 'pipe' });
                    return result.stdout;
                } catch {
                    return '';
                }
            }
        ];

        for (let i = 0; i < strategies.length; i++) {
            console.log(`Trying diff strategy ${i + 1}...`);
            const result = strategiesi;
            if (result && result.trim()) {
                const files = result.trim().split('\n').filter(Boolean);
                console.log(`✅ Successfully got ${files.length} changed files using strategy ${i + 1}`);
                return files;
            }
        }

        throw new Error('Could not get changed files with any method');
    }

    fetchBranch(ref) {
        try {
            this.shell.exec(`git fetch origin ${ref}`, { stdio: 'inherit' });
        } catch (error) {
            throw new Error(`Failed to fetch branch ${ref}: ${error.message}`);
        }
    }
}