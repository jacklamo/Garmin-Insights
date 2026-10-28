# Requirements: Insights

**Defined:** 2026-10-28
**Core Value:** Show me, in plain language with sample sizes and confidence, what my logged behavior actually does to my body relative to my own baseline.

## v1 Requirements

### Foundations & Security

- [ ] **FND-01**: Repo has .gitignore, pre-commit secret scan, and CI (tests + gitleaks) before any real Garmin key is used
- [ ] **FND-02**: Garmin key and access tokens never appear in source, logs, fixtures, repo, or deployed site
- [ ] **FND-03**: Monorepo with enforced one-way package boundaries (core, garmin-client, ingest, store, engine, apps)

### Garmin Capability Probe

- [ ] **PRB-01**: User can run a CLI probe that authenticates with the personal key and refreshes the 24h token
- [ ] **PRB-02**: Probe records per-endpoint status, data shape, granularity, rate-limit headers, and history depth for the vivoactive 5
- [ ] **PRB-03**: A static page tests auth and one data call from a real browser origin (including iPhone Safari) and records the CORS verdict
- [ ] **PRB-04**: `docs/garmin-capabilities.md` records findings, a proxy go/no-go verdict, and the shared-origin risk of the default GitHub Pages origin
- [ ] **PRB-05**: Scrubbed recorded API responses are saved as test fixtures

### Garmin Ingest

- [ ] **ING-01**: Client distinguishes "no data", "access denied", "rate limited", and "error" per endpoint
- [ ] **ING-02**: User can pull daily summary, sleep (with stages), HRV, stress, Body Battery, heart rate, and activities as available per probe
- [ ] **ING-03**: Pulls are idempotent upserts with a sync log and a trailing ~3-day re-pull for late/revised data
- [ ] **ING-04**: User can backfill as much history as the API allows, resumably
- [ ] **ING-05**: Timestamps stored as UTC with tzId and localDate; sleep dated to wake-up day; sentinel stress values normalized
- [ ] **ING-06**: Garmin client is tested against recorded fixtures, never the live API

### Storage & Backup

- [ ] **STO-01**: Local store sits behind an interface with in-memory and Dexie/IndexedDB implementations sharing one conformance test suite
- [ ] **STO-02**: User can export all data to JSON and import it back
- [ ] **STO-03**: User can delete all data
- [ ] **STO-04**: App shows a last-backup indicator and nags when backup is stale; requests persistent storage and handles denial
- [ ] **STO-05**: App detects an empty store where data previously existed and offers restore

### Logging

- [ ] **LOG-01**: User can log an input event (caffeine, nicotine, marijuana, alcohol, guitar, meals/late eating, screen time/late night) in under 10 seconds
- [ ] **LOG-02**: User can backdate an event and undo/edit/delete it
- [ ] **LOG-03**: User can add custom input types
- [ ] **LOG-04**: Nicotine and marijuana are logged as event counts only; caffeine and alcohol support a dose
- [ ] **LOG-05**: User can complete a daily check-in (energy, mood, soreness 1-5, optional note) in a few taps
- [ ] **LOG-06**: User can rate perceived effort (1-10) for a workout
- [ ] **LOG-07**: User can mark a day "log complete"; only completed days enter the unexposed pool
- [ ] **LOG-08**: A minimal installable logging page (check-in, quick-log) ships right after ingest, before baselines/engine

### Baselines

- [ ] **BAS-01**: Each metric (HRV, resting HR, sleep, stress, Body Battery) has a trailing 28-day median and robust spread (MAD/IQR) baseline
- [ ] **BAS-02**: Each day is expressed as a robust deviation from the user's own baseline; MAD=0 and sparse data are guarded
- [ ] **BAS-03**: Cold start shows "still learning, N more days" instead of guessing
- [ ] **BAS-04**: CLI "today vs you" report prints current deviations
- [ ] **BAS-05**: One time module handles all window math in local wall-clock with tests across DST and timezone changes

### Effect Engine

- [ ] **ENG-01**: Per-input configurable exposure windows (same evening, overnight, next morning, next day, 2-day lag)
- [ ] **ENG-02**: Exposed-vs-unexposed estimation with seeded permutation/bootstrap, reporting effect size in user units, sample size, and "n of m" consistency
- [ ] **ENG-03**: Multiple-comparison control (Benjamini-Hochberg), effect-size floor, and tiered confidence
- [ ] **ENG-04**: Minimum observation thresholds (configurable in one file) gate any insight from being shown
- [ ] **ENG-05**: Co-occurring/collinear exposures are flagged and single attribution is refused
- [ ] **ENG-06**: Dose-response for caffeine and alcohol; timing sensitivity where sample size permits
- [ ] **ENG-07**: Engine is pure (no UI/network/browser APIs), with time and PRNG injected
- [ ] **ENG-08**: Synthetic generator (AR(1) noise, weekly cycle, non-random missingness) validates planted-effect recovery
- [ ] **ENG-09**: CI gate: null data across multiple seeds yields no insights (false-positive rate tracked)

### Explanations & Insights

- [ ] **EXP-01**: User sees ranked likely contributors for unusual Body Battery drain/recharge and Stress spikes, with an explicit "unexplained" remainder
- [ ] **EXP-02**: Insight text comes from templates in one file with counts and confidence; no causal or judgmental wording; copy-lint test enforces it
- [ ] **EXP-03**: Insights are deduplicated, aged out when unsupported, and carry evidence the user can tap through to the underlying days
- [ ] **EXP-04**: Each insight suggests a testable experiment
- [ ] **EXP-05**: User can mark an insight tested, wrong, or dismissed; feedback is stored separately from derived data

### PWA UI

