# Insights: Project Context and Production Plan Brief

> Purpose of this document: give Claude Code full context on what Insights is, what constraints are real, and what to build first. Read it fully before proposing a plan. Where this document marks something as **VERIFY**, confirm it against the live Garmin documentation before building on it.

---

## 1. What this is

Insights is a **single-user, phone-first personal tool** that connects the data my Garmin watch collects with things I log myself, and turns the combination into explanations I can act on.

Garmin Connect gives me numbers and blanket labels ("Easy day", "Stressful day"). Those labels come from population thresholds. They do not compare me to me, and they do not know what I did. Insights replaces that with:

1. **My own baseline.** Every metric is judged against my own recent history, not a population.
2. **My own context.** I log inputs (caffeine, nicotine, marijuana, guitar, and more) that the watch cannot see.
3. **My own cause and effect.** The app learns, from my accumulating data, what those inputs actually do to my body, and says so in plain language.

The target output looks like:

> "Because of the marijuana logged at 8:00 PM, your overnight HRV was 1.3 SD below your usual and deep sleep ran 22 minutes short. This has happened on 6 of your last 8 nights after evening use."

Insights should also **make sense of Garmin's own Stress and Body Battery**, not replace them. When Body Battery drops or Stress spikes, the app should explain what contributed, using the logged context and the underlying signals.

This is a personal tool first. It is also a portfolio project, so code quality, tests, and documentation matter.

---

## 2. Design principles

- **Personal over population.** Never show a number without its meaning relative to my own baseline.
- **Honest about uncertainty.** Every insight carries a sample size and a confidence level. No causal claims stated as fact. Wording like "tends to" and "has coincided with", backed by counts.
- **Actionable.** An insight should end in something testable ("try X for a week and compare"), not just an observation.
- **Cheap to log.** Logging an input must take under 10 seconds. If logging is annoying, the data dies and the app dies with it.
- **Private by default.** The data includes substance use and health data. Everything stays on my device unless I explicitly choose otherwise.
- **Simple stats before machine learning.** At one person's data volume, baselines, lagged comparisons, and paired tests are more trustworthy than a model. Add models only after months of data, and only if they beat the simple version.
- **Not medical advice.** Observations about my own patterns only. No diagnosis, no treatment suggestions, no moralizing about substances.

---

## 3. Hard constraints (do not design around these, design with them)

### Garmin Personal API (what I have)

I have a **Garmin Personal API key** (Garmin Connect Developer Program, personal tier). Known properties:

- **Pull only.** No webhooks and no push. The app requests data when it wants it.
- **Access tokens last 24 hours.** The app must exchange the key for a fresh token when needed.
- **The key expires** (chosen at creation: 30, 90, 180 days, or 1 year). The app should track the expiry and warn me well before it lapses.
- **Read only.** No writing workouts or courses back to the watch.
- **Some fields are stripped from API-delivered FIT files:** VO2 max, recovery time, performance condition, training effect, sweat loss. Do not build core insights on these.
- **Terms:** the personal tier is for access to my own data, not a commercial multi-user service. Do not design for other users in v1. Keep the data layer clean enough that this could be revisited, but do not build multi-user features.
- **VERIFY:** The documented API surface (reported as 26 GET endpoints in a Swagger/OpenAPI snapshot) and which endpoints return what. Specifically confirm availability and granularity of: daily summaries, sleep (including stages), HRV, stress (summary vs time series), Body Battery (summary vs time series), heart rate time series, respiration, SpO2, and activities. Also **VERIFY** rate limits and any history depth limits on pulls. Granularity decides what insights are possible, so build a small capability probe first and record the results in `docs/garmin-capabilities.md`.
- Known quirk reported by others: at least one endpoint (weight) returned HTTP 400 even with documented parameters. Handle errors per endpoint and distinguish "no data" from "access denied" from "error".

### Garmin's Stress and Body Battery are black boxes

Garmin does not publish exact formulas. Stress is derived largely from heart rate variability, and Body Battery combines HRV, stress, sleep, and activity. Treat both as **outputs to explain**, and lean on the underlying signals (HRV, heart rate, sleep stages, stress series) wherever the API exposes them. Do not claim to reverse engineer Garmin's algorithm. The goal is: "here is what, in your logged context and raw signals, coincides with this Body Battery drain."

