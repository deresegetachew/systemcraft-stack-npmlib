/**This file will run if there are changesets to process */

import fs from 'node:fs';
import { VersionService } from './services/version.service.js';
import { ShellUtil } from '../utils/shell.util.js';

// Main function with default dependencies  
export async function main(env = process.env, fsApi = fs, shellUtil = new ShellUtil()) {
    const versionService = VersionService.create(shellUtil, fsApi);
    return await versionService.run(env);
}

if (import.meta.url === `file://${process.argv[1]}`) {
    try {
        main();
    } catch (err) {
        console.error(err.message);
        process.exit(1);
    }
}