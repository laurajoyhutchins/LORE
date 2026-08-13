import { expect, it } from "vitest";
import * as templates from "../../../src/projection/templates.js";

it("exposes human and Deciduous-compatible causal projections", () => {
  const exports = templates as Record<string, unknown>;
  expect(exports.renderWhyThisRepository).toBeTypeOf("function");
  expect(exports.renderDeciduousCompatibility).toBeTypeOf("function");
});
