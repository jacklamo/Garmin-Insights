---
phase: 01-foundations-and-garmin-probe
plan: 02
subsystem: tooling
tags: [dependency-cruiser, workspaces, boundaries, ci]
requires: [01-01]
provides:
  - five @insights/* workspace stubs with one-way allowed edges
  - dependency-cruiser boundary check (check:boundaries) with self-test, wired into CI
affects: [all later packages]
tech-stack:
  added: ["@swc/core 1.x (dev, depcruise parser)"]
  patterns: ["package order: core <- garmin-client/engine/store; ingest -> core, garmin-client; packages never import apps"]
key-files:
  created: [.dependency-cruiser.cjs, tools/boundaries.test.ts, tools/boundary-fixtures/bad/**, packages/*/package.json, packages/*/src/index.ts, apps/.gitkeep]
  modified: [package.json, package-lock.json, .github/workflows/ci.yml]
key-decisions:
  - "Use depcruise swc parser: TypeScript 7 is unsupported by depcruise and otherwise cruises 0 modules silently"
  - "Store interface type lives in core so ingest never imports store"
metrics:
  completed: 2026-10-28
  tasks: 2
---

# Phase 1 Plan 02: Package stubs and boundary check Summary

Five package stubs plus a dependency-cruiser rule set that fails on forbidden edges and cycles, proven by a self-test over a bad fixture tree (relative import, workspace-style `@insights/store` import, cycle).

## Deviations from Plan

**[Rule 3 - Blocking] depcruise cruised 0 modules under TypeScript 7.** Installed `@swc/core` (exact pin) and set `parser: "swc"`. Real tree now cruises 5 modules. A harmless "missing-tsc-transpiler" warning still prints.

**[Rule 3] `apps/` did not exist**, so `depcruise packages apps` would error; added `apps/.gitkeep`.

Also: self-test needed `validate: true` in the cruise API call or no rules are evaluated.

## Verification
`npm test`, `npm run check:boundaries`, `npm run typecheck` all green.

## Commits
- 56f05da: package stubs
- a0c1f3a: boundary rules, self-test, CI step

## Self-Check: PASSED
