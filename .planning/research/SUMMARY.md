# Research Summary: Insights

**Synthesized:** 2026-10-28 from STACK.md, FEATURES.md, ARCHITECTURE.md, PITFALLS.md
**Overall confidence:** MEDIUM

## Executive Summary

Insights is a local-first, phone-first PWA that joins Garmin Personal API data with quick self-logs (caffeine, alcohol, nicotine, marijuana, check-ins, RPE) and runs evidence-first n-of-1 analysis. Comparable products (Whoop, Oura, Bearable, Exist.io) log and correlate, but none are honest about sample size, lag windows, confounding or multiple comparisons. That honesty is the product.

The design is a functional core: a pure, framework-free `engine` package works on plain arrays with injected time and seeded randomness. Thin shells (Node CLI, Svelte 5 PWA) handle I/O. A `Store` interface has MemoryStore and Dexie adapters. Stats are hand-rolled (permutation/bootstrap, MAD baselines, Benjamini-Hochberg FDR).

The biggest risk is the Garmin API: CORS, endpoint list, granularity, rate limits, history depth and vivoactive 5 coverage are all unverified. A mandatory Phase 0 probe gates everything, including a test from real iPhone Safari on the final hosting origin.

## Key Findings

### Stack (STACK.md)
- Node 24 LTS, TypeScript strict (TS 7 latest; fall back to 5.x/6.x if plugins choke), Vite 8, Svelte 5 as a plain SPA (React 19 acceptable swap).
- Dexie 4 + fake-indexeddb behind a Store interface; sqlite-wasm/OPFS rejected for v1.
- vite-plugin-pwa 2.0, shell-only precache, `registerType: 'prompt'`; never cache Garmin responses.
- uPlot for charts (Chart.js fallback); Vitest 5, fast-check, `TZ=` matrix.
- Web Crypto key vault: PBKDF2 (600k+ iterations) into AES-GCM; key and tokens held in memory only; meta-tag CSP.
- Hand-rolled stats; `simple-statistics` only as a test cross-check.
- gitleaks in CI and pre-commit hook plus GitHub push protection before any real key exists.
- Conditional Cloudflare Worker proxy (stateless, allowlisted, no logging) only if CORS blocks.
- Unverified: TS 7 + vite-plugin-pwa 2.0 + svelte-check compatibility. Scaffold and build in week 1.

### Features (FEATURES.md)
- **Table stakes:** Today view vs own baseline with cold-start states, trend charts with median±MAD band, quick-log (<10s, backdating, undo), custom input types, daily check-in and RPE, sync status, key-expiry warning, export/import/delete, last-backup indicator, installable PWA.
- **Differentiators:** evidence-first insights ("6 of 8", n, confidence, hidden below thresholds), exposure windows with lag, confounding flags, Body Battery/Stress explanation with "unexplained" remainder, suggested experiments, insight lifecycle, synthetic-validated engine.
- **Defer:** check-in-to-metric learning, anomaly detection, CSV export, ML, dose-response beyond caffeine/alcohol.
- **Never build:** composite score, push/background sync, gamification, LLM text, cloud/accounts, causal wording.

### Architecture (ARCHITECTURE.md)
- Monorepo with enforced import boundaries: `core`, `garmin-client`, `ingest`, `store`, `engine`, `apps/cli`, `apps/web`, optional `proxy`.
- garmin-client: injected fetch/clock/key; error taxonomy NoData / AccessDenied / RateLimited / Error.
- ingest: `localDate` + tzId stored at write time, idempotent overwrite upsert, trailing ~3-day re-pull, resumable backfill.
- Derived data is a rebuildable cache; user feedback lives in its own table.
- Window math in local wall-clock via one time adapter; sleep dated to wake-up day.
- Verified: Garmin token endpoint (`POST .../personal-api-key/token`, `Authorization: ApiKey`). Everything else about the API is unverified.

