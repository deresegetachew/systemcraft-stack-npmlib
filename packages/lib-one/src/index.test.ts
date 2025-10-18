import test, { describe, it } from "node:test";
import assert from "node:assert";
import { hello } from "./index";

describe("example test", (t) => {
  it("should return the correct greeting", (t) => {
    // Arrange
    const expected = "Hello from lib-one!";

    // Act
    const result = hello();

    assert.strictEqual(result, expected);
  });
});
