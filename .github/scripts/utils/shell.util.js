import * as cp from 'node:child_process';
import process from 'node:process';

export class ShellUtil {
    constructor(cpApi = cp) {
        this.cp = cpApi;
    }

    exec(command, options = {}) {
        console.log(`> ${command}`);
        try {
            const output = this.cp.execSync(command, { stdio: 'inherit', ...options });

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
}

