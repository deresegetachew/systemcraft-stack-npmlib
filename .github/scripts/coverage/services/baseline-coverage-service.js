#!/usr/bin/env node
/* eslint-disable no-console */

import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { extractTotals } from "../coverage.util";
import { FSUtil } from "../../utils/fs.util";


const execFileAsync = promisify(execFile);
const DEFAULT_ARTIFACT_NAME = "coverage-baseline";
const GITHUB_API_VERSION = "2022-11-28";

class BaselineCoverageService {
    constructor(options = {}) {
        this.artifactName = options.artifactName ?? DEFAULT_ARTIFACT_NAME;
        this.baseBranch = options.baseBranch ?? "main";
        this.repo = options.repo ?? process.env.GITHUB_REPOSITORY;
        this.githubToken = options.githubToken ?? process.env.GITHUB_TOKEN;
        this.tempDir = options.tempDir ?? path.join(os.tmpdir(), "coverage-baseline");

        FSUtil.create(fs);
    }

    async load() {
        const baseline = new Map();
        const sourcePath = await this.#downloadLatestBaselineArtifact();
        if (!sourcePath) {
            console.warn("No baseline coverage artifact found");
            return baseline;
        }

        try {
            const indexPath = path.join(sourcePath, "index.json");
            const indexData = JSON.parse(await fs.readFile(indexPath, "utf8"));

            for (const item of indexData.items) {
                const coveragePath = path.join(sourcePath, item.safe, "coverage.json");

                if (await FSUtil.exists(coveragePath)) {
                    try {
                        const summary = JSON.parse(await fs.readFile(coveragePath, "utf8"));
                        const totals = extractTotals(summary);
                        const pkgFolderName = item.rel.split("/")[1];
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

    async #downloadLatestBaselineArtifact() {
        if (!this.githubToken) {
            console.warn("Warning: GITHUB_TOKEN is not available; cannot download baseline artifact via API.");
            return null;
        }

        if (!this.repo) {
            console.warn("Warning: GITHUB_REPOSITORY is not set; cannot determine repository for baseline artifact.");
            return null;
        }

        const [owner, repoName] = this.repo.split("/");
        if (!owner || !repoName) {
            console.warn(`Warning: Could not parse repository "${this.repo}".`);
            return null;
        }

        try {
            const headers = {
                Authorization: `Bearer ${this.githubToken}`,
                "User-Agent": "coverage-collector-script",
                "X-GitHub-Api-Version": GITHUB_API_VERSION,
                Accept: "application/vnd.github+json"
            };

            const listUrl = new URL(`https://api.github.com/repos/${owner}/${repoName}/actions/artifacts`);
            listUrl.searchParams.set("name", this.artifactName);
            listUrl.searchParams.set("per_page", "100");
            const listResponse = await fetch(listUrl, { headers });

            if (!listResponse.ok) {
                console.warn(`Warning: Failed to list artifacts (${listResponse.status} ${listResponse.statusText}).`);
                return null;
            }

            const listData = await listResponse.json();

            if (Array.isArray(listData.artifacts)) {
                console.debug(
                    `artifact fields,${JSON.stringify(listData.artifacts[0])}`
                )

                console.debug(
                    `artifacts found: ${listData.artifacts.length}`, JSON.stringify({
                        artifacts: listData.artifacts.map((a) => ({
                            name: a.name,
                            expired: a.expired,
                            workflow_run_conclusion: a?.workflow_run?.conclusion,
                        }))
                    })
                )
            }



            const matchingArtifacts = (listData.artifacts ?? [])
                .filter((artifact) =>
                    !artifact.expired &&
                    artifact.workflow_run &&
                    this.#isSuccessfulRun(artifact.workflow_run)
                )
                .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

            if (matchingArtifacts.length === 0) {
                console.warn(`Warning: No active "${this.artifactName}" artifact found.`);
                return null;
            }

            const artifact = matchingArtifacts[0];
            const detectedBranch = artifact.workflow_run?.head_branch ?? "unknown";
            if (this.baseBranch && detectedBranch !== this.baseBranch) {
                console.info(
                    `Info: Using "${this.artifactName}" artifact from branch "${detectedBranch}" (expected "${this.baseBranch}").`
                );
            }
            const downloadUrl = artifact.archive_download_url ??
                `https://api.github.com/repos/${owner}/${repoName}/actions/artifacts/${artifact.id}/zip`;
            const downloadResponse = await fetch(downloadUrl, { headers, redirect: "follow" });

            if (!downloadResponse.ok) {
                console.warn(`Warning: Failed to download artifact (${downloadResponse.status} ${downloadResponse.statusText}).`);
                return null;
            }

            const arrayBuffer = await downloadResponse.arrayBuffer();
            await fs.mkdir(this.tempDir, { recursive: true });
            const zipPath = path.join(this.tempDir, `${artifact.id}.zip`);
            await fs.writeFile(zipPath, Buffer.from(arrayBuffer));

            const extractDir = path.join(this.tempDir, `artifact-${artifact.id}`);
            await fs.rm(extractDir, { recursive: true, force: true });
            await fs.mkdir(extractDir, { recursive: true });

            try {
                await execFileAsync("unzip", ["-q", "-o", zipPath, "-d", extractDir]);
            } catch (err) {
                console.warn(`Warning: Failed to unzip baseline artifact: ${err.message}`);
                return null;
            } finally {
                await fs.rm(zipPath, { force: true });
            }

            const directIndex = path.join(extractDir, "index.json");
            if (await FSUtil.exists(directIndex)) {
                return extractDir;
            }

            const coverageDir = path.join(extractDir, "coverage-artifacts");
            if (await FSUtil.exists(path.join(coverageDir, "index.json"))) {
                return coverageDir;
            }

            const entries = await fs.readdir(extractDir, { withFileTypes: true });
            for (const entry of entries) {
                if (entry.isDirectory()) {
                    const candidate = path.join(extractDir, entry.name);
                    if (await FSUtil.exists(path.join(candidate, "index.json"))) {
                        return candidate;
                    }
                }
            }

            console.warn("Warning: Extracted artifact does not contain index.json.");
            return null;
        } catch (err) {
            console.warn(`Warning: Could not download baseline artifact: ${err.message}`);
            return null;
        }
    }

    #isSuccessfulRun(runInfo = {}) {
        // Some API responses omit conclusion, so treat missing as success unless explicitly failed/cancelled.
        const conclusion = runInfo.conclusion ?? "success";
        return !["failure", "cancelled", "timed_out", "action_required", "stale"].includes(conclusion);
    }
}

export { BaselineCoverageService };
