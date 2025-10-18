#!/usr/bin/env node
/* eslint-disable no-console */

import { promises as fs } from "node:fs";
import path from "node:path";
import { toPct } from "./util.js";
import { formatDiff } from "./diff-coverage.js";


export function generateMarkdownReport(rows, options = {}) {
    const {
        enableDiff = false,
        baseBranch = "main",
        baselineCoverage = new Map(),
        outRoot = "coverage-artifacts",
        repoRoot = process.cwd()
    } = options;

    const count = rows.length;

    // Build header
    let header = `# Coverage Summary (${count} package${count === 1 ? "" : "s"})`;
    if (enableDiff && baselineCoverage.size > 0) {
        header += `\n\n*Showing changes compared to \`${baseBranch}\` branch*`;
    }

    // Build table
    const tableHead = [
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

    // Combine parts
    const md = [header, "", tableHead, tableRows].join("\n") + "\n";

    return md;
}


export async function writeMarkdownReport(markdown, outRoot) {
    await fs.writeFile(path.join(outRoot, "coverage-report.md"), markdown, "utf8");
}


export async function postToJobSummary(markdown) {
    if (process.env.GITHUB_STEP_SUMMARY) {
        // Ensure a leading newline so this block doesn't run into prior steps
        await fs.appendFile(process.env.GITHUB_STEP_SUMMARY, `\n${markdown}`, "utf8");
    }
}


export async function generateAndWriteReport(rows, options = {}) {
    const markdown = generateMarkdownReport(rows, options);

    await writeMarkdownReport(markdown, options.outRoot || "coverage-artifacts");
    await postToJobSummary(markdown);

    return markdown;
}