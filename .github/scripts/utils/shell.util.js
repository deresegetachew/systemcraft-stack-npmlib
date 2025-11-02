import * as cp from 'node:child_process';
import process from 'node:process';

/**
 * Shell utility class for executing system commands with consistent error handling
 * 
 * @class ShellUtil
 * @description Provides a simplified interface for running shell commands with proper error handling and output capture

 * @example
 * const shell = new ShellUtil();
 * const result = shell.exec('git status');
 * console.log(result.stdout);
 */
export class ShellUtil {
    /**
     * Create a ShellUtil instance
     * @param {Object} [cpApi=cp] - Child process API to use (allows dependency injection for testing)
     * @param {Function} cpApi.execSync - Synchronous command execution function
     */
    constructor(cpApi = cp) {
        /** @private {Object} Child process API for command execution */
        this.cp = cpApi;
    }

    /**
     * Execute a shell command synchronously with error handling
     * 
     * @method exec
     * @param {string} command - The shell command to execute
     * @param {Object} [options={}] - Options to pass to execSync
     * @param {string|Array} [options.stdio='inherit'] - How to handle stdin/stdout/stderr
     * @param {string} [options.cwd] - Current working directory for the command
     * @param {Object} [options.env] - Environment variables for the command
     * @returns {Object} Result object with stdout property
     * @returns {string} returns.stdout - The command's stdout output as string
     * @throws {Error} When stdio is 'pipe' and command fails (allows caller error handling)
     * 
     * @description
     * Executes shell commands with consistent logging and error handling:
     * - Logs the command being executed
     * - With default stdio='inherit': Shows output in real-time, exits process on error
     * - With stdio='pipe': Captures output, throws error for caller to handle
     * - Returns stdout as string for further processing
     * 
     * @example
     * // Execute with real-time output (default)
     * shell.exec('npm install');
     * 
     * @example  
     * // Capture output for processing
     * const result = shell.exec('git status --porcelain', { stdio: 'pipe' });
     * const files = result.stdout.split('\n').filter(Boolean);
     * 
     * @example
     * // Handle errors when capturing output
     * try {
     *   const result = shell.exec('git diff --name-only', { stdio: 'pipe' });
     *   console.log('Changed files:', result.stdout);
     * } catch (error) {
     *   console.log('No changes or git error');
     * }
     */
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

