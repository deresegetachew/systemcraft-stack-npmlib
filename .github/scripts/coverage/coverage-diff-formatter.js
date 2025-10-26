#!/usr/bin/env node
/* eslint-disable no-console */

class CoverageDiffFormatter {
    constructor(options = {}) {
        this.diffThreshold = options.diffThreshold ?? 0.1;
    }

    format(current, baseline, metric = "lines") {
        const currentPct = current[metric]?.pct || 0;

        if (!baseline) {
            return currentPct > 0 ? ` 🟢 +${currentPct.toFixed(1)}%` : "";
        }

        const baselinePct = baseline[metric]?.pct || 0;
        const diff = currentPct - baselinePct;

        if (Math.abs(diff) < this.diffThreshold) return "";

        const sign = diff > 0 ? "+" : "";
        const icon = diff > 0 ? "🟢" : "🔴";
        return ` ${icon} ${sign}${diff.toFixed(1)}%`;
    }

    addBaselineToRows(rows, baselineCoverage) {
        return rows.map(row => {
            const pkgFolderName = row.rel.split("/")[1];
            const baselineTotals = baselineCoverage.get(pkgFolderName);

            return {
                ...row,
                baseline: baselineTotals
            };
        });
    }
}

export { CoverageDiffFormatter };
