import { expect, test } from "vitest";
// @ts-ignore plain JS module without types
import { classifyFailure } from "./classify.js";

test("classifyFailure", () => {
  expect(classifyFailure({ threw: true, controlResolved: true })).toBe("cors");
  expect(classifyFailure({ threw: true, controlResolved: false })).toBe("network");
  expect(classifyFailure({ status: 401 })).toBe("http_401");
  expect(classifyFailure({ status: 200 })).toBe("ok");
  expect(classifyFailure({ status: 429 })).toBe("http_429");
});
