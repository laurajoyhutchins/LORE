import { expect, it } from "vitest";
import * as coverage from "../../../src/verification/causal-coverage.js";

it("exposes causal coverage verification", () => {
  expect((coverage as Record<string, unknown>).verifyCausalCoverage).toBeTypeOf("function");
});
