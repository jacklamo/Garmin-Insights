# Domain Pitfalls

**Domain:** Single-user iPhone PWA joining Garmin Personal API data with self-logs, using n-of-1 statistics
**Researched:** 2026-10-28
**Overall confidence:** MEDIUM. Statistical pitfalls are HIGH (well-established methodology). Garmin Personal API and iOS 26 storage specifics are LOW to MEDIUM: written from training knowledge plus the brief, with no live docs or device check. Every item tagged VERIFY must be confirmed in Phase 0 or on a real device.

Phase names follow the brief: 0 Probe, 1 Ingest/Store, 2 Baselines, 3 Logging, 4 Effect engine, 5 Explanations, 6 PWA UI, 7 Polish.

---

## Critical Pitfalls

### 1. Treating "not logged" as "not exposed"
**What goes wrong:** Unexposed days are defined as days with no event row. Forgotten logs (the brief admits "I will forget") put exposed days in the control group, which shrinks and biases every effect toward zero or toward noise.
**Why it happens:** The absence of a row is ambiguous. Logging is voluntary and decays over weeks.
**Consequences:** Wrong effects with confident numbers, and a worse problem: effects appear only in the stretches when logging was diligent.
**Prevention:**
- Add a per-day "log complete" marker, set by an explicit "nothing else today" tap or by the daily check-in. Only completed days enter the unexposed pool.
- Show a logging-completeness metric in the UI and in the evidence payload.
- Treat days with no check-in and no events as "unknown", not "unexposed".
**Detection:** The unexposed pool is much larger than the count of check-in days. Effects change sharply when you restrict to check-in days.
**Phase:** 3 (the marker in the data model), 4 (the engine uses it).

