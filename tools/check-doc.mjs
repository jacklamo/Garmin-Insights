import { existsSync, readFileSync } from "node:fs";

const file = process.argv[2] ?? "docs/garmin-capabilities.md";
const HEADINGS = ["Endpoints", "CORS verdict", "Proxy go/no-go", "Shared-origin risk", "Browser matrix", "Sleep dating", "Rate limits", "History depth"];

const problems = [];
if (!existsSync(file)) {
  problems.push(`${file} is missing`);
} else {
  const text = readFileSync(file, "utf8");
  const headings = [...text.matchAll(/^#+\s*(.+?)\s*$/gm)].map((m) => m[1].toLowerCase());
  for (const h of HEADINGS) if (!headings.includes(h.toLowerCase())) problems.push(`missing heading: ${h}`);
  if (/^Verdict:\s*$/m.test(text)) problems.push("empty Verdict:");
  if (/\bTODO\b/.test(text)) problems.push("leftover TODO");
  for (const need of [/desktop/i, /iphone safari/i]) if (!need.test(text)) problems.push(`does not mention ${need.source}`);
  // Empty Verdict cell in any table that has a Verdict column.
  let col = -1;
  for (const line of text.split("\n")) {
    if (!line.startsWith("|")) { col = -1; continue; }
    const cells = line.split("|").slice(1, -1).map((c) => c.trim());
    if (col < 0) { col = cells.findIndex((c) => c.toLowerCase() === "verdict"); continue; }
    if (/^-+$/.test(cells[0] ?? "")) continue;
    if (cells[col] === "") problems.push(`empty Verdict cell: ${cells[0]}`);
  }
}

if (problems.length) {
  console.error(problems.join("\n"));
  process.exit(1);
}
