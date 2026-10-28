---
phase: 01-foundations-and-garmin-probe
plan: 05
subsystem: cli
tags: [probe, garmin, cli, depth-search]
requires:
  - phase: 01-03
    provides: garmin-client (fetchToken/get/classify/ENDPOINTS/buildPath)
provides:
  - "apps/cli probe and report commands"
  - "history-depth search, report table, docs skeleton"
affects: [01-06, 01-07]
tech-stack:
  added: []
  patterns: [injected fetch/sleep/now/write for side-effect-free tests]
key-files:
  created:
    - apps/cli/src/config.ts
    - apps/cli/src/probe.ts
    - apps/cli/src/depth.ts
    - apps/cli/src/report.ts
    - apps/cli/src/main.ts
  modified:
    - apps/cli/package.json
key-decisions:
  - "Depth search miss requires 3 older adjacent empty days; ~10-step cap gives +/-3 day resolution"
  - "Run folder also holds results.json (shapes/metadata only, no bodies) so report can render without raw bodies"
requirements-completed: [PRB-01, PRB-02, FND-02]
duration: 20min
completed: 2026-10-28
---

# Phase 1 Plan 05: CLI probe Summary

`npx tsx apps/cli/src/main.ts probe | report <runDir>` with repo-path guard, 2s delay, 200-request cap, stop on first 429, single retry on 5xx/network, and exponential-then-binary history-depth search. All tests use stubs; nothing was run against the real API.

## Deviations from Plan

- Added `results.json` to the run folder (metadata and shapes only) because `renderSkeleton` needs per-endpoint findings; plan said "nothing else is written".
- Preflight requests (2 OPTIONS) and the token fetch: only the token fetch counts toward the cap; OPTIONS preflight does not.
- Activities-search depth is reported as "paged by index" rather than searched by date.
- Depth resolution is +/-3 days due to the ~10 step cap (test relaxed accordingly).
- `package.json` scripts: `cli:probe`/`cli:report` use `tsx` from the root install.

## Verification

vitest apps/cli 16/16, typecheck, check:boundaries, gitleaks clean, no console.log in apps/cli.

## Commits
- 48527d9 config + probe
- e0cccf1 depth + report + main

## Self-Check: PASSED
