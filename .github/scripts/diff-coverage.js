#!/usr/bin/env node
/* eslint-disable no-console */

import { promises as fs } from "node:fs";
import path from "node:path";
import { extractTotals, exists } from "./util.js";


export async function loadBaselineCoverage(baselineArtifactPath) {
    const baseline = new Map();

    try {
        const indexPath = path.join(baselineArtifactPath, "index.json");

        if (!(await exists(indexPath))) {
            console.warn("No baseline coverage artifact found");
            return baseline;
        }

        const indexData = JSON.parse(await fs.readFile(indexPath, "utf8"));

        for (const item of indexData.items) {
            // Load the coverage.json for each package
            const coveragePath = path.join(baselineArtifactPath, item.safe, "coverage.json");

            if (await exists(coveragePath)) {
                try {
                    const summary = JSON.parse(await fs.readFile(coveragePath, "utf8"));
                    const totals = extractTotals(summary);

                    // Use package folder name as key (same as current implementation)
                    const pkgFolderName = item.rel.split('/')[1]; // Extract from "packages/lib-one/coverage/..."
                    baseline.set(pkgFolderName, totals);
                } catch (err) {
                    console.warn(`Warning: Could not parse baseline coverage for ${item.package}:`, err.message);
                }
            }
        }

        console.log(`📊 Loaded baseline coverage for ${baseline.size} packages from artifact`);

    } catch (err) {
        console.warn("Warning: Could not load baseline coverage from artifact:", err.message);
    }

    return baseline;
}

export async function getBaselineCoverage(baseBranch, packagesRoot, coverageFileName) {
    const { execSync } = await import("node:child_process");
    const baseline = new Map();

    try {
        // Check if we're in a git repository and the base branch exists
        execSync(`git rev-parse --verify ${baseBranch}`, { stdio: "pipe" });

        // Get the list of coverage files that exist in the base branch
        const gitOutput = execSync(
            `git ls-tree -r --name-only ${baseBranch} -- "${packagesRoot}"`,
            { encoding: "utf8", stdio: "pipe" }
        );

        const baselineCoverageFiles = gitOutput
            .split("\n")
            .filter(line => line.trim() && line.includes("/coverage/") && line.endsWith(coverageFileName));

        for (const filePath of baselineCoverageFiles) {
            try {
                // Get file content from base branch
                const content = execSync(`git show ${baseBranch}:${filePath}`, {
                    encoding: "utf8",
                    stdio: "pipe"
                });

                const summary = JSON.parse(content);
                const totals = extractTotals(summary);

                // Extract package info from path
                const pathParts = filePath.split("/");
                const pkgIndex = pathParts.findIndex(part => part === "packages");
                if (pkgIndex >= 0 && pkgIndex < pathParts.length - 2) {
                    const pkgDir = pathParts[pkgIndex + 1];
                    baseline.set(pkgDir, totals);
                }
            } catch (err) {
                // Skip files that can't be parsed
                console.warn(`Warning: Could not parse baseline coverage for ${filePath}:`, err.message);
            }
        }
    } catch (err) {
        console.warn(`Warning: Could not fetch baseline coverage from ${baseBranch}:`, err.message);
    }

    return baseline;
}

export function formatDiff(current, baseline, metric = "lines") {
    const currentPct = current[metric]?.pct || 0;

    // If no baseline, treat current coverage as new (increment)
    if (!baseline) {
        return currentPct > 0 ? ` 🟢 +${currentPct.toFixed(1)}%` : "";
    }

    const baselinePct = baseline[metric]?.pct || 0;
    const diff = currentPct - baselinePct;

    if (Math.abs(diff) < 0.1) return ""; // No significant change

    const sign = diff > 0 ? "+" : "";
    const icon = diff > 0 ? "🟢" : "🔴";
    return ` ${icon} ${sign}${diff.toFixed(1)}%`;
}


export function addBaselineToRows(rows, baselineCoverage) {
    return rows.map(row => {
        // Use package folder name as key for baseline lookup
        const pkgFolderName = row.rel.split('/')[1]; // Extract from "packages/lib-one/coverage/..."
        const baselineTotals = baselineCoverage.get(pkgFolderName);

        return {
            ...row,
            baseline: baselineTotals
        };
    });
}
