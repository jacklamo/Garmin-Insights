# Phase 1: Foundations and Garmin Probe - Context

**Gathered:** 2026-10-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Make the repo safe to hold a real Garmin key (gitignore, pre-commit secret scan, CI with tests + gitleaks, monorepo with enforced one-way package boundaries), then probe the Garmin Personal API for the vivoactive 5: CLI probe, browser-origin CORS test page, `docs/garmin-capabilities.md`, and scrubbed fixtures. No ingest, store, or app UI in this phase.

</domain>

<decisions>
## Implementation Decisions

### Key handling (CLI)
- Garmin key lives in a `.env` file located **outside the repo** (OneDrive Desktop syncs to cloud), e.g. `%LOCALAPPDATA%\insights\.env`; its path is set via an env var. The repo ships only `.env.example`.
- 24h access token is refreshed on every CLI run and held in memory only; never cached to disk.
- Pre-commit hook and CI use generic gitleaks rules now; add a Garmin-specific custom rule once the first probe reveals the key's shape.
- The pre-commit hook must demonstrably block a fake key-shaped string (success criterion 1).

### Probe output and fixtures
- Terminal output: compact table per endpoint (endpoint, status class ok / no data / access denied / rate limited / error, record count, date range, latency). No response bodies on screen.
- Raw responses saved **outside the repo**, one timestamped folder per run, never committed.
- Fixtures are produced by a repeatable scrub script, shape-preserving: strips IDs, names, GPS, device serials, shifts dates, keeps field names/types/realistic values and sentinel values. A scan confirms no key/token strings remain. Only scrubbed copies are committed.
- `docs/garmin-capabilities.md`: probe generates a per-endpoint table skeleton, then hand-annotated with verdicts (proxy go/no-go, quirks, shared-origin risk).

### Browser CORS test page
- Hosted on the real GitHub Pages origin (`user.github.io/repo`) so the verdict reflects production. Page contains no secrets.
- Key typed/pasted at runtime, held in memory only; no URL fragment, no storage.
- Reports pass/fail per step (token refresh, one data call) with the raw error class (CORS/network/HTTP status), browser, and origin. Does not display response bodies.
- Run on desktop browser and iPhone Safari (and installed home-screen mode if feasible); results hand-copied into the capabilities doc.

### Probe depth and politeness
- One light call to every reported endpoint (~26) to learn what exists; deep-dive only daily summary, sleep (stages), HRV, stress, Body Battery, heart rate, activities.
- History depth found by binary search back from today (expect shallow, watch worn since mid-summer 2026).
- Gentle: fixed delay between calls, hard request cap per run, record rate-limit headers, stop on first 429, never deliberately provoke throttling.
- Misbehaving endpoints (e.g. weight 400): record and continue, one retry at most; failure is a finding.

### Claude's Discretion
- Monorepo tooling, package manager, test runner, and how the import-boundary check is implemented.
- Exact gitleaks/pre-commit tooling and CI layout.
- Probe CLI structure, delay/cap values, scrub script internals.
- CORS page styling and deployment mechanics.

</decisions>

<specifics>
## Specific Ideas

- Nothing sensitive may sync to OneDrive: key and raw API responses stay outside the repo directory.
- If CORS blocks browser calls, flag the proxy tradeoff before building anything (per PROJECT.md).

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- None: repo contains only `.planning/` and `docs/` (greenfield).

### Established Patterns
- Planned dependency order from PROJECT.md: garmin-client → ingest → store → engine → ui; engine has no browser APIs. Phase 1 sets up the packages and the import-boundary check.

### Integration Points
- Probe's garmin-client code and scrubbed fixtures feed Phase 2 ingest and its recorded-fixture tests.
- Capabilities doc verdicts (granularity, history depth, CORS/proxy) gate Phase 2 design and Phase 7 hosting.

</code_context>

<deferred>
## Deferred Ideas

None: discussion stayed within phase scope.

</deferred>

---

*Phase: 01-foundations-and-garmin-probe*
*Context gathered: 2026-10-28*
