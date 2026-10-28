import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const HEADINGS = ["Endpoints", "CORS verdict", "Proxy go/no-go", "Shared-origin risk", "Browser matrix", "Sleep dating", "Rate limits", "History depth"];
const good = (extra = "") =>
  HEADINGS.map((h) => `## ${h}\n\ntext\n`).join("\n") +
  "\n| Endpoint | Verdict |\n|---|---|\n| steps | usable |\n\nTested on desktop; iPhone Safari not tested.\n" + extra;

const run = (content?: string) => {
  const file = join(mkdtempSync(join(tmpdir(), "doc-")), "d.md");
  if (content !== undefined) writeFileSync(file, content);
  return spawnSync("node", ["tools/check-doc.mjs", file], { encoding: "utf8" });
};

describe("check-doc", () => {
  it("accepts a complete doc", () => expect(run(good()).status).toBe(0));
  it("rejects a missing file", () => expect(run().status).not.toBe(0));
  it("rejects a missing heading", () => expect(run(good().replace("## Rate limits", "## Other")).status).not.toBe(0));
  it("rejects an empty Verdict cell", () => expect(run(good("\n| Endpoint | Verdict |\n|---|---|\n| x |  |\n")).status).not.toBe(0));
  it("rejects an empty Verdict: line", () => expect(run(good("\nVerdict:\n")).status).not.toBe(0));
  it("rejects TODO", () => expect(run(good("\nTODO\n")).status).not.toBe(0));
  it("rejects a doc without iPhone Safari", () => expect(run(good().replace(/iPhone Safari/g, "phone")).status).not.toBe(0));
});
