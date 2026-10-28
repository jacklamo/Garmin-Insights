---
phase: 01-foundations-and-garmin-probe
plan: 03
subsystem: garmin-client
tags: [garmin, auth, jwt, classification, endpoints]
requires: [01-02]
provides:
  - "@insights/garmin-client: fetchToken, get, tokenExpiry, classify, isEmpty, GarminHttpError, ENDPOINTS, buildPath"
affects: [01-05, 01-06, ingest]
tech-stack:
  added: []
  patterns: ["browser-safe (global fetch/atob/TextDecoder, no node: imports)", "fixed-message errors; upstream messages never forwarded", "injectable fetch for stub tests"]
key-files:
  created: [packages/garmin-client/src/auth.ts, errors.ts, classify.ts, endpoints.ts, auth.test.ts, classify.test.ts, endpoints.test.ts]
  modified: [packages/garmin-client/src/index.ts]
key-decisions:
  - "Relative imports use .js extensions (required by repo's nodenext typecheck)"
  - "activities-search query (start=0&limit=20) baked into path; params kind 'none'"
metrics:
  completed: 2026-10-28
  tasks: 2
---

# Phase 1 Plan 03: Garmin client Summary

Browser-safe Garmin client with token fetch (bare or JSON-wrapped JWT), GET wrapper, JWT claim reader, 5-way status classification, leak-proof errors, and the 24-path seed endpoint table; 18 stub-fetch tests pass, including no-leak assertions for key/ApiKey/Bearer.

## Commits
- ad7a3ba: auth, errors, classification
- d969555: endpoint table
- c20adcd: fix .js import extensions

## Deviations from Plan

**1. [Rule 3 - Blocking] Typecheck failed on extensionless relative imports and an implicit-any in a test**
- Fix: added `.js` extensions, typed catch param. Commit c20adcd.

Endpoint-table test lives in endpoints.test.ts rather than classify.test.ts (plan only said "a small test").

## Self-Check: PASSED
