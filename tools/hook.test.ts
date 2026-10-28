import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { chmodSync, copyFileSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function makeRepo() {
  const dir = mkdtempSync(join(tmpdir(), "hook-"));
  const hooks = join(dir, "hooks");
  mkdirSync(hooks);
  copyFileSync(join(root, ".husky/pre-commit"), join(hooks, "pre-commit"));
  chmodSync(join(hooks, "pre-commit"), 0o755); // git skips non-executable hooks (Linux checkout of a Windows-committed file)
  copyFileSync(join(root, ".gitleaks.toml"), join(dir, ".gitleaks.toml"));
  const git = (args: string[], env = process.env) =>
    spawnSync("git", args, { cwd: dir, env, encoding: "utf8" });
  git(["init", "-q"]);
  git(["config", "core.hooksPath", "hooks"]);
  git(["config", "user.email", "t@example.com"]);
  git(["config", "user.name", "t"]);
  return { dir, git };
}

// Built at runtime so the test file itself never contains a key-shaped literal.
const fakeKey = () => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const b = randomBytes(36);
  return "ghp_" + Array.from(b, (x) => chars[x % chars.length]).join("");
};

describe("pre-commit hook", () => {
  it("blocks a fake key-shaped secret", () => {
    const { dir, git } = makeRepo();
    writeFileSync(join(dir, "a.txt"), `token = "${fakeKey()}"\n`);
    git(["add", "a.txt"]);
    expect(git(["commit", "-m", "x"]).status).not.toBe(0);
  });

  it("allows a benign file", () => {
    const { dir, git } = makeRepo();
    writeFileSync(join(dir, "a.txt"), "hello\n");
    git(["add", "a.txt"]);
    expect(git(["commit", "-m", "x"]).status).toBe(0);
  });

  it("fails loudly when gitleaks is missing", () => {
    const { dir, git } = makeRepo();
    writeFileSync(join(dir, "a.txt"), "hello\n");
    git(["add", "a.txt"]);
    const path = (process.env.PATH ?? process.env.Path ?? "")
      .split(delimiter)
      .filter((p) => !/gitleaks/i.test(p))
      .join(delimiter);
    const r = git(["commit", "-m", "x"], { ...process.env, PATH: path, Path: path });
    expect(r.status).not.toBe(0);
    expect(r.stdout + r.stderr).toContain("gitleaks not installed");
  });
});
