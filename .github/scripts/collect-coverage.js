#!/usr/bin/env node
/* eslint-disable no-console */

import { promises as fs } from "node:fs";
import path from "node:path";
import process from "node:process";
import { walkAndFindCoverage, sanitizePackageDir, getPackageName, extractTotals, ensureDir, exists } from "./util.js";
import { loadBaselineCoverage, addBaselineToRows } from "./diff-coverage.js";
import { generateAndWriteReport } from "./report-coverage.js";


export async function collectCoverage(options = {}) {
    const {
        repoRoot = process.cwd(),
        packagesRoot = path.join(process.cwd(), "packages"),
        outRoot = path.join(process.cwd(), process.env.OUT_DIR || "coverage-artifacts"),
        coverageFileName = process.env.COVERAGE_FILE_NAME || "coverage-summary.json"
    } = options;

    await ensureDir(outRoot);

    const rows = [];
    let count = 0;

    // Check if packages directory exists
    try {
        await fs.access(packagesRoot);
    } catch {
        throw new Error("No ./packages directory found.");
    }

    // Process each coverage file
    for await (const f of walkAndFindCoverage(packagesRoot, coverageFileName)) {
        // f = .../packages/<pkg>/.../coverage/{coverageFileName}
        const coverageDir = path.dirname(f);
        const pkgDir = path.dirname(path.dirname(f)); // up twice: coverage -> parent -> (usually package root)
        const pkgName = await getPackageName(pkgDir);
        const safe = sanitizePackageDir(pkgName);
        const destDir = path.join(outRoot, safe);
        await ensureDir(destDir);

        // Copy the raw summary
        await fs.copyFile(f, path.join(destDir, "coverage.json"));

        // Also copy LCOV if present
        const lcovPath = path.join(coverageDir, "lcov.info");
        if (await exists(lcovPath)) {
            await fs.copyFile(lcovPath, path.join(destDir, "lcov.info"));
        }

        // And copy HTML report (nyc/istanbul commonly writes ./coverage/** with index.html)
        const htmlIndex = path.join(coverageDir, "index.html");
        if (await exists(htmlIndex)) {
            // Node 18+ supports fs.cp(recursive)
            await fs.cp(coverageDir, path.join(destDir, "html"), { recursive: true, force: true });
        }

        // Parse & collect totals
        const summary = JSON.parse(await fs.readFile(f, "utf8"));
        const totals = extractTotals(summary);

        rows.push({
            package: pkgName,
            safe,
            rel: path.relative(repoRoot, f),
            totals,
        });
        count++;
    }

    // Write machine-readable index
    const indexData = {
        generatedAt: new Date().toISOString(),
        count,
        items: rows,
        outRoot: path.relative(repoRoot, outRoot)
    };

    await fs.writeFile(
        path.join(outRoot, "index.json"),
        JSON.stringify(indexData, null, 2),
        "utf8"
    );

    return {
        rows,
        count,
        outRoot,
        repoRoot,
        packagesRoot,
        coverageFileName
    };
}


async function main() {
    try {
        // Configuration from environment
        const enableDiff = process.env.ENABLE_COVERAGE_DIFF === "true";
        const baselineArtifactPath = process.env.BASELINE_ARTIFACT_PATH;

        console.log("🔍 Collecting coverage data...");

        // Step 1: Collect coverage
        const result = await collectCoverage();
        console.log(`✅ Collected ${result.count} coverage summaries`);

        // Step 2: Handle diff if enabled
        let rowsWithBaseline = result.rows;
        let baselineCoverage = new Map();

        if (enableDiff && baselineArtifactPath) {
            console.log(`📦 Loading baseline from: ${baselineArtifactPath}`);
            baselineCoverage = await loadBaselineCoverage(baselineArtifactPath);
            console.log(`📊 Found baseline coverage for ${baselineCoverage.size} packages`);
            rowsWithBaseline = addBaselineToRows(result.rows, baselineCoverage);
        }

        // Step 3: Generate report
        console.log("📝 Generating coverage report...");
        const reportOptions = {
            enableDiff,
            baseBranch: "main",
            baselineCoverage,
            outRoot: result.outRoot,
            repoRoot: result.repoRoot
        };

        await generateAndWriteReport(rowsWithBaseline, reportOptions);
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