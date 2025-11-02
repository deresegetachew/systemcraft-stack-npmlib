import { promises as fs } from 'node:fs';
import path from 'node:path';

/**
 * File system utility class for async file operations with enhanced functionality
 * 
 * @class FSUtil
 * @description Provides convenient async file system operations with proper error handling

 * @example
 * const fsUtil = new FSUtil();
 * await fsUtil.ensureDir('/path/to/directory');
 * const exists = await fsUtil.exists('/path/to/file');
 */
export class FSUtil {
    /**
     * Create an FSUtil instance
     * @param {Object} [fsApi=fs] - File system promises API (allows dependency injection for testing)
     * @param {Function} fsApi.mkdir - Create directory function
     * @param {Function} fsApi.access - Check file access function
     * @param {Function} fsApi.readFile - Read file function
     */
    constructor(fsApi = fs) {
        /** @private {Object} File system promises API for async operations */
        this.fs = fsApi;
    }

    /**
     * Static factory method to create FSUtil instance
     * @static
     * @method create
     * @param {Object} fsApi - File system API to use
     * @returns {FSUtil} New FSUtil instance
     * @example
     * const fsUtil = FSUtil.create(customFsApi);
     */
    static create(fsApi) {
        return new FSUtil(fsApi);
    }

    /**
     * Ensure directory exists, creating it and parent directories if necessary
     * 
     * @async
     * @method ensureDir
     * @param {string} dirPath - Path to directory to create
     * @throws {Error} If directory creation fails due to permissions or other issues
     * 
     * @example
     * await fsUtil.ensureDir('/path/to/nested/directory');
     */
    async ensureDir(dirPath) {
        await this.fs.mkdir(dirPath, { recursive: true });
    }

    /**
     * Check if a file or directory exists
     * 
     * @async
     * @method exists
     * @param {string} path - Path to check for existence
     * @returns {Promise<boolean>} True if path exists, false otherwise
     * 
     * @example
     * const exists = await fsUtil.exists('/path/to/file.txt');
     * if (exists) console.log('File exists');
     */
    async exists(path) {
        try {
            await this.fs.access(path);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Get package name from package.json, with fallback to directory name
     * 
     * @async
     * @method getPackageName
     * @param {string} pkgDir - Directory containing package.json
     * @returns {Promise<string>} Package name from package.json or directory basename
     * 
     * @description
     * Attempts to read package.json and extract the name field.
     * If package.json doesn't exist or is invalid, returns the directory basename.
     * 
     * @example
     * const name = await fsUtil.getPackageName('/project/packages/utils');
     * // Returns: '@myorg/utils' (from package.json) or 'utils' (fallback)
     */
    async getPackageName(pkgDir) {
        try {
            const pkgJson = JSON.parse(await this.fs.readFile(path.join(pkgDir, "package.json"), "utf8"));
            if (pkgJson && typeof pkgJson.name === "string") return pkgJson.name;
        } catch {
            // ignore
        }
        return path.basename(pkgDir);
    }
}