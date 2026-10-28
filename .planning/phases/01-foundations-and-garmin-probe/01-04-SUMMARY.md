---
phase: 01-foundations-and-garmin-probe
plan: 04
subsystem: cors-probe
tags: [cors, static-page, github-pages]
requires: [01-01]
provides: [static CORS probe page, failure classifier, pages.yml deploy workflow]
affects: [01-07]
tech-stack:
  added: []
  patterns: [no-build static ES modules, no-cors control request to separate CORS from network failure]
key-files:
  created:
    - apps/cors-probe/package.json
    - apps/cors-probe/index.html
    - apps/cors-probe/probe.js
    - apps/cors-probe/classify.js
    - apps/cors-probe/classify.test.ts
    - apps/cors-probe/manifest.webmanifest
    - .github/workflows/pages.yml
decisions:
  - "Pages actions pinned by SHA (configure-pages v6.0.0, upload-pages-artifact v5.0.0, deploy-pages v5.0.1) resolved via git ls-remote"
metrics:
  tasks: 2
  files: 7
completed: 2026-10-28
---

# Phase 1 Plan 04: CORS Probe Page Summary

Dependency-free static page that takes the Garmin key in a password field (kept in a JS variable only), runs token + one data call, classifies failures as cors/network/http_N via a no-cors control request, and a Pages workflow ready to deploy it (not deployed).

## Deviations from Plan
None. Page shows no bodies/headers/keys, uses no storage/cookies/hash/form (grep guard passes). Typecheck, boundaries, vitest, gitleaks clean.

## Notes
- DATA_URL (`/userprofile-service/userprofile/settings`) is one constant in probe.js; swap in plan 07 if the CLI proves a cheaper endpoint.
- Token response parsed as bare JWT with JSON `accessToken` fallback.

Commits: 297847f, a8a5366

## Self-Check: PASSED
