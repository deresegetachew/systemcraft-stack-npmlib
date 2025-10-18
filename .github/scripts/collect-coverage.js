#!/usr/bin/env node
/* eslint-disable no-console */

import { promises as fs } from "node:fs";
import path from "node:path";
import process from "node:process";

/**
 * Recursively find files named coverage/coverage-summary.json under ./packages
 */
async function* walk(dir) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const e of entries) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) {
            // skip node_modules to avoid useless work
            if (e.name === "node_modules") continue;
            yield* walk(full);
        } else if (
            e.isFile() &&
            (full.endsWith(path.join("coverage", "coverage-summary.json")) ||
                (full.endsWith("coverage-summary.json") && full.includes(`${path.sep}coverage${path.sep}`)))
        ) {
            yield full;
        }
    }
}

function sanitizePackageDir(nameOrDir) {
    // turn @scope/pkg -> at-scope__pkg (safe for artifact folder names)
    return nameOrDir.replaceAll("@", "at-").replaceAll("/", "__");
}

/**
 * Try to read package name from <pkgdir>/package.json, fallback to folder name
 */
async function getPackageName(pkgDir) {
    try {
        const pkgJson = JSON.parse(await fs.readFile(path.join(pkgDir, "package.json"), "utf8"));
        if (pkgJson && typeof pkgJson.name === "string") return pkgJson.name;
    } catch {
        // ignore
    }
    return path.basename(pkgDir);
}

function extractTotals(summaryJson) {
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

function toPct(n) {
    return Number.isFinite(n) ? `${n.toFixed(1)}%` : "—";
}

async function ensureDir(d) {
    await fs.mkdir(d, { recursive: true });
}

async function exists(p) {
    try {
        await fs.access(p);
        return true;
    } catch {
        return false;
    }
}

async function main() {
    const repoRoot = process.cwd();
    const packagesRoot = path.join(repoRoot, "packages");
    const outRoot = path.join(repoRoot, process.env.OUT_DIR || "coverage-artifacts");

    await ensureDir(outRoot);

    const rows = []; // for summary
    let count = 0;

    // find every coverage-summary.json
    try {
        await fs.access(packagesRoot);
    } catch {
        console.error("No ./packages directory found. Nothing to do.");
        process.exit(0);
    }

    for await (const f of walk(packagesRoot)) {
        // f = .../packages/<pkg>/.../coverage/coverage-summary.json
        const coverageDir = path.dirname(f);
        const pkgDir = path.dirname(path.dirname(f)); // up twice: coverage -> parent -> (usually package root)
        const pkgName = await getPackageName(pkgDir);
        const safe = sanitizePackageDir(pkgName);
        const destDir = path.join(outRoot, safe);
        await ensureDir(destDir);

        // Copy the raw summary
        await fs.copyFile(f, path.join(destDir, "coverage-summary.json"));

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
    await fs.writeFile(
        path.join(outRoot, "index.json"),
        JSON.stringify({ generatedAt: new Date().toISOString(), count, items: rows }, null, 2),
        "utf8"
    );

    // Build Markdown summary
    const header = `# Coverage Summary (${count} package${count === 1 ? "" : "s"})`;
    const tableHead = [
        "",
        "| Package | Lines | Statements | Branches | Functions |",
        "|---|---:|---:|---:|---:|",
    ].join("\n");
    const tableRows = rows
        .map(
            (r) =>
                `| \`${r.package}\` | ${toPct(r.totals.lines.pct)} | ${toPct(r.totals.statements.pct)} | ${toPct(
                    r.totals.branches.pct
                )} | ${toPct(r.totals.functions.pct)} |`
        )
        .join("\n");

    // Optional link to a combined artifact (set by the workflow)
    const fullReportUrl = process.env.COVERAGE_ARTIFACT_URL;

    let md = [header, tableHead, tableRows, ""].join("\n");
    md += "_Artifacts saved under `coverage-artifacts/<package>/` (summary, lcov, and HTML if available)._";
    if (fullReportUrl) {
        md += `\n\n### 🔎 [View full HTML & LCOV report](${fullReportUrl})`;
    }
    md += "\n";

    await fs.writeFile(path.join(outRoot, "summary.md"), md, "utf8");

    // Also surface to the job summary if available
    if (process.env.GITHUB_STEP_SUMMARY) {
        // Ensure a leading newline so this block doesn't run into prior steps
        await fs.appendFile(process.env.GITHUB_STEP_SUMMARY, `\n${md}`, "utf8");
    }

    console.log(`Collected ${count} coverage summaries → ${path.relative(repoRoot, outRoot)}`);
    if (count === 0) {
        console.log(
            "No coverage summaries found. Ensure your test runner writes coverage/coverage-summary.json per package."
        );
    }
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});