---

## 4. Data model (starting point, refine as needed)

Local database (IndexedDB or SQLite-WASM, see Section 8; the tables below are logical, not tied to a specific engine). Timestamps stored as UTC with the user's timezone recorded, because "8 PM" and "overnight" are local concepts and DST must not corrupt windows.

**Garmin-derived (pulled, cached locally, idempotent upserts):**
- `daily_summary` (date, resting HR, steps, stress summary, body battery high/low/charged/drained, etc.)
- `sleep_session` (start, end, duration, stage minutes, sleep score if present, overnight HRV if present)
- `hrv_reading` (timestamp or night, value, source)
- `stress_sample` / `body_battery_sample` (timestamp, value), if time series are available
- `heart_rate_sample` (timestamp, bpm), if available
- `activity` (start, duration, type, avg/max HR, summary stats)
- `sync_log` (endpoint, range pulled, status, error), so pulls are resumable and auditable

**User-logged (the part Garmin cannot see):**
- `input_type` (id, name, category, unit, default dose, icon, active). Seeded with: caffeine, nicotine, marijuana, alcohol, guitar playing, and user-extensible.
- `input_event` (id, type, timestamp, dose, dose_unit, note, source). One row per logged event. Supports backdating, because I will forget to log in the moment.
- `check_in` (date, energy 1-5, mood 1-5, soreness 1-5, optional note). A 10 second subjective label. **This is high value: it is the ground truth that lets the app learn which watch metrics matter to me.** Backfill is impossible, so this should ship in the very first version.
- `session_rating` (activity id or event id, perceived effort 1-10)

**Derived (recomputable, never the source of truth):**
- `baseline` (metric, window, median, spread, as of date)
- `daily_features` (per-day z-scores and exposure features)
- `insight` (id, created, kind, text, evidence payload, sample size, confidence, status: new/seen/dismissed/tested)

Design rule: derived tables can be dropped and rebuilt from raw tables at any time.

---

## 5. The insight engine

Build as a **pure, well-tested library** (no UI or network dependencies), so it can be tested with synthetic data and reused.

### Layer 1: Personal baselines
- Rolling baseline (default 28 days) per metric using **median and a robust spread** (MAD or IQR), so a single bad week does not distort it.
- Express each day as a deviation from my own baseline (robust z-score or personal percentile).
- Handle sparse data, missing nights, and a cold start (show "still learning, N more days" instead of guessing).

