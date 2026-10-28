# Roadmap: Insights

## Overview

Insights starts by proving what the Garmin Personal API actually delivers (and whether a browser can call it), then builds the store and ingest, then starts the n-of-1 clock with an early logging page (labels cannot be backfilled). Baselines, the effect engine and the explanation layer follow, all runnable without UI. The full iPhone PWA and polish come last, gated on real-device testing.

## Phases

- [ ] **Phase 1: Foundations and Garmin Probe** - Safe repo skeleton, then a capability probe that gates all later design
- [ ] **Phase 2: Store, Ingest, and Backup** - Idempotent Garmin ingest into a local store with export/import/delete
- [ ] **Phase 3: Early Logging Page** - Installable minimal page for quick-log, check-in and RPE, with backup safety
- [ ] **Phase 4: Time Module and Baselines** - Personal rolling baselines and a CLI "today vs you" report
- [ ] **Phase 5: Effect Engine** - Pure, synthetic-validated exposed-vs-unexposed estimation with false-positive gate
- [ ] **Phase 6: Explanations and Insight Lifecycle** - Template-based, evidence-backed insights and Body Battery/Stress explanations
- [ ] **Phase 7: Full PWA** - Today view, charts, feed, key vault and hardening, verified on a real iPhone
- [ ] **Phase 8: Polish and Docs** - README, architecture doc, synthetic screenshots, coverage report

## Phase Details

### Phase 1: Foundations and Garmin Probe
**Goal**: The repo is safe to hold a real Garmin key, and the user knows exactly what the API provides for the vivoactive 5 and whether browsers can call it
**Depends on**: Nothing (first phase)
**Requirements**: FND-01, FND-02, FND-03, PRB-01, PRB-02, PRB-03, PRB-04, PRB-05
**Success Criteria** (what must be TRUE):
  1. A commit containing a fake key-shaped string is blocked by the pre-commit hook, and CI runs tests plus gitleaks on push
  2. User can run one CLI command that authenticates with the personal key, refreshes the 24h token, and prints per-endpoint status
  3. `docs/garmin-capabilities.md` lists, per endpoint, data shape, granularity, rate-limit headers and history depth for the vivoactive 5
  4. A static page opened in desktop and iPhone Safari reports whether a browser-origin call to Garmin succeeds, and the doc states the proxy go/no-go and shared-origin risk
  5. Scrubbed recorded responses exist as fixtures, and an import-boundary check fails if a package imports against the one-way order
**Plans**: 7 plans

Plans:
- [ ] 01-01-PLAN.md — Root workspace, gitignore, gitleaks pre-commit hook (tested), CI
- [ ] 01-02-PLAN.md — Package stubs and dependency-cruiser boundary check with self-test
- [ ] 01-03-PLAN.md — garmin-client: auth, classification, endpoint table
- [ ] 01-04-PLAN.md — Static CORS test page and Pages workflow
- [ ] 01-05-PLAN.md — CLI probe (politeness controls, depth search, report skeleton)
- [ ] 01-06-PLAN.md — Scrub script and leak scan for fixtures
- [ ] 01-07-PLAN.md — Live probe, browser matrix, capabilities doc, fixtures (checkpoints)

### Phase 2: Store, Ingest, and Backup
**Goal**: User can pull Garmin history into a local store repeatedly without duplicates, and can export, import and delete everything
**Depends on**: Phase 1
**Requirements**: ING-01, ING-02, ING-03, ING-04, ING-05, ING-06, STO-01, STO-02, STO-03
**Success Criteria** (what must be TRUE):
  1. User can run a sync that pulls daily summary, sleep stages, HRV, stress, Body Battery, heart rate and activities, and a second run creates no duplicates
  2. Each endpoint reports "no data", "access denied", "rate limited" or "error" distinctly in the sync log
  3. User can backfill as much history as the API allows, interrupt it, and resume where it stopped
  4. Sleep appears on its wake-up day, timestamps carry tzId and localDate, and sentinel stress values do not show up as real readings
  5. User can export all data to JSON, delete everything, and import it back to an identical store (in-memory and Dexie pass the same conformance suite)
**Plans**: TBD

### Phase 3: Early Logging Page
**Goal**: User can log inputs, daily check-ins and workout effort from the iPhone in seconds, with their data protected from loss
**Depends on**: Phase 2
**Requirements**: LOG-01, LOG-02, LOG-03, LOG-04, LOG-05, LOG-06, LOG-07, LOG-08, STO-04, STO-05
**Success Criteria** (what must be TRUE):
  1. User can add the page to the iPhone home screen and log a seeded input in under 10 seconds
  2. User can backdate, edit, undo and delete an event, and add a custom input type
  3. Caffeine and alcohol accept a dose, while nicotine and marijuana record event counts only
  4. User can complete a daily check-in (energy, mood, soreness, optional note) in a few taps, rate a workout 1-10, and mark a day "log complete"
  5. App shows a last-backup indicator that nags when stale, requests persistent storage, and offers restore if the store is empty but data previously existed
