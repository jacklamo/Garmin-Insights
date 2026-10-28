# Insights

## What This Is

A single-user, phone-first (iPhone PWA) personal tool that joins Garmin watch data with self-logged inputs (caffeine, nicotine, marijuana, alcohol, guitar, etc.) and turns the combination into plain-language, evidence-backed explanations. It judges every metric against the user's own baseline, learns the user's own cause and effect, and explains Garmin's Stress and Body Battery rather than replacing them. Personal tool first, portfolio project second (code quality, tests, docs matter).

Full brief: `docs/insights-context.md`.

## Core Value

Show me, in plain language with sample sizes and confidence, what my logged behavior actually does to my body relative to my own baseline.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Capability probe of Garmin Personal API (endpoints, granularity, rate limits, history depth) documented in `docs/garmin-capabilities.md`, including browser-origin CORS verdict and whether a proxy is needed
- [ ] Idempotent Garmin ingest into local store with sync log, per-endpoint error taxonomy (no data vs access denied vs error), backfill, recorded-fixture tests
- [ ] JSON export/import, last-backup indicator, full delete from first working version
- [ ] Personal rolling baselines (28-day median + MAD/IQR) and daily deviations for HRV, resting HR, sleep, stress, Body Battery; cold-start handling; CLI "today vs you" report
- [ ] Logging: seeded input types (caffeine, nicotine, marijuana, alcohol, guitar, meals/late eating, screen time/late night), event-count logging, backdating, under 10 seconds per log
- [ ] Daily check-in (energy, mood, soreness 1-5) shipped early; workout perceived effort (RPE 1-10)
- [ ] Effect engine: exposure windows, exposed-vs-unexposed n-of-1 estimation, effect size/sample size/consistency, dose-response, timing, confounding flags, configurable minimum thresholds
- [ ] Engine validated on synthetic data with planted effects; null data yields no insights (false-positive rate tracked)
- [ ] Explanation layer for Body Battery and Stress with ranked contributors and explicit "unexplained" remainder; template-based insight copy in one file
- [ ] Insight lifecycle (generate, dedupe, age out, evidence tap-through, suggested experiment, tested/wrong/dismissed feedback)
- [ ] Installable iPhone PWA: Today view, quick-log, insight feed, trend charts, key-expiry warning, backup/export/delete
- [ ] Garmin key stored securely on-device (never in source/logs/repo/site); strict CSP, no third-party scripts
- [ ] CI with tests and secret scanning; README, architecture doc, screenshots, coverage report

### Out of Scope

- Multi-user, accounts, sharing — personal API tier terms forbid commercial multi-user use
- Cloud sync or hosted backend — privacy; local-first (stateless proxy only if CORS forces it)
- Writing anything back to Garmin — API is read-only
- Medical claims, diagnosis, treatment or abstinence advice — observations about own patterns only
- Replicating Garmin's proprietary scores / competing with Whoop — Stress and Body Battery are black boxes to explain
- Deep learning / ML in v1 — simple stats first; models must beat Layer 3 on held-out data
- Insights built on stripped FIT fields (VO2 max, recovery time, performance condition, training effect, sweat loss) — not delivered by API
- LLM phrasing, analytics, third-party SDKs — templates only in v1; privacy
- Background sync / web push — unreliable on iOS PWAs; pull on app open and manual refresh

## Context

- Watch: Garmin vivoactive 5, worn since mid-summer 2026 (limited history, so cold start and "still learning" states matter early). Metric availability on this model must be verified in Phase 0.
- Phone: iPhone on iOS 26.6.1, Safari "Add to Home Screen". Installed PWA storage is separate from Safari tabs; Safari may evict storage.
- Dev machine: Windows PC (this one); engine and ingest must run without UI (Node CLI/tests).
- Hosting: GitHub Pages (static, HTTPS, no secrets). If Garmin blocks browser CORS, a minimal stateless proxy (e.g. Cloudflare Worker) is the fallback; flag the tradeoff before building.
- Garmin Personal API: pull only, 24h access tokens, key expires (30d–1y), reported 26 GET endpoints (VERIFY), some endpoints may misbehave (e.g. weight returned 400).
- Seeded inputs: caffeine, nicotine, marijuana, alcohol, guitar, meals/late eating, screen time/late night. Nicotine and marijuana logged as event count only (no method/amount) in v1, which limits dose-response for those.

## Constraints

- **Platform**: PWA in TypeScript targeting iPhone Safari — no Apple signing/App Store/fee; engine kept pure and portable for a possible Swift migration
- **Architecture**: garmin-client → ingest → store → engine → ui; engine has no browser APIs; store behind an interface
- **Privacy/Security**: all data local, key never in repo/logs/site, export and delete from day one — substance and health data is sensitive
- **Timeline**: ~10 hrs/week, no hard deadline — steady pace, full v1 over a few months
- **Dependencies**: Garmin Personal API behavior is unverified — Phase 0 capability probe gates everything else; no UI before it
- **Statistics**: Honest uncertainty — every insight has sample size and confidence; minimum thresholds before showing (start ≥5 exposed, ≥10 unexposed)
- **Quality**: Boring, well-supported, justified dependencies; unit tests for all engine functions; timezone/DST tests

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| PWA (TypeScript) over native | No Apple fee/signing; iPhone-installable; engine portable | — Pending |
| GitHub Pages hosting | Free static HTTPS; user choice | — Pending |
| Local-first, no backend in v1 | Privacy of substance/health data | — Pending |
| Simple stats (baselines, paired comparisons) before ML | One person's data volume | — Pending |
| Templates, not LLM, for insight text | Privacy, determinism | — Pending |
| Event-count-only logging for nicotine/marijuana | Fast logging; user choice | — Pending |
| Phase 0 capability probe first | Garmin API granularity and CORS gate the design | — Pending |
| No at-rest encryption of substance/health log tables in v1 (Garmin key is still passphrase-encrypted) | Ciphertext can't be indexed/queried; device passcode is sufficient per user; encrypted export covers backups | — Pending |
| Check-in ships early | Subjective labels cannot be backfilled | — Pending |

---
*Last updated: 2026-10-28 after initialization*