- [ ] **UI-01**: App is installable on iPhone (manifest, service worker, offline shell) and setup completes inside the installed app
- [ ] **UI-02**: Today view shows each metric against the user's baseline
- [ ] **UI-03**: Trend charts show a median ± spread band
- [ ] **UI-04**: Insight feed with tap-through evidence
- [ ] **UI-05**: Manual refresh plus pull on app open, with last-synced time and per-endpoint status
- [ ] **UI-06**: Garmin key is entered at runtime and stored encrypted (PBKDF2 → AES-GCM) with passphrase unlock; key and tokens held in memory only
- [ ] **UI-07**: Key-expiry date is tracked with a warning well before it lapses and an easy replace-key flow
- [ ] **UI-08**: Strict CSP, no third-party scripts, pinned dependencies; service worker caches app shell only
- [ ] **UI-09**: Export/backup/delete reachable from the app; verified on a real iPhone including share-sheet export and offline launch

### Documentation & Quality

- [ ] **DOC-01**: Unit tests for every engine function; timezone/DST tests for every window calculation
- [ ] **DOC-02**: README, architecture doc, screenshots (synthetic data only), and coverage report

## v2 Requirements

### Engine

- **V2-01**: Learn which watch metrics predict check-in scores
- **V2-02**: Anomaly detection (illness onset, overreaching)
- **V2-03**: Dose-response beyond caffeine and alcohol
- **V2-04**: ML models, only if they beat the Layer 3 baseline on held-out data

### Platform

- **V2-05**: CSV export
- **V2-06**: Cloudflare Worker proxy (promoted to v1 if the Phase 0 probe shows CORS blocks)
- **V2-07**: Native Swift migration
- **V2-08**: Dedicated hosting origin (custom domain/separate account) to isolate IndexedDB

## Out of Scope

| Feature | Reason |
|---------|--------|
| Multi-user, accounts, sharing | Personal API tier terms forbid commercial multi-user use |
| Cloud sync / hosted backend | Privacy; local-first |
| Writing data back to Garmin | API is read-only |
| Medical claims, diagnosis, abstinence advice | Observations about own patterns only |
| Replicating Garmin Stress/Body Battery formulas or a composite score | Black boxes to explain, not reproduce |
| LLM-written insights, analytics, third-party SDKs | Privacy; templates only in v1 |
| Background sync / web push | Unreliable on iOS PWAs |
| Gamification, streaks | Conflicts with plain, non-cheerleading tone |
| Insights from stripped FIT fields (VO2 max, recovery time, training effect, etc.) | Not delivered by the API |
| At-rest encryption of substance/health log tables | User decision: device security sufficient; ciphertext can't be indexed |
| Calorie and weight tracking | Not core; weight endpoint unreliable |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| FND-01 | Phase 1 | Pending |
| FND-02 | Phase 1 | Pending |
| FND-03 | Phase 1 | Pending |
| PRB-01 | Phase 1 | Pending |
| PRB-02 | Phase 1 | Pending |
| PRB-03 | Phase 1 | Pending |
| PRB-04 | Phase 1 | Pending |
| PRB-05 | Phase 1 | Pending |
| ING-01 | Phase 2 | Pending |
| ING-02 | Phase 2 | Pending |
| ING-03 | Phase 2 | Pending |
| ING-04 | Phase 2 | Pending |
| ING-05 | Phase 2 | Pending |
| ING-06 | Phase 2 | Pending |
| STO-01 | Phase 2 | Pending |
| STO-02 | Phase 2 | Pending |
| STO-03 | Phase 2 | Pending |
| LOG-01 | Phase 3 | Pending |
| LOG-02 | Phase 3 | Pending |
| LOG-03 | Phase 3 | Pending |
| LOG-04 | Phase 3 | Pending |
| LOG-05 | Phase 3 | Pending |
| LOG-06 | Phase 3 | Pending |
| LOG-07 | Phase 3 | Pending |
| LOG-08 | Phase 3 | Pending |
| STO-04 | Phase 3 | Pending |
| STO-05 | Phase 3 | Pending |
| BAS-01 | Phase 4 | Pending |
| BAS-02 | Phase 4 | Pending |
| BAS-03 | Phase 4 | Pending |
| BAS-04 | Phase 4 | Pending |
| BAS-05 | Phase 4 | Pending |
| ENG-01 | Phase 5 | Pending |
| ENG-02 | Phase 5 | Pending |
| ENG-03 | Phase 5 | Pending |
| ENG-04 | Phase 5 | Pending |
| ENG-05 | Phase 5 | Pending |
| ENG-06 | Phase 5 | Pending |
| ENG-07 | Phase 5 | Pending |
| ENG-08 | Phase 5 | Pending |
| ENG-09 | Phase 5 | Pending |
| DOC-01 | Phase 5 | Pending |
| EXP-01 | Phase 6 | Pending |
| EXP-02 | Phase 6 | Pending |
| EXP-03 | Phase 6 | Pending |
| EXP-04 | Phase 6 | Pending |
| EXP-05 | Phase 6 | Pending |
| UI-01 | Phase 7 | Pending |
| UI-02 | Phase 7 | Pending |
| UI-03 | Phase 7 | Pending |
| UI-04 | Phase 7 | Pending |
| UI-05 | Phase 7 | Pending |
| UI-06 | Phase 7 | Pending |
| UI-07 | Phase 7 | Pending |
| UI-08 | Phase 7 | Pending |
| UI-09 | Phase 7 | Pending |
| DOC-02 | Phase 8 | Pending |

**Coverage:**
- v1 requirements: 57 total
- Mapped to phases: 57
- Unmapped: 0 ✓

---
*Requirements defined: 2026-10-28*
*Last updated: 2026-10-28 after initial definition*