### Layer 2: Exposure windows
For each logged input, define the time windows in which an effect could plausibly show up, relative to the event time:
- Same evening, overnight sleep, next-morning readings, next-day Body Battery and stress, 2-day lag.
- Windows are configurable per input type (caffeine's relevant window differs from guitar practice).

### Layer 3: Effect estimation (n-of-1)
Compare my outcomes on **exposed vs unexposed comparable days**, and report:
- Effect size in my own units (SD from my baseline, minutes of deep sleep, points of Body Battery).
- Sample size, and a consistency measure ("6 of 8 occasions").
- Dose-response where I have varied doses (e.g., 1 vs 3 coffees).
- Timing sensitivity (e.g., caffeine after 2 PM vs before).
- **Confounding awareness:** flag when exposures co-occur (alcohol and marijuana, hard training and caffeine) and refuse to attribute to one when they are collinear. Control for obvious covariates (training load that day, prior-night sleep, day of week) where sample size permits.

Minimum thresholds before any insight is shown (start conservative, e.g. at least 5 exposed and 10 unexposed observations), configurable in one place.

### Layer 4: Explaining Stress and Body Battery
For any day or window where Body Battery drained unusually fast or Stress spiked relative to my baseline:
- List the candidate contributors that coincided (logged inputs, activities, short sleep, late bedtime, low overnight HRV).
- Rank by estimated contribution using the personal effect estimates from Layer 3, with an explicit "unexplained" remainder. Never force an explanation onto everything.
- Output reads as: "Your Body Battery recharged only +34 overnight (your usual is +62). Likely contributors: marijuana at 8 PM (typically costs you ~X on recharge), bedtime 1h 40m later than usual."

### Layer 5: Insight lifecycle
- Insights are generated, deduplicated, and aged out when no longer supported.
- Each carries its evidence (so I can tap through to the underlying days) and a suggested experiment ("skip it for 5 nights and compare").
- I can mark an insight as tested, wrong, or dismissed, and that feedback is stored.

### Later, only if earned
- Learning which watch metrics predict my check-in scores.
- Anomaly detection (illness onset, overreaching) using deviation patterns.
- Any ML model must beat the Layer 3 baseline on held-out data to ship.

---

## 6. Insight copy rules (tone)

- Plain, direct, specific to me. No wellness-app fluff, no scolding, no cheerleading.
- Always include the count and confidence. Example of acceptable: "Seen on 6 of 8 nights." Example of unacceptable: "Marijuana ruins your sleep."
- Substances are neutral data. The app reports effects, it does not judge or advise abstinence.
- Never imply diagnosis. If something looks unusual, say it is unusual relative to my baseline and leave it there.
- Templates live in one file so wording can be tuned without touching logic.

---

## 7. Privacy and security

- All data local to the device by default (browser storage on the phone; consider encrypting sensitive tables such as substance logs, see key handling below).
- **The Garmin key must never appear in source, config files, logs, the repo, or the deployed site.** As a PWA there is no Keychain. Evaluate and recommend between: (a) key entered at runtime and kept in IndexedDB, encrypted with a passphrase via the Web Crypto API (PBKDF2 or Argon2-derived key, AES-GCM) and unlocked per session; (b) a WebAuthn/passkey-gated approach if practical. State plainly what each protects against (casual access, device theft) and what it does not. Treat XSS as the main threat: strict Content Security Policy, no third-party scripts, pinned dependencies. Add secret scanning and a `.gitignore` before the first commit.
- Because browser key storage is lower assurance than a native Keychain, prefer a **short key expiry** and make rotation easy (clear "replace key" flow, expiry warning).
- No analytics, no third-party SDKs that phone home, no cloud sync in v1.
- Substance and health logs are sensitive: provide full **export** (JSON/CSV) and full **delete** from day one.
- If any LLM is later used to phrase insights, only send derived, de-identified summaries, and make it opt-in. v1 uses templates, not an LLM.

---

## 8. Architecture direction

- **Decision made: Progressive Web App (PWA), TypeScript, targeting iPhone Safari ("Add to Home Screen").** I have an iPhone and no desire to deal with Apple signing, the App Store, or a developer fee in v1. Native Swift is a possible later migration, so keep the engine and data model portable (pure TypeScript, no browser APIs inside `engine`).
- **Phone-first, single user, local-first.** No backend in v1 unless Phase 0 proves one is required (see CORS below).
- **Layering:** `garmin-client` (auth, token refresh, pulls, error taxonomy) → `ingest` (normalize, upsert, sync log) → `store` (local database) → `engine` (baselines, windows, effects, explanations) → `ui`.
- The engine and ingest layers must run **without the UI** (Node CLI or tests), so they can be developed and verified on a laptop before any phone work.
- **Storage:** IndexedDB (via a thin wrapper such as Dexie) or SQLite compiled to WASM (e.g. sqlite-wasm with OPFS). Recommend one and justify it. Keep the store behind an interface so it can be swapped.
- **Stack suggestion (justify or replace):** Vite + TypeScript, a light UI framework (React or Svelte), a charting library, Vitest for tests, service worker + web manifest for installability.
- **iOS PWA constraints to design around:**
  - Safari can evict web storage for sites not used for a while. Treat local data as **recoverable, not permanent**: build JSON export/import and a visible "last backup" indicator in the first working version, not at the end.
  - Request persistent storage (`navigator.storage.persist()`) and handle it being denied.
  - No reliable background tasks. v1 pulls on app open and manual refresh only.
  - Installed PWAs have storage separate from Safari tabs. Complete setup (key entry, first sync) **inside the installed app**, not in the browser tab.
  - Web push and other iOS PWA features have quirks. Do not depend on them in v1.
- **Hosting:** static hosting over HTTPS is required for install and service workers (e.g. GitHub Pages, Cloudflare Pages, Netlify). The deployed site contains **no secrets**.
- **CORS risk (gates the architecture):** Garmin's API may not allow direct browser calls. Phase 0 must test this from a real browser origin, not just from Node. If blocked, add the smallest possible stateless proxy (e.g. a Cloudflare Worker) that forwards requests and **stores nothing and logs no tokens**. Keep my key on-device and have the app send it per request, rather than storing it server-side, unless that proves impossible. Flag any such tradeoff to me before implementing.
- Background refresh on a phone is limited and unreliable. v1 should pull on app open and on manual refresh, and not depend on background jobs.

---

## 9. Suggested phases (propose your own plan, but justify any deviation)

**Phase 0: Capability probe (Node CLI, then a browser page).** Authenticate with the personal key, handle token refresh, call each relevant endpoint, and document exactly what data is available at what granularity. Then repeat the auth and one data call **from a real browser origin** (a minimal static page, ideally opened in iPhone Safari) to settle the CORS question. Output: `docs/garmin-capabilities.md`, including a clear verdict on whether a proxy is needed. This gates everything else.

**Phase 1: Ingest and store.** Idempotent pulls into the local store with a sync log, JSON export/import from the start, backfill of as much history as the API allows, tests with recorded API fixtures.

**Phase 2: Baselines (CLI).** Personal baselines and daily deviations for HRV, resting HR, sleep, stress, Body Battery. Printed report: "today vs you."

**Phase 3: Logging.** Input types, event logging (with backdating), daily check-in. Ship the check-in early because labels cannot be backfilled.

**Phase 4: Effect engine.** Exposure windows, exposed-vs-unexposed estimation, confidence and thresholds, confounding flags. Validate on **synthetic data with planted effects** (e.g., inject a known HRV drop after a fake exposure and confirm the engine recovers it and does not hallucinate effects in pure noise).

**Phase 5: Explanations.** Body Battery and Stress explanation layer, insight templates, insight lifecycle.

**Phase 6: PWA UI.** Installable on iPhone (manifest, service worker, offline shell). Today view, quick-log, insight feed with tap-through evidence, trend charts, key-expiry warning, backup/export/delete. Test in the installed app on a real iPhone, not only in desktop browsers.

**Phase 7: Polish and portfolio.** README, architecture doc, screenshots, test coverage report.

---

## 10. Testing and quality bar

- Unit tests for every engine function. Property tests where useful (e.g., baseline is invariant to input ordering, insufficient data never yields an insight).
- **Synthetic-data validation is mandatory** for the effect engine: planted effects must be recovered, and null data must produce no insights (track the false positive rate).
- Recorded-fixture tests for the Garmin client so tests never hit the live API.
- Timezone and DST tests for every window calculation.
- CI running tests and secret scanning on every commit.

---

## 11. Non-goals for v1

- Multi-user support, accounts, or sharing.
- Cloud sync or a hosted backend.
- Writing anything back to Garmin.
- Medical claims, diagnosis, or treatment suggestions.
- Replicating Garmin's proprietary scores or competing with Whoop feature for feature.
- Deep learning.

---

## 12. Open questions for Claude Code to ask me before planning

1. Do I have a laptop and a place to host a static site (GitHub Pages, Cloudflare Pages, Netlify)? What iOS version is my iPhone on? (PWA features depend on it.)
2. Which watch model? (Metric availability varies by device.)
3. How much history exists in my Garmin account, and how far back does the API let me pull?
4. Which inputs do I want seeded at launch beyond caffeine, nicotine, marijuana, alcohol, and guitar?
5. How do I want to log nicotine and marijuana (event count, amount, method)? Dose granularity affects what the engine can learn.
6. What is my timeline and how many hours a week can I put in? (Affects how aggressively to cut scope.)

---

## 13. Working agreements for Claude Code

- Start with Phase 0. Do not build UI before the capability probe has been documented.
- Propose a plan and wait for my approval before large implementation steps.
- Keep the engine pure and tested. If a design choice trades correctness for speed, say so explicitly.
- Never print, log, or commit the Garmin key or access tokens. If you see one in output, stop and tell me.
- When Garmin's docs and observed behavior disagree, trust observed behavior, record it in `docs/garmin-capabilities.md`, and flag it.
- Prefer boring, well-supported libraries. Justify any dependency that is not obviously necessary.
- Tell me when a requested insight is not supportable by the data we actually have, rather than approximating it.
