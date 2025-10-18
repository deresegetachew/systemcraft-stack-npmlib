#!/usr/bin/env node
/* eslint-disable no-console */

import { promises as fs } from "node:fs";
import path from "node:path";
import process from "node:process";

/**
 * Recursively find files named coverage/{coverageFileName} under ./packages
 */
async function* walk(dir, coverageFileName = "coverage-summary.json") {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const e of entries) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) {
            // skip node_modules to avoid useless work
            if (e.name === "node_modules") continue;
            yield* walk(full, coverageFileName);
        } else if (
            e.isFile() &&
            (full.endsWith(path.join("coverage", coverageFileName)) ||
                (full.endsWith(coverageFileName) && full.includes(`${path.sep}coverage${path.sep}`)))
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

async function getBaselineCoverage(baseBranch, packagesRoot, coverageFileName) {
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

function formatDiff(current, baseline, metric = "lines") {
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
} async function main() {
    const repoRoot = process.cwd();
    const packagesRoot = path.join(repoRoot, "packages");
    const outRoot = path.join(repoRoot, process.env.OUT_DIR || "coverage-artifacts");
    const coverageFileName = process.env.COVERAGE_FILE_NAME || "coverage-summary.json";
    const baseBranch = "main"; // Future make this configurable from env -> repor variable
    const enableDiff = true;

    await ensureDir(outRoot);

    const rows = []; // for summary
    let count = 0;

    // Get baseline coverage for diff comparison if enabled
    const baselineCoverage = enableDiff ? await getBaselineCoverage(baseBranch, packagesRoot, coverageFileName) : new Map();

    // find every coverage.json
    try {
        await fs.access(packagesRoot);
    } catch {
        console.error("No ./packages directory found. Nothing to do.");
        process.exit(0);
    }

    for await (const f of walk(packagesRoot, coverageFileName)) {
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

        // Get baseline coverage for this package (use folder name as key)
        const pkgFolderName = path.basename(pkgDir);
        const baselineTotals = baselineCoverage.get(pkgFolderName);

        rows.push({
            package: pkgName,
            safe,
            rel: path.relative(repoRoot, f),
            totals,
            baseline: baselineTotals,
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
    let header = `# Coverage Summary (${count} package${count === 1 ? "" : "s"})`;
    if (enableDiff && baselineCoverage.size > 0) {
        header += `\n\n*Showing changes compared to \`${baseBranch}\` branch*`;
    }

    const tableHead = [
        "",
        "| Package | Lines | Statements | Branches | Functions |",
        "|---|---:|---:|---:|---:|",
    ].join("\n");
    const tableRows = rows
        .map((r) => {
            const linesDiff = enableDiff ? formatDiff(r.totals, r.baseline, "lines") : "";
            const statementsDiff = enableDiff ? formatDiff(r.totals, r.baseline, "statements") : "";
            const branchesDiff = enableDiff ? formatDiff(r.totals, r.baseline, "branches") : "";
            const functionsDiff = enableDiff ? formatDiff(r.totals, r.baseline, "functions") : "";

            return `| \`${r.package}\` | ${toPct(r.totals.lines.pct)}${linesDiff} | ${toPct(r.totals.statements.pct)}${statementsDiff} | ${toPct(
                r.totals.branches.pct
            )}${branchesDiff} | ${toPct(r.totals.functions.pct)}${functionsDiff} |`;
        })
        .join("\n");

    let md = [header, tableHead, tableRows, ""].join("\n");
    md += `_Artifacts saved under \`${path.relative(repoRoot, outRoot)}/<package>/\` (summary, lcov, and HTML if available)._`;

    // Add links to individual HTML reports if they exist locally
    const htmlReports = [];
    for (const r of rows) {
        const htmlPath = path.join(outRoot, r.safe, "html", "index.html");
        if (await exists(htmlPath)) {
            htmlReports.push(r);
        }
    }

    if (htmlReports.length > 0) {
        md += `\n\n### 📊 HTML Coverage Reports\n`;
        for (const report of htmlReports) {
            const htmlRelPath = path.join(path.relative(repoRoot, outRoot), report.safe, "html", "index.html");
            md += `- [\`${report.package}\`](./${htmlRelPath})\n`;
        }
    }
    md += "\n";

    await fs.writeFile(path.join(outRoot, "coverage-report.md"), md, "utf8");

    // Also surface to the job summary if available
    if (process.env.GITHUB_STEP_SUMMARY) {
        // Ensure a leading newline so this block doesn't run into prior steps
        await fs.appendFile(process.env.GITHUB_STEP_SUMMARY, `\n${md}`, "utf8");
    }

    console.log(`Collected ${count} coverage summaries → ${path.relative(repoRoot, outRoot)}`);
    if (count === 0) {
        console.log(
            `No coverage summaries found. Ensure your test runner writes coverage/${coverageFileName} per package.`
        );
    }
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});