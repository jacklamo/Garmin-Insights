import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { cruise } from "dependency-cruiser";

const require = createRequire(import.meta.url);
const rules = require("../.dependency-cruiser.cjs");
// The fixtures dir is excluded from the real run; drop the exclude when cruising it.
const fixtureOpts = { ...rules.options, exclude: undefined };

async function run(paths: string[], opts = rules.options) {
  const r = await cruise(paths, { ...opts, validate: true, ruleSet: { forbidden: rules.forbidden } });
  const out = r.output as any;
  return out.summary.violations.map((v: any) => `${v.rule.name}: ${v.from} -> ${v.to}`) as string[];
}

describe("package boundaries", () => {
  it("real tree has no violations", async () => {
    expect(await run(["packages", "apps"])).toEqual([]);
  });
  it("relative import and cycle in bad fixture are flagged", async () => {
    const v = await run(["tools/boundary-fixtures/bad/packages/engine/src/index.ts"], fixtureOpts);
    expect(v.some((s) => s.startsWith("engine-only-core"))).toBe(true);
    expect(v.some((s) => s.startsWith("no-circular"))).toBe(true);
  });
  it("workspace-style @insights/store import is flagged", async () => {
    const v = await run(["tools/boundary-fixtures/bad/packages/engine/src/ws.ts"], fixtureOpts);
    expect(v.some((s) => s.startsWith("engine-only-core"))).toBe(true);
  });
});
