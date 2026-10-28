---
phase: 01-foundations-and-garmin-probe
plan: 06
subsystem: cli
tags: [scrub, fixtures, gitleaks]
requires: [01-05]
provides: [scrub subcommand, leak scan gate, fixtures:scan script]
affects: [01-07]
key-files:
  created: [apps/cli/src/scrub.ts, apps/cli/src/scan.ts, apps/cli/src/scrub.test.ts, fixtures/garmin/.gitkeep]
  modified: [apps/cli/src/main.ts, package.json]
key-decisions:
  - "Name-based scrubbing: only keys matching known patterns are pseudonymized/shifted; unknown identifying keys in real data must be caught by the scan or added to the patterns in plan 07."
requirements-completed: [PRB-05, FND-02]
duration: 10min
completed: 2026-10-28
---

# Phase 1 Plan 06: Scrub and Leak Scan Summary

Seeded, shape-preserving scrub of a raw run folder into `fixtures/garmin/` with a hard-gate scan (key/token, JWT regex, original-ID set, gitleaks) run at the end of the same command.

## Accomplishments
- `scrub <runDir>` pseudonymizes IDs consistently, redacts tokens/free text, drops geo and demographics, shifts all dates by one random whole-day offset (GMT/local equally), trims per-day record arrays to 3, and reduces headers files to names only.
- `scan` throws on any of four leaks; missing gitleaks is a failure. Each check is proven by a planted-leak test.
- Root script `fixtures:scan`.

## Deviations from Plan
None. One commit covers both tasks (they share files): daa937b.

## Known limits
- Epoch timestamps are shifted only under keys ending GMT/Local/Timestamp/Time; timestamps inside unlabeled arrays (e.g. `[[ms, value], ...]` under a different key) are not shifted. Review real output in plan 07.
- Original-ID scan ignores values shorter than 6 chars.
- No `.gitleaks.toml` allowlist was needed.

## Self-Check: PASSED
