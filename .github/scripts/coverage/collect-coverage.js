#!/usr/bin/env node
/* eslint-disable no-console */

import { promises as fs } from "node:fs";
import path from "node:path";
import process from "node:process";
import { walkAndFindCoverage, extractTotals } from "./coverage.util.js";
import { BaselineCoverageService } from "./services/baseline-coverage-service.js";
import { CoverageDiffFormatter } from "./coverage-diff-formatter.js";
import { CoverageReporter } from "./report-coverage.js";
import { exists, ensureDir, getPackageName } from "../utils/fs.util.js";
import { sanitizePackageDir } from "../utils/package.util.js";



class CoverageCollector {
    constructor(options = {}) {
        this.repoRoot = options.repoRoot ?? process.cwd();
        this.packagesRoot = options.packagesRoot ?? path.join(this.repoRoot, "packages");
        const outDir = options.outDir ?? process.env.OUT_DIR ?? "coverage-artifacts";
        this.outRoot = path.isAbsolute(outDir) ? outDir : path.join(this.repoRoot, outDir);
        this.coverageFileName = options.coverageFileName ?? process.env.COVERAGE_FILE_NAME ?? "coverage-summary.json";
    }

    async run() {
        await ensureDir(this.outRoot);

        const rows = [];
        let count = 0;

        try {
            await fs.access(this.packagesRoot);
        } catch {
            throw new Error("No ./packages directory found.");
        }

        for await (const coveragePath of walkAndFindCoverage(this.packagesRoot, this.coverageFileName)) {
            const coverageDir = path.dirname(coveragePath);
            const pkgDir = path.dirname(path.dirname(coveragePath));
            const pkgName = await getPackageName(pkgDir);
            const safe = sanitizePackageDir(pkgName);
            const destDir = path.join(this.outRoot, safe);
            await ensureDir(destDir);

            await fs.copyFile(coveragePath, path.join(destDir, "coverage.json"));

            const lcovPath = path.join(coverageDir, "lcov.info");
            if (await exists(lcovPath)) {
                await fs.copyFile(lcovPath, path.join(destDir, "lcov.info"));
            }

            const htmlIndex = path.join(coverageDir, "index.html");
            if (await exists(htmlIndex)) {
                await fs.cp(coverageDir, path.join(destDir, "html"), { recursive: true, force: true });
            }

            const summary = JSON.parse(await fs.readFile(coveragePath, "utf8"));
            const totals = extractTotals(summary);

            rows.push({
                package: pkgName,
                safe,
                rel: path.relative(this.repoRoot, coveragePath),
                totals,
            });
            count++;
        }

        const indexData = {
            generatedAt: new Date().toISOString(),
            count,
            items: rows,
            outRoot: path.relative(this.repoRoot, this.outRoot)
        };

        await fs.writeFile(
            path.join(this.outRoot, "index.json"),
            JSON.stringify(indexData, null, 2),
            "utf8"
        );

        return {
            rows,
            count,
            outRoot: this.outRoot,
            repoRoot: this.repoRoot,
            packagesRoot: this.packagesRoot,
            coverageFileName: this.coverageFileName
        };
    }
}

async function main() {
    try {
        const enableDiff = process.env.ENABLE_COVERAGE_DIFF === "true";
        const baselineArtifactPath = process.env.BASELINE_ARTIFACT_PATH;

        console.log("🔍 Collecting coverage data...");

        const collector = new CoverageCollector();
        const result = await collector.run();
        console.log(`✅ Collected ${result.count} coverage summaries`);

        let rowsWithBaseline = result.rows;
        let baselineCoverage = new Map();
        const diffFormatter = new CoverageDiffFormatter();

        if (enableDiff) {
            const baselineService = new BaselineCoverageService({
                // GITHUB_BASE_REF is the target branch in a PR (e.g., 'main' or 'release/v1')
                // GITHUB_REF_NAME is the current branch on a push (e.g., 'main')
                baseBranch: process.env.GITHUB_BASE_REF || process.env.GITHUB_REF_NAME || "main",
                githubToken: process.env.GITHUB_TOKEN,
                repo: process.env.GITHUB_REPOSITORY,
                artifactName: baselineArtifactPath
            });

            if (baselineArtifactPath) {
                console.log(`📦 Attempting to load baseline from artifact path: ${baselineArtifactPath}`);
            } else {
                console.log("📦 No artifact path provided; attempting to load baseline via API.");
            }

            baselineCoverage = await baselineService.load();
            console.log(`📊 Baseline coverage available for ${baselineCoverage.size} packages`);

            rowsWithBaseline = diffFormatter.addBaselineToRows(result.rows, baselineCoverage);
        }

        console.log("📝 Generating coverage report...");
        const reporter = new CoverageReporter({
            enableDiff,
            baseBranch: process.env.GITHUB_BASE_REF || "main",
            baselineCoverage,
            outRoot: result.outRoot,
            repoRoot: result.repoRoot,
            diffFormatter
        });

        await reporter.generate(rowsWithBaseline);
        console.log("✅ Coverage report generated!");

        if (result.count === 0) {
            console.log(`No coverage summaries found. Ensure your test runner writes coverage/${result.coverageFileName} per package.`);
        }

    } catch (err) {
        console.error("Error collecting coverage:", err.message);
        process.exit(1);
    }
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});

export { CoverageCollector };
