---
phase: 01-foundations-and-garmin-probe
plan: 01
subsystem: infra
tags: [gitleaks, husky, vitest, ci, npm-workspaces]
requires: []
provides:
  - root npm workspace (packages/*, apps/*), Vitest + strict TS config
  - fail-loud gitleaks pre-commit hook with tested block
  - CI with typecheck, tests, checksum-verified full-history gitleaks
affects: [all later plans]
tech-stack:
  added: [typescript 7.0.2, vitest 5.0.5, tsx, dependency-cruiser, husky, "@types/node", gitleaks 8.30.1]
  patterns: [save-exact, secrets live outside repo]
key-files:
  created: [package.json, .npmrc, tsconfig.json, vitest.config.ts, .gitignore, .gitattributes, .env.example, .gitleaks.toml, .husky/pre-commit, tools/hook.test.ts, .github/workflows/ci.yml]
key-decisions:
  - "Hook uses `gitleaks git --pre-commit --staged --redact -v --config .gitleaks.toml` (flags confirmed via --help)"
  - "Actions pinned by SHA via git ls-remote (gh CLI unavailable)"
duration: 15min
completed: 2026-10-28
---

# Phase 1 Plan 01: Repo Safety Summary

Gitleaks pre-commit hook (fail-loud, test-proven to block a runtime-generated ghp_ token) plus CI running typecheck, tests and checksum-verified full-history gitleaks, on a root npm workspace.

## Commits
- ffe391e: root workspace, ignore rules, tooling config
- 7976616: pre-commit hook and hook test
- 70f9e7c: CI workflow

## Deviations from Plan
None of substance. gitleaks installed via winget (v8.30.1); it is not on the Bash tool PATH until a shell restart (winget package dir), so commits from a fresh shell without it fail loudly, as designed. TypeScript 7.0.2 worked with tooling; no fallback needed. `gh` unavailable, so action SHAs came from `git ls-remote` (checkout v6.1.0, setup-node v6.5.0). YAML only checked by string keys, not parsed.

## Self-Check: PASSED
