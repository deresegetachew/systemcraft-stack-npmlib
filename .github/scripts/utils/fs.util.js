import { promises as fs } from 'node:fs';
import path from 'node:path';

export class FsUtil {
    constructor(fsApi = fs) {
        this.fs = fsApi;
    }

    async ensureDir(dirPath) {
        await this.fs.mkdir(dirPath, { recursive: true });
    }

    async exists(path) {
        try {
            await this.fs.access(path);
            return true;
        } catch {
            return false;
        }
    }

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