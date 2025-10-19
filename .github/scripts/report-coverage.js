#!/usr/bin/env node
/* eslint-disable no-console */

import { promises as fs } from "node:fs";
import path from "node:path";
import process from "node:process";
import { toPct } from "./util.js";
import { CoverageDiffFormatter } from "./coverage-diff-formatter.js";


class CoverageReporter {
    constructor(options = {}) {
        this.enableDiff = options.enableDiff ?? false;
        this.baseBranch = options.baseBranch ?? "main";
        this.baselineCoverage = options.baselineCoverage ?? new Map();
        this.outRoot = options.outRoot ?? "coverage-artifacts";
        this.repoRoot = options.repoRoot ?? process.cwd();
        this.diffFormatter = options.diffFormatter ?? new CoverageDiffFormatter(options.diffFormatterOptions);
    }

    async generate(rows, overrides = {}) {
        const config = this.#resolveConfig(overrides);
        const markdown = this.#buildMarkdown(rows, config);

        await this.#writeMarkdown(markdown, config.outRoot);
        await this.#appendToSummary(markdown);

        return markdown;
    }

    generateMarkdown(rows, overrides = {}) {
        const config = this.#resolveConfig(overrides);
        return this.#buildMarkdown(rows, config);
    }

    #resolveConfig(overrides = {}) {
        return {
            enableDiff: overrides.enableDiff ?? this.enableDiff,
            baseBranch: overrides.baseBranch ?? this.baseBranch,
            baselineCoverage: overrides.baselineCoverage ?? this.baselineCoverage,
            outRoot: overrides.outRoot ?? this.outRoot,
            repoRoot: overrides.repoRoot ?? this.repoRoot,
            diffFormatter: overrides.diffFormatter ?? this.diffFormatter,
        };
    }

    #buildMarkdown(rows, config) {
        const count = rows.length;
        let header = `# Coverage Summary (${count} package${count === 1 ? "" : "s"})`;

        if (config.enableDiff && config.baselineCoverage.size > 0) {
            header += `\n\n*Showing changes compared to \`${config.baseBranch}\` branch*`;
        }

        const tableHead = [
            "| Package | Lines | Statements | Branches | Functions |",
            "|---|---:|---:|---:|---:|",
        ].join("\n");

        const tableRows = rows
            .map((row) => {
                const linesDiff = config.enableDiff ? config.diffFormatter.format(row.totals, row.baseline, "lines") : "";
                const statementsDiff = config.enableDiff ? config.diffFormatter.format(row.totals, row.baseline, "statements") : "";
                const branchesDiff = config.enableDiff ? config.diffFormatter.format(row.totals, row.baseline, "branches") : "";
                const functionsDiff = config.enableDiff ? config.diffFormatter.format(row.totals, row.baseline, "functions") : "";

                return `| \`${row.package}\` | ${toPct(row.totals.lines.pct)}${linesDiff} | ${toPct(row.totals.statements.pct)}${statementsDiff} | ${toPct(
                    row.totals.branches.pct
                )}${branchesDiff} | ${toPct(row.totals.functions.pct)}${functionsDiff} |`;
            })
            .join("\n");

        return [header, "", tableHead, tableRows].join("\n") + "\n";
    }

    async #writeMarkdown(markdown, outRoot) {
        const targetDir = path.isAbsolute(outRoot) ? outRoot : path.join(this.repoRoot, outRoot);
        await fs.mkdir(targetDir, { recursive: true });
        await fs.writeFile(path.join(targetDir, "coverage-report.md"), markdown, "utf8");
    }

    async #appendToSummary(markdown) {
        if (process.env.GITHUB_STEP_SUMMARY) {
            await fs.appendFile(process.env.GITHUB_STEP_SUMMARY, `\n${markdown}`, "utf8");
        }
    }
}

export { CoverageReporter };
