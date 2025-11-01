import assert from "node:assert";
import { describe, beforeEach, mock, afterEach, it } from "node:test";
import { GitUtil } from "./git.util.js";

describe("GitUtil", () => {
  let mockShellService;
  let gitService;

  beforeEach(() => {
    mockShellService = {
      exec: mock.fn(() => ({ stdout: "file1.js\nfile2.js\n" })),
      run: mock.fn(),
    };
    gitService = new GitUtil(mockShellService);
  });

  afterEach(() => {
    mock.restoreAll();
  });

  it("should return changed files from HEAD~1..HEAD command", async () => {
    // -- Arrange
    mockShellService.exec.mock.mockImplementation(() => ({
      stdout: "packages/lib-one/package.json\npackages/lib-one/CHANGELOG.md\n",
    }));

    // -- Act
    const result = await gitService.getChangedFiles();

    // -- Assert
    assert.deepStrictEqual(result, [
      "packages/lib-one/package.json",
      "packages/lib-one/CHANGELOG.md",
    ]);
    assert.ok(
      mockShellService.exec.mock.calls[0].arguments[0].includes("HEAD~1..HEAD")
    );
  });

  it("should fallback to HEAD^..HEAD if first command fails", async () => {
    // -- Arrange
    let callCount = 0;
    mockShellService.exec.mock.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        throw new Error("Command failed");
      }
      return { stdout: "file1.js\nfile2.js\n" };
    });

    // -- Act
    const result = await gitService.getChangedFiles();

    // -- Assert
    assert.deepStrictEqual(result, ["file1.js", "file2.js"]);
    assert.strictEqual(mockShellService.exec.mock.callCount(), 2);
  });

  it("should return empty array if both commands fail", async () => {
    // -- Arrange
    mockShellService.exec.mock.mockImplementation(() => {
      throw new Error("Git command failed");
    });

    // -- Act
    const result = await gitService.getChangedFiles();

    // -- Assert
    assert.deepStrictEqual(result, []);
    assert.strictEqual(mockShellService.exec.mock.callCount(), 2);
  });

  it("should check remote branch existence", () => {
    // -- Arrange
    mockShellService.exec.mock.mockImplementation(() => ({
      stdout: "origin/feature-branch\n",
    }));

    // -- Act
    const exists = gitService.checkRemoteBranch("feature-branch");

    // -- Assert
    assert.strictEqual(exists, true);
    assert.ok(
      mockShellService.exec.mock.calls[0].arguments[0].includes("git ls-remote")
    );
  });

  it("should return false for non-existent remote branch", () => {
    // -- Arrange
    mockShellService.exec.mock.mockImplementation(() => ({ stdout: "" }));

    // -- Act
    const exists = gitService.checkRemoteBranch("non-existent");

    // -- Assert
    assert.strictEqual(exists, false);
  });
});
