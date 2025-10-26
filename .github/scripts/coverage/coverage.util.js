import { promises as fs } from "node:fs";
import path from "node:path";


export function toPct(n) {
    return Number.isFinite(n) ? `${n.toFixed(1)}%` : "—";
}


export function extractTotals(summaryJson) {
    // NYC-style summary: { total: { lines: {total,covered,pct}, ... } }
    const t = summaryJson?.total ?? {};
    const pick = (k) => {
        const s = t[k] ?? {};
        return {
            total: Number(s.total ?? 0),
            covered: Number(s.covered ?? 0),
            pct: Number(s.pct ?? 0),
        };
    };
    return {
        lines: pick("lines"),
        statements: pick("statements"),
        branches: pick("branches"),
        functions: pick("functions"),
    };
}


export async function* walkAndFindCoverage(dir, fileName) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const e of entries) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) {
            // skip node_modules to avoid useless works
            if (e.name === "node_modules") continue;
            yield* walkAndFindCoverage(full, fileName);
        } else if (
            e.isFile() &&
            (full.endsWith(path.join("coverage", fileName)) ||
                (full.endsWith(fileName) && full.includes(`${path.sep}coverage${path.sep}`)))
        ) {
            yield full;
        }
    }
}