**Plans**: TBD

### Phase 4: Time Module and Baselines
**Goal**: Every Garmin metric is judged against the user's own trailing baseline, with honest cold-start behavior
**Depends on**: Phase 2
**Requirements**: BAS-01, BAS-02, BAS-03, BAS-04, BAS-05
**Success Criteria** (what must be TRUE):
  1. User can run a CLI "today vs you" report showing HRV, resting HR, sleep, stress and Body Battery as deviations from their 28-day median and spread
  2. With too little history, a metric shows "still learning, N more days" instead of a number
  3. Flat or sparse data (MAD=0, missing days) produces no crash or infinite deviation
  4. Window results are identical and correct across the 2026-11-01 DST fall-back and a timezone change in the test matrix
**Plans**: TBD

### Phase 5: Effect Engine
**Goal**: The engine reports only effects it can defend, recovers planted effects on synthetic data, and stays silent on noise
**Depends on**: Phase 3, Phase 4
**Requirements**: ENG-01, ENG-02, ENG-03, ENG-04, ENG-05, ENG-06, ENG-07, ENG-08, ENG-09, DOC-01
**Success Criteria** (what must be TRUE):
  1. On synthetic data with planted effects (AR(1) noise, weekly cycle, non-random missingness), the engine recovers each effect with size, sample size and "n of m" consistency
  2. On null data across multiple seeds, the engine yields no insights, and CI fails if the false-positive rate rises
  3. No result appears below the minimum exposed/unexposed thresholds, which are editable in one config file
  4. Co-occurring exposures are flagged and refused single attribution; caffeine and alcohol show dose-response
  5. The engine package has no UI, network or browser imports, and every function has unit tests with timezone/DST cases for window math
**Plans**: TBD

### Phase 6: Explanations and Insight Lifecycle
**Goal**: User gets plain-language, evidence-backed insights and explanations they can act on and give feedback on
**Depends on**: Phase 5
**Requirements**: EXP-01, EXP-02, EXP-03, EXP-04, EXP-05
**Success Criteria** (what must be TRUE):
  1. For an unusual Body Battery drain/recharge or Stress spike, user sees ranked likely contributors plus an explicit "unexplained" remainder
  2. All insight text comes from one template file, includes counts and confidence, and a copy-lint test fails on causal or judgmental wording
  3. Repeated runs do not duplicate insights; unsupported insights age out; tapping an insight lists the underlying days
  4. Each insight proposes a testable experiment, and the user can mark it tested, wrong or dismissed with feedback kept separate from derived data
**Plans**: TBD

### Phase 7: Full PWA
**Goal**: The complete app runs installed on the iPhone, handles the key safely, and survives real-device conditions
**Depends on**: Phase 6
**Requirements**: UI-01, UI-02, UI-03, UI-04, UI-05, UI-06, UI-07, UI-08, UI-09
**Success Criteria** (what must be TRUE):
  1. User completes setup inside the installed iPhone app, enters the Garmin key at runtime, and unlocks it with a passphrase; the key is never written plain to storage
  2. Today view shows each metric against baseline, trend charts show a median ± spread band, and the insight feed opens evidence
  3. User can refresh manually or on app open and sees last-synced time and per-endpoint status
  4. User sees a key-expiry warning well before lapse and can replace the key easily
  5. On a real iPhone, the app launches offline, and export (share sheet), backup and delete work; CSP is strict with no third-party scripts and the service worker caches the shell only
**Plans**: TBD

### Phase 8: Polish and Docs
**Goal**: The project is presentable as a portfolio piece without exposing personal data
**Depends on**: Phase 7
**Requirements**: DOC-02
**Success Criteria** (what must be TRUE):
  1. README and architecture doc let a newcomer understand and run the project
  2. Screenshots in the repo come from synthetic data only
  3. A coverage report is generated by CI and linked from the README
**Plans**: TBD

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundations and Garmin Probe | 0/TBD | Not started | - |
| 2. Store, Ingest, and Backup | 0/TBD | Not started | - |
| 3. Early Logging Page | 0/TBD | Not started | - |
| 4. Time Module and Baselines | 0/TBD | Not started | - |
| 5. Effect Engine | 0/TBD | Not started | - |
| 6. Explanations and Insight Lifecycle | 0/TBD | Not started | - |
| 7. Full PWA | 0/TBD | Not started | - |
| 8. Polish and Docs | 0/TBD | Not started | - |