### 2. Multiple comparisons: the engine will find "insights" in pure noise
**What goes wrong:** About 7 inputs x 5+ outcomes x 4-5 windows x lags x dose/timing splits gives hundreds of tests. With 5 exposed days and 10 unexposed, some will look dramatic by chance. The "start at 5/10" threshold is far too weak as the only gate.
**Why it happens:** Per-test thresholds ignore the size of the whole search. Small n makes the largest observed effects the most inflated (winner's curse).
**Consequences:** The feed fills with plausible-sounding false claims. The user changes behavior based on them and loses trust when they fail.
**Prevention:**
- Define the test family explicitly (input x outcome x window) and apply FDR control (Benjamini-Hochberg) across the whole family each run.
- Use permutation or randomization tests, not t-tests, at n < 30.
- Require an effect-size floor in the user's own units (for example >= 0.5 robust SD) as well as significance.
- Add a replication gate: the effect must hold in both halves of the data, or in most leave-one-out folds.
- Use tiers: "not enough data", "possible pattern" (labelled as such), "consistent pattern". Raise the real threshold for "consistent" to roughly 10+ exposed and 20+ unexposed.
- Shrink small-n estimates toward zero.
**Detection:** The null-data false-positive rate in CI is above the target (for example 5% of runs yield any insight). The number of insights grows when you add input types.
**Phase:** 4. Make "null data yields zero insights" a CI gate with many seeds.

### 3. Synthetic null validation that is too easy
**What goes wrong:** The engine is tested on iid Gaussian noise and passes. Real data is autocorrelated (HRV and resting HR drift for days), seasonal (weekday/weekend), has missing nights, and has non-Gaussian discrete values.
**Why it happens:** iid noise is the easiest generator to write.
**Consequences:** A false sense of safety. Real data produces false positives the CI never saw.
**Prevention:**
- The generator needs AR(1) noise with realistic phi (about 0.3-0.7), a weekly cycle, missing days that are not random (no wear, charging), and integer-valued metrics.
- Use block permutation (blocks of 3-7 days) so autocorrelation is respected.
- Plant effects at realistic sizes (0.3-1 SD) and report power as well as false-positive rate.
- Also run the engine on real data with exposure labels shuffled. This should yield nothing.
**Detection:** Real-data shuffled-label runs produce insights.
**Phase:** 4.

### 4. Off-by-one day alignment (sleep date vs. evening log vs. "overnight")
**What goes wrong:** Garmin attributes a sleep session to the wake-up calendar date. A 9 PM Tuesday event belongs to the sleep dated Wednesday. Events logged after midnight (1 AM caffeine, late marijuana) land on the wrong calendar day. Resting HR, Body Battery, and stress are dated by calendar day, with different cutoffs.
**Why it happens:** Mixing calendar-date keys with event timestamps.
**Consequences:** Effects attach to the wrong night. They are systematically attenuated or reversed, and no test flags it.
**Prevention:**
- Define one "logical day" (for example 04:00 local to 04:00) and one rule, in one module, for mapping each outcome and each event to it.
- Build windows from timestamps (event time to sleep start/end) rather than date joins wherever Garmin supplies timestamps.
- Test with fixtures of a late-night event, a nap, and a sleep that straddles midnight.
**Detection:** A planted "evening exposure -> overnight HRV" effect is recovered only on the wrong lag.
**Phase:** 1 (ingest normalization), 2, 4.

### 5. Timezone and DST corrupting windows
**What goes wrong:** Windows are computed as "event + N hours" or as fixed UTC offsets. Windows like "8 PM to bedtime" or "after 2 PM" are local concepts. On DST days the night is 23 or 25 hours long. Travel changes the offset. Garmin may return both local and GMT timestamps, and mixing them shifts data by hours.
**Why it happens:** Storing only UTC (the brief says store UTC plus tz) but computing in the device's current zone. Today is 2026-10-28, so the 2026 DST fall-back (US: Nov 1) falls inside the first weeks of real data.
**Consequences:** Wrong windows near DST changes, and wrong "after 2 PM" splits. Backdated events logged in a different zone are misplaced.
**Prevention:**
- Store the IANA zone per event and per ingested day (not just an offset).
- Use one date/time library for all window math (Temporal polyfill, Luxon, or date-fns-tz) and never `new Date(y,m,d)` arithmetic in the engine.
- Tests: spring-forward, fall-back, cross-zone travel, and an event at 01:30 on a fall-back night (ambiguous time).
- Record in `garmin-capabilities.md` which Garmin timestamp fields are local and which are GMT.
**Detection:** Sleep or window durations of 0, 23, or 25 hours. Events landing in the wrong logical day around Nov 1.
**Phase:** 1 and 4 (a test suite in each).

### 6. Collinear and co-occurring exposures attributed to one cause
**What goes wrong:** Alcohol and marijuana, caffeine and hard training, late screen time and late meals tend to happen together. A pairwise exposed-vs-unexposed comparison credits whichever is logged more reliably. The Layer 4 "ranked contributors" then splits credit on top of this.
**Why it happens:** Univariate comparisons ignore overlap. Small n rules out multivariable regression.
**Consequences:** Confident but wrong single-cause claims, and the app "explains" Body Battery drains with the wrong contributor.
**Prevention:**
- Compute the co-occurrence matrix (phi or Jaccard) for every input pair. Above a threshold, refuse single attribution and say "co-occurs with X on N of M days".
- Estimate "exposed alone" against "exposed with others" when counts allow. Otherwise report "can't separate".
- Control for covariates only if n >= about 10-15 per covariate, with a ridge penalty. Otherwise do not pretend to control.
- Layer 4 ranking only uses effects that already passed the Layer 3 gates, and always keeps an "unexplained" remainder.
**Detection:** Two inputs share nearly identical effect estimates. The effect vanishes when the other input's days are excluded.
**Phase:** 4 (flags), 5 (ranking must respect them).

### 7. Garmin's metrics are not independent outcomes (circular outcome variables)
**What goes wrong:** Garmin Stress is derived from HRV and heart rate, and Body Battery from HRV, stress, sleep, and activity. If HRV, stress, Body Battery, and resting HR are all tested as separate outcomes, one physiological effect becomes 3-4 "insights", and the multiple-comparison family is miscounted.
**Why it happens:** Treating each API field as a separate measurement.
**Consequences:** Duplicate insights, a false sense of corroboration ("four metrics agree!"), and "explaining" Body Battery with HRV that Body Battery already includes.
**Prevention:**
- Pick a small primary outcome set (overnight HRV, resting HR, deep+REM minutes or sleep efficiency, check-in scores) and treat Garmin composites as derived views.
- Dedupe insights by input x window and merge correlated outcomes into one card.
- Layer 4 should state that Body Battery contains these signals. Never present agreement between derived metrics as independent confirmation.
**Detection:** Several insights with the same input and window and different outcomes.
**Phase:** 4 and 5.

### 8. Rolling baseline contaminated by the exposures being studied
**What goes wrong:** A 28-day median that includes exposed days pulls the baseline toward the effect (attenuation). If the user drinks frequently, "baseline" is the drinking baseline. A centered window leaks future data.
**Why it happens:** Convenience: one baseline per metric for all uses.
**Consequences:** Effects underestimated, and cold-start z-scores are unstable.
**Prevention:**
- Compute baselines from trailing data only (no look-ahead), and for effect estimation, use a baseline that excludes the exposure windows of the input under test (or compare raw exposed vs unexposed values with day-of-week adjustment).
- Guard MAD = 0 (integer resting HR, repeated values): floor the spread, or fall back to IQR or SD.
- Flag illness and travel periods, which wreck baselines (a Garmin-flagged illness is not available, so let the user mark "off" days via the check-in).
**Detection:** Property test: the baseline of a series with a constant offset in exposed days is not attenuated more than N%.
**Phase:** 2 (trailing, MAD guard), 4 (exclusion).

### 9. Browser key storage: false sense of security and the GitHub Pages shared origin
**What goes wrong:**
- Passphrase-encrypted IndexedDB (PBKDF2 + AES-GCM) only protects against casual or at-rest access. It does not protect against XSS, which can read the key once unlocked, or against a weak passphrase.
- **GitHub Pages `user.github.io/repo` shares one origin with every other repo site under that account.** IndexedDB and localStorage are origin-scoped, so any XSS or careless script in a sibling project can read this app's data. CSP set by `<meta>` cannot cover that.
- A strict CSP on GitHub Pages can only be set via `<meta http-equiv>`, which lacks `frame-ancestors` and report-only. Check what is enforceable.
- Per-launch unlock is friction on iOS, since the PWA is killed often. The user will want to skip it, and the shortcut becomes plaintext storage.
- Access tokens (24h) written to storage or logged by the service worker, error reporters, or `console.log`.
**Prevention:**
- Use a project-dedicated origin: a custom domain or its own Pages user/org site (`name.github.io` root), or Cloudflare Pages. Decide this in Phase 0 before any data exists, because origin changes strand IndexedDB.
- Hold the decrypted key and tokens in memory only. Store only the ciphertext.
- Use a high PBKDF2 iteration count (>= 600k) or Argon2 via WASM (an added dependency, so justify it). Offer an optional WebAuthn/passkey gate, but VERIFY PRF extension support on iOS 26 Safari before relying on it.
- Service worker: cache only the static shell. Never cache API responses or add auth headers in it.
- Ship secret scanning and `.gitignore` before the first commit, and add a log-redaction helper used by all logging.
- Document threat model in plain terms: protects against lost-unlocked-phone casual access and repo leaks, not XSS or a compromised device.
**Detection:** Grep of build output and a fixture dump for the key pattern. Pages deployment from an origin shared with other sites.
**Phase:** 0 (origin decision, since it is irreversible), 6 (storage and CSP implementation).

### 10. iOS PWA storage eviction and non-persistent storage
**What goes wrong:** The user treats IndexedDB as permanent and loses months of subjective logs and check-ins, which cannot be backfilled. Garmin data can be re-pulled, but logs cannot.
**Facts and uncertainty:**
- Safari tabs: ITP caps script-writable storage at 7 days of no interaction. Home-screen web apps are generally exempt from that cap. (MEDIUM, VERIFY on iOS 26.)
- Storage can still be cleared under disk pressure or when the app is deleted. Removing the home-screen icon deletes its data.
- `navigator.storage.persist()` exists in recent Safari but may resolve false or ask nothing. Never assume it is granted. (MEDIUM, VERIFY.)
- Installed PWA storage is separate from Safari tab storage. Anything entered in the tab (key, first sync) does not carry into the installed app.
**Prevention:**
- JSON export/import and a visible "last backup" age in the first working version (already planned). Make the warning escalate: nag after 7 days, and after any session where new logs exist and the last backup is older than N days.
- Use the iOS share sheet / `navigator.share` with a file, or download to Files, for the export. Test that it works from the installed app (blob download behavior in standalone mode is quirky: VERIFY).
- Request `persist()` on first run, display the result, and handle denial.
- On startup, detect "empty store but last-backup marker or service-worker cache says data existed" and offer restore, not silent re-init. Keep the marker somewhere other than the store being protected (for example CacheStorage), noting that it is also evictable.
- Put setup and first sync inside the installed app (documented in the onboarding screen).
- Verify that import round-trips losslessly (schema version field, migration path, test of export -> wipe -> import equality).
**Detection:** Empty DB after a week of inactivity on a real iPhone. Run a test on the actual device and leave it idle.
**Phase:** 1 (export/import), 6 (persist, restore prompt, share sheet).

### 11. Garmin Personal API assumptions (CORS, tokens, endpoints, data revision)
Confidence: LOW. Nothing here was verified against live docs. Phase 0 exists to settle it.
**What goes wrong:**
- **CORS:** Server APIs of this kind often send no `Access-Control-Allow-Origin`, or fail the preflight for an `Authorization` header. A Node probe passes while the browser fails. Also test `OPTIONS` handling, since a custom header makes the call non-simple.
- **Token exchange from the browser:** if the key-for-token exchange is the blocked step, a proxy is needed for it only. The proxy then sees the key in transit, so require it to be stateless and have no logging. Flag the tradeoff to the user, as the brief says.
- **Key expiry:** the API may not report the key's expiry date, so the app has to store the user-entered expiry. Silent 401/403 after expiry must be distinguishable from a transient token expiry (24h): refresh once, and if it still fails, show "key expired or revoked".
- **Concurrent refresh:** several parallel pulls each refreshing the token at once. Use a single in-flight refresh promise.
- **Error taxonomy:** a 400 (weight reportedly) means "broken endpoint", 403 means "not authorized for this scope", 204/empty means "no data". Do not collapse them, or sparse-data gaps look like failures and failures look like gaps.
- **Late and revised data:** the watch syncs to phone to Garmin cloud on a delay. Today's and last night's data are incomplete or revised (sleep scores, HRV, Body Battery). A pure "insert if absent" ingest freezes partial values. Upsert by natural key with overwrite, and always re-pull a trailing window (for example the last 3 days). Store `fetched_at`.
- **Rate limits and history depth:** unknown. Chunk backfill by date range, back off on 429, make it resumable via the sync log, and record the limits in the capabilities doc.
- **Doc/behavior mismatch:** trust observed behavior (brief rule). Record fixtures from real responses and scrub secrets and PII before committing them.
**Prevention:** Phase 0 matrix of endpoint x (status, shape, granularity, date range, timestamps local/GMT). Browser test on the actual iPhone from the final candidate origin.
**Detection:** Works in Node CLI, fails in Safari.
**Phase:** 0 (mandatory), 1 (taxonomy, revision handling).

### 12. Assuming vivoactive 5 exposes the metrics the engine wants
**What goes wrong:** The design assumes HRV time series, stress and Body Battery samples, per-stage sleep, and SpO2/respiration. The vivoactive 5 is a mid-range watch. It records Body Battery, stress, sleep stages, respiration, and Pulse Ox, and as I recall offers HRV status. It lacks some features of Forerunner/Fenix lines (training readiness, some advanced recovery metrics). (LOW to MEDIUM: VERIFY on the account and through the API.)
**Specifics to check:**
- Overnight HRV is typically a nightly average plus 5-minute readings, not a continuous series. Daytime HRV is generally absent.
- Stress and Body Battery are sampled at coarse intervals (minutes), and the stress series has special values for "resting/unmeasurable during activity" (negative values), which must not enter baselines as numbers.
- Stages are the wrist-based estimate and noisy (light/deep/REM minute errors of tens of minutes). A "22 min short deep sleep" claim exceeds the measurement precision. Express stage effects with caution or lean on HRV and resting HR.
- Which metrics are present on what fraction of nights. The user has worn it only since mid-summer 2026, so about 100 days at most, and the first weeks are the watch's own calibration period.
- Nights with no wear (charging) must be missing, not zero.
**Prevention:** The Phase 0 capability matrix includes per-metric nightly coverage in the real account. Cut any insight type whose input is unavailable or too coarse, and say so (brief: "tell me when it is not supportable"). Normalize sentinel values at ingest.
**Detection:** Many null fields in the fixtures. Z-scores with a spike at values like -1 or -2.
**Phase:** 0, 1.

### 13. Cold start and sparse data presented as insight
**What goes wrong:** With roughly 100 days of history and a logger who has just started, each input has a handful of events. The UI shows numbers anyway, or baselines computed over 5 days look authoritative.
**Prevention:**
- Baseline needs a minimum valid-day count (for example >= 14 of the trailing 28) and shows "still learning, N more days" below it.
- The number of days needed per input to reach the "possible pattern" tier is shown ("caffeine: 3 of 5 exposed days needed").
- Do not backfill assumed logs. Start the n-of-1 clock at the first completed log day (see Pitfall 1).
- Seed the check-in on day one since subjective labels cannot be backfilled.
- Prefer a Today view and "today vs you" that is useful with zero insights. Do not let the empty insight feed make the app look broken.
- Show effect uncertainty (interval) whenever n < 20.
**Detection:** Insights appear in the first week of logging.
**Phase:** 2, 3, 4, 6.

---

## Moderate Pitfalls

### Autocorrelation and carryover ignored
**What goes wrong:** Day t+1 depends on day t, and exposure effects can carry over 1-2 days. "Unexposed" days right after an exposure are contaminated.
**Prevention:** Define unexposed as no exposure in the prior window (washout, per-input configurable). Use block permutation. Count lagged windows as part of the test family.
**Phase:** 4.

### Regression to the mean and behavioral selection
**What goes wrong:** The user uses substances on stressed days (reverse causation), or tracks a "bad" metric after a bad day. The measured "effect" is the cause, not the consequence.
**Prevention:** Only use outcomes measured strictly after the exposure window. Include a "pre-exposure" check: does the metric already look low before the event? Hedged copy ("coincided with", per the brief). Suggested experiments (skip it for 5 nights) are the only real causal test, so surface the result of "tested" insights.
**Phase:** 4, 5.

### Experiment feedback is biased
**What goes wrong:** The user knows the hypothesis when running "skip for 5 nights", so expectation and changed habits (earlier bed) confound the result. Five nights is underpowered.
**Prevention:** Tell the user the n. Compare against the full unexposed history and state that it's suggestive. Do not auto-mark insights "wrong" from one experiment.
**Phase:** 5.

### Dose-response with event-count-only logging
**What goes wrong:** Nicotine and marijuana have only a count, so "dose-response" is count-of-events, not amount. Timestamps are reliable only if backdated carefully.
**Prevention:** Label such results as "number of times", never "amount". Do not run dose-response for those inputs unless counts vary across >= 3 levels with enough days each. Keep schema room for dose later.
**Phase:** 3, 4.

### Wrist-sensor artifacts treated as physiology
**What goes wrong:** Alcohol, late meals, and exercise are real effects, but so are loose-strap nights, naps, partial wear, and workouts classified as stress. Garmin's day boundaries differ across metrics.
**Prevention:** Minimum wear coverage per night for inclusion. Exclude or flag days with wear gaps, naps, and sleep < 3 h. Show the exclusion count in the evidence.
**Phase:** 2, 4.

### Service worker caching and PWA install gotchas on a subpath
**What goes wrong:** Aggressive caching serves old code after a deploy (the user cannot hard-refresh an installed PWA). Wrong `scope`/`start_url` under `/repo/` breaks installability and offline. iOS needs `apple-touch-icon`, and manifest behavior differs from Android.
**Prevention:** Versioned precache (Workbox or Vite PWA plugin), an "update available, reload" prompt, a skipWaiting policy that doesn't break an open session, and relative base path config. Test an offline launch in airplane mode on the device. Changing hosting origin later strands data (see Pitfall 9).
**Phase:** 6.

### Schema and migration debt in the store
**What goes wrong:** IndexedDB versions are hard to downgrade, and derived tables mixed with raw ones make export bloated and migrations scary.
**Prevention:** Raw tables carry a schema version and are the only things exported. Derived tables are rebuilt on version bump. Keep the store behind the interface. Migration tests with older export fixtures.
**Phase:** 1.

### Sensitive data leaking into fixtures, exports, and the repo
**What goes wrong:** Recorded API fixtures contain real health data and possibly user IDs. Exports contain substance logs. The repo is public (portfolio).
**Prevention:** Scrub-and-synthesize script for fixtures, a secret and PII scan in CI, and a `.gitignore` for exports. Public screenshots use synthetic data.
**Phase:** 0, 1, 7.

### Scope creep against ~10 hrs/week
**What goes wrong:** Layer 4 explanations, lifecycle, and charts are built before the data proves the engine can find anything. 100 days of data may support only a few robust insights.
**Prevention:** Gate Phase 5 on Phase 4 recovering planted effects and finding at least one plausible real signal. Keep the CLI report (Phase 2) useful by itself.
**Phase:** roadmap.

---

## Minor Pitfalls

### Floating-point or median of tiny arrays
Use deterministic stat functions with tests for even/odd counts and ties. Seed all random permutations so CI is reproducible.

### Wording drifting into claims
Templates in one file, with a lint test that every insight string contains a count and no forbidden words ("causes", "ruins", "should"). Keeps the medical-claims out-of-scope rule enforceable.

### Date-only inputs from `<input type=date>` and iOS keyboards
Backdating UI must show the interpreted local date and time and the zone. Quick log under 10 seconds is lost if backdating takes five taps: put "just now / earlier today / last night" presets first.

### Pull on open is slow
Cold sync of several endpoints on a phone blocks the Today view. Render from the cache first, sync in the background, and show a "last synced" time.

### Dev environment divergence
Windows dev with Node CLI and an iOS runtime: use CRLF-safe fixtures, avoid Node-only APIs in the engine, and run engine tests in plain Node and in the browser build.

---

## Phase-Specific Warnings

| Phase | Likely Pitfall | Mitigation |
|-------|---------------|------------|
| 0 Probe | Node works, browser CORS fails; hosting origin chosen too late; metric coverage assumed | Test from real iPhone Safari on the candidate origin; decide origin now; per-metric nightly coverage table |
| 1 Ingest | Frozen partial data; error classes merged; tz fields mixed; fixtures leak PII | Overwrite upsert plus trailing re-pull; taxonomy; normalize to IANA zone; scrub fixtures |
| 2 Baselines | MAD=0, sentinel values, contaminated or look-ahead baseline, too-early z-scores | Floor/IQR fallback; sentinels to null; trailing windows; min valid days |
| 3 Logging | "Not logged" vs "not exposed"; logical-day cutoff; slow backdating | Day-complete marker; 04:00 cutoff rule; presets; check-in on day one |
| 4 Engine | Multiple comparisons, autocorrelation, collinearity, circular outcomes | FDR, permutation/block tests, co-occurrence refusal, primary outcome set, AR(1) null CI gate |
| 5 Explanations | Ranking collinear causes; forced explanation; biased experiments | Only gated effects; mandatory "unexplained"; hedged copy; copy-lint test |
| 6 PWA UI | Eviction, shared origin, SW stale cache, key handling, share-sheet export | persist() plus backup nag, restore prompt, memory-only key, shell-only SW, device test |
| 7 Polish | Real data in screenshots or fixtures | Synthetic data only; CI secret/PII scan |

## Sources

- Project brief: `docs/insights-context.md` and `.planning/PROJECT.md` (HIGH for stated constraints)
- Statistical methodology (n-of-1 designs, Benjamini-Hochberg FDR, permutation tests, autocorrelation): established practice, training knowledge (HIGH)
- WebKit storage policy (ITP 7-day cap, home-screen app exemption, `storage.persist()`): training knowledge, not re-checked against iOS 26 (MEDIUM, VERIFY on device; see webkit.org "Updates to Storage Policy")
- Garmin Personal API behavior, vivoactive 5 metric availability, WebAuthn PRF on iOS: training knowledge only (LOW, VERIFY in Phase 0)
- No Context7 or web verification was performed in this pass.
