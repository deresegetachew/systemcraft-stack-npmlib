import { describe, it } from "node:test";
import { greet } from "./index";
import assert from "node:assert";

describe("lib-two tests", () => {
  // it("greet should return the correct greeting", () => {
  //   // // Arrange
  //   const expected = "Lib-two says: Hello from lib-one!";
  //   // Act
  //   const result = greet();
  //   // Assert
  //   assert.strictEqual(result, expected);
  // });
  it("greet should be defined", () => {
    assert.ok(greet);
  });
});
