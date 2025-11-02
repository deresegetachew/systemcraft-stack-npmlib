import path from 'node:path';

/**
 * Package utility class for handling monorepo package operations and changeset processing
 * 
 * @class PackageUtil
 * @description Provides utilities for reading package information, processing changesets, and managing monorepo packages

 * @example
 * const fs = require('node:fs');
 * const packageUtil = new PackageUtil(fs);
 * const info = packageUtil.getPackageInfo('@scope/package', '/project/root');
 */
export class PackageUtil {
    /**
     * Create a PackageUtil instance
     * @param {Object} fsApi - File system API (typically Node.js fs module)
     * @param {Function} fsApi.existsSync - Check if file/directory exists
     * @param {Function} fsApi.readFileSync - Read file contents synchronously
     * @param {Function} fsApi.readdirSync - Read directory contents synchronously
     */
    constructor(fsApi) {
        /** @private {Object} File system API for file operations */
        this.fs = fsApi;
    }

    /**
     * Get package information from package.json
     * 
     * @method getPackageInfo
     * @param {string} packageName - Name of the package (e.g., '@scope/package-name')
     * @param {string} baseDir - Base directory of the monorepo
     * @returns {Object|null} Package information object or null if not found
     * @returns {string} returns.version - Package version from package.json
     * @returns {string} returns.dirName - Directory name of the package
     * 
     * @example
     * const info = packageUtil.getPackageInfo('@myorg/utils', '/project');
     * // Returns: { version: '1.2.3', dirName: 'utils' }
     */
    getPackageInfo(packageName, baseDir) {
        const packageDirName = packageName.split('/').pop();
        const packagePath = path.resolve(baseDir, 'packages', packageDirName);
        const packageJsonPath = path.join(packagePath, 'package.json');

        if (!this.fs.existsSync(packageJsonPath)) {
            return null;
        }

        const packageJson = JSON.parse(this.fs.readFileSync(packageJsonPath, 'utf-8'));
        return {
            version: packageJson.version,
            dirName: packageDirName,
        };
    }

    /**
     * Load all changeset files from the .changeset directory
     * 
     * @method loadChangesetFiles
     * @param {string} baseDir - Base directory of the monorepo
     * @returns {Array<Object>} Array of changeset file objects
     * @returns {string} returns[].filename - Name of the changeset file
     * @returns {string} returns[].content - Content of the changeset file
     * 
     * @example
     * const changesets = packageUtil.loadChangesetFiles('/project');
     * // Returns: [{ filename: 'feature.md', content: '---\n"@myorg/utils": minor\n---\n\nAdd new utility' }]
     */
    loadChangesetFiles(baseDir) {
        const changesetsDir = path.resolve(baseDir, '.changeset');

        if (!this.fs.existsSync(changesetsDir)) {
            return [];
        }

        return this.fs
            .readdirSync(changesetsDir)
            .filter((f) => f.endsWith('.md') && f !== 'README.md')
            .map((filename) => ({
                filename,
                content: this.fs.readFileSync(path.join(changesetsDir, filename), 'utf-8'),
            }));
    }

    /**
     * Extract packages that have major version bumps from changeset files
     * 
     * @static
     * @method extractMajorBumpPackagesFromChangesets
     * @param {Array<Object>} changesetFiles - Array of changeset file objects
     * @param {string} changesetFiles[].content - Content of the changeset file
     * @returns {Set<string>} Set of package names that have major bumps
     * 
     * @description
     * Parses changeset files to find packages marked for major version bumps.
     * Looks for lines matching pattern: "package-name": major
     * 
     * @example
     * const changesets = [{ content: '"@myorg/utils": major\n"@myorg/core": minor' }];
     * const majorPackages = PackageUtil.extractMajorBumpPackagesFromChangesets(changesets);
     * // Returns: Set(['@myorg/utils'])
     */
    static extractMajorBumpPackagesFromChangesets(changesetFiles) {
        const majorBumpPackages = new Set();

        for (const { content } of changesetFiles) {
            const lines = content.split('\n');
            for (const line of lines) {
                if (line.includes(': major')) {
                    // This regex looks for a quoted package name followed by ": major"
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

    /**
     * Sanitize package name for use as directory/file name
     * 
     * @static
     * @method sanitizePackageDir
     * @param {string} nameOrDir - Package name or directory name to sanitize
     * @returns {string} Sanitized name safe for file system use
     * 
     * @description
     * Converts package names with special characters to file-system safe names:
     * - Replaces '@' with 'at-' 
     * - Replaces '/' with '__'
     * 
     * @example
     * const safe = PackageUtil.sanitizePackageDir('@myorg/utils');
     * // Returns: 'at-myorg__utils'
     */
    static sanitizePackageDir(nameOrDir) {
        // turn @scope/pkg -> at-scope__pkg (safe for artifact folder names)
        return nameOrDir.replaceAll("@", "at-").replaceAll("/", "__");
    }
}

// Function exports for application code
/**
 * Get package information using functional interface
 * @function getPackageInfo
 * @param {string} packageName - Name of the package
 * @param {Object} fsApi - File system API
 * @param {string} baseDir - Base directory of monorepo
 * @returns {Object|null} Package information or null
 */
export function getPackageInfo(packageName, fsApi, baseDir) {
    const packageUtil = new PackageUtil(fsApi);
    return packageUtil.getPackageInfo(packageName, baseDir);
}

/**
 * Load changeset files using functional interface
 * @function loadChangesetFiles
 * @param {Object} fsApi - File system API
 * @param {string} baseDir - Base directory of monorepo
 * @returns {Array<Object>} Array of changeset file objects
 */
export function loadChangesetFiles(fsApi, baseDir) {
    const packageUtil = new PackageUtil(fsApi);
    return packageUtil.loadChangesetFiles(baseDir);
}

/**
 * Extract major bump packages using functional interface
 * @function extractMajorBumpPackagesFromChangesets
 * @param {Array<Object>} changesetFiles - Array of changeset file objects
 * @returns {Set<string>} Set of package names with major bumps
 */
export function extractMajorBumpPackagesFromChangesets(changesetFiles) {
    return PackageUtil.extractMajorBumpPackagesFromChangesets(changesetFiles);
}

/**
 * Sanitize package directory name using functional interface
 * @function sanitizePackageDir
 * @param {string} nameOrDir - Package name to sanitize
 * @returns {string} Sanitized name
 */
export function sanitizePackageDir(nameOrDir) {
    return PackageUtil.sanitizePackageDir(nameOrDir);
}