### Top Pitfalls (PITFALLS.md)
1. "Not logged" treated as "not exposed" — per-day log-complete marker.
2. Multiple comparisons — BH-FDR, permutation tests, effect-size floor, replication gate, tiers; CI gate requiring null data yield no insights.
3. Too-easy synthetic validation — AR(1) noise, weekly cycle, non-random missingness, integer metrics, shuffled-label runs on real data.
4. Day-alignment and DST errors — US fall-back on 2026-11-01 lands in the first weeks of real data.
5. Collinear exposures and circular outcomes (Stress/HRV/Body Battery not independent) — co-occurrence refusal, small primary outcome set, mandatory unexplained remainder.
6. Key/storage hazards — shared-origin IndexedDB on `user.github.io`, memory-only key, iOS eviction.
7. Garmin assumptions — CORS, TLS fingerprinting, doc/behavior mismatch, late-revised data, sentinel negative stress values, vivoactive 5 coverage.

## Implications for Roadmap

Suggested phases (8, plus one recommended insertion):

0. **Foundations and Garmin Probe** — skeleton, CI, gitleaks, garmin-client, CLI probe, browser CORS page tested from iPhone, `docs/garmin-capabilities.md`, scrubbed fixtures, **hosting-origin decision**, proxy go/no-go.
1. **Store, Ingest, Export/Import** — Store interface, MemoryStore, conformance suite, ingest with error taxonomy, upsert and re-pull, sentinel normalization.
1.5. **Early Logging Page (recommended insertion)** — minimal PWA page with check-in, quick-log, day-complete marker, DexieStore, export. Labels cannot be backfilled, so this starts the n-of-1 clock.
2. **Time Module, Baselines, CLI "Today vs You"** — DST test matrix, trailing 28-day median/MAD, MAD=0 guard, minimum valid days.
3. **Logging Model Hardening and RPE** — custom types, edit/delete, RPE prompts, wear-coverage and nap exclusion. May merge with 1.5.
4. **Effect Engine and Synthetic Generator** — generator first, test-first; windows, permutation/bootstrap, FDR, tiers, confounding flags, `config.ts`, null-data FP CI gate.
5. **Explanations, Templates, Lifecycle, Experiments** — gated on Phase 4 recovering planted effects; one-file templates with copy-lint test, dedupe, feedback table.
6. **Full PWA UI** — Today, feed, charts, key vault, expiry banners, versioned SW, persist + backup nag, restore prompt, share-sheet export, CSP, proxy if needed. Real-iPhone testing is the gate.
7. **Polish and Docs** — synthetic-data screenshots only, CI secret/PII scan, README/architecture docs.

### Research Flags
- **Needs research:** Phase 0 (Swagger/OpenAPI, CORS preflight, Worker TLS fingerprinting, vivoactive 5 coverage, key format for gitleaks rule); Phases 1.5/6 (iOS 26 `persist()`, eviction, standalone share-sheet export); Phase 4 (block-permutation size, replication gate, shrinkage/power parameters); Phase 6 (vite-plugin-pwa 2.0 + TS 7, CSP `style-src` with Svelte/uPlot).
- **Standard patterns:** Phases 1, 2, 3, 5, 7.

## Confidence

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | MEDIUM | Versions from npm; cross-compatibility and iOS behavior untested |
| Features | MEDIUM-LOW | Competitor details from training data only |
| Architecture | MEDIUM | Patterns/stats HIGH; Garmin endpoints, limits, CORS LOW |
| Pitfalls | MEDIUM | Stats HIGH; Garmin/vivoactive 5/iOS 26 specifics LOW-MEDIUM |

### Gaps
- Garmin endpoint list, data base URL, rate limits, history depth.
- CORS and Worker blocking; fallback is CLI-only ingest with export to the PWA.
- vivoactive 5 coverage/granularity over roughly 100 days of wear.
- Hosting origin (open question for the user).
- iOS 26 persistence and share-sheet export, verified on device.
- Temporal vs polyfill vs Luxon for window math.
- Whether ~100 days of data supports more than a few insights.
- Competitor claims need re-verification.

Decided with user: substance/health log tables are not encrypted at rest in v1.
