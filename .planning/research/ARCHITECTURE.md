# Architecture Research

**Domain:** Local-first single-user health-analytics PWA (wearable data + self-logging + n-of-1 inference)
**Researched:** 2026-10-28
**Confidence:** MEDIUM (structure/patterns HIGH from established practice; Garmin API specifics LOW until Phase 0 probe)

## Standard Architecture

### System Overview

```
 Node CLI (probe, ingest, report)          Browser PWA (Vite)
        │                                        │
        └──────────────┬─────────────────────────┘
                       ▼  (both are thin "shells": wiring + I/O only)
┌──────────────────────────────────────────────────────────────┐
│ apps/web (ui)        apps/cli                                │
└───────┬──────────────────┬───────────────────────────────────┘
        │ reads/writes      │
        ▼                   ▼
┌──────────────┐   ┌────────────────┐        ┌───────────────┐
│ ingest       │──▶│ store (iface)  │◀───────│ engine (pure) │
│ normalize,   │   │ + adapters:    │ reads  │ takes plain   │
│ upsert, sync │   │  memory, Dexie │ via    │ arrays, returns│
│ log          │   │  (IndexedDB)   │ shell  │ plain objects │
└──────▲───────┘   └────────────────┘        └───────────────┘
       │ raw DTOs
┌──────┴───────┐   injected fetch + clock + key provider
│ garmin-client│──────────────▶ Garmin (direct, or via optional
└──────────────┘                 stateless CORS proxy)
```

Dependency rule (enforce with lint/`tsconfig` project references): `engine` and `core-types` import nothing but each other. `garmin-client` imports only types. `ingest` imports client + store interface + types. `store` imports types. `ui`/`cli` import everything. Nothing imports `ui`.

### Component Responsibilities

| Component | Responsibility | Implementation |
|-----------|----------------|----------------|
| `core` (types) | Domain types (DailySummary, SleepSession, InputEvent, CheckIn, Insight), branded `UtcMs`, `LocalDate`, `ZoneId`; zod schemas for trust-boundary validation | Plain TS + zod |
| `garmin-client` | Token exchange, in-memory token cache, per-endpoint pull functions, error taxonomy (`NoData` / `AccessDenied` / `RateLimited` / `Error`), returns raw-validated DTOs | Injected `fetch`, injected `now()`, injected `getApiKey()`; no storage |
| `ingest` | DTO → domain normalization (incl. local-date derivation), idempotent upsert, `sync_log`, resumable backfill by date range | Pure mapping fns + orchestrator taking client + store |
| `store` | `Store` interface (raw tables, user-logged tables, derived tables, export/import, wipe) + adapters | `MemoryStore` (tests/CLI), `DexieStore` (browser); optional `FileStore` JSON for CLI |
| `engine` | Baselines, exposure windows, effect estimation, explanations, insight lifecycle diffing, templates | Pure functions: `(data, config, tz) => result`; no I/O, no `Date.now()`, no `Intl` global state |
| `secrets` (web only) | Passphrase-encrypted key vault (WebCrypto PBKDF2 → AES-GCM) in IndexedDB | Lives in `apps/web`, exposes `getApiKey()` to the client |
| `apps/cli` | Phase 0 probe, ingest runner, "today vs you" report; key from env var / prompt | Node 22+, tsx |
| `apps/web` | Today, quick-log, feed, charts, backup/export/delete, expiry warning, SW | Vite + chosen UI framework |
| `proxy` (optional) | Stateless forwarder; only built if CORS verdict = blocked | ~30-line Cloudflare Worker |

## Recommended Project Structure

pnpm workspaces monorepo (boring, strict, fast; npm workspaces also fine). One `tsconfig.base.json`, TS project references, Vitest at root with workspace projects.

```
insights/
├── packages/
│   ├── core/            # types, zod schemas, time helpers' types (no deps beyond zod)
│   ├── garmin-client/   # + test/fixtures/*.json (recorded, scrubbed)
│   ├── ingest/
│   ├── store/           # interface.ts, memory.ts, dexie.ts, export.ts, conformance.test.ts
│   └── engine/          # baselines/, windows/, effects/, explain/, insights/, templates.ts, config.ts, synth/
├── apps/
│   ├── cli/             # probe, sync, report
│   ├── web/             # PWA
│   └── proxy/           # only if needed
├── docs/                # garmin-capabilities.md, architecture.md
├── .github/workflows/   # test + gitleaks
└── .gitignore, .env.example (no real values)
```

Rationale: packages are separately testable and the dependency rule is mechanically enforced. Do not publish packages; this is purely for boundaries. Keep `synth/` (seeded-PRNG synthetic data generator with planted effects) inside `engine` as a dev export so it ships with the tests that need it.

## Architectural Patterns

### Pattern 1: Functional core, imperative shell
Engine = pure functions over plain arrays. The shell (CLI/web) loads from `Store`, calls engine, persists derived output. Time is always an argument (`asOf: LocalDate`, `tz: ZoneId`), randomness (permutation tests/bootstrap) takes a seeded PRNG argument. Result: deterministic tests, Swift-portable logic.

### Pattern 2: Store interface, narrow and range-oriented
```ts
interface Store {
  upsert<T extends TableName>(t: T, rows: Row<T>[]): Promise<void>;   // keyed by natural key => idempotent
  range<T extends TableName>(t: T, fromLocalDate: string, toLocalDate: string): Promise<Row<T>[]>;
  put/delete for input_event, check_in, input_type, insight (user-mutable)
  replaceDerived(t: DerivedTable, rows): Promise<void>;  // drop+rebuild
  exportAll(): Promise<ExportBundle>;   // versioned JSON, schemaVersion field
  importAll(b: ExportBundle, mode: 'replace'|'merge'): Promise<void>;
  wipe(): Promise<void>;
}
```
Natural keys: `daily_summary`=(localDate), `sleep_session`=(garminId or start), `*_sample`=(metric, tsUtc), `activity`=(garminId). Run one shared **conformance test suite** against every adapter. Expose only date-range reads; the engine needs windows of days, not arbitrary queries. Export/import lives at the interface level so the JSON backup is adapter-independent.

### Pattern 3: Time model (timezone/DST)
- Store instants as `tsUtc` (epoch ms) **and** record `tzId` (IANA) per record where the source gives it (Garmin usually supplies local offset / GMT-and-local pairs; verify in probe). User-logged events store `tsUtc` + `tzId` of the device at log time.
- Derive and persist `localDate` (YYYY-MM-DD) at ingest/log time using that record's own tz, so travel and DST do not retroactively shift a day. Never recompute from the current device tz.
- Sleep belongs to the **wake-up date** (the "night of" convention); define once in `core` and document it.
- All window math ("same evening", "overnight", "next morning", "+2 days") is done in **local wall-clock then converted to UTC**, via a single `windowsFor(event, tz)` helper. Use `Temporal` polyfill (`@js-temporal/polyfill`) or `date-fns-tz`/Luxon inside the engine only through one adapter module, so the choice is swappable. Recommend Luxon or Temporal polyfill for correct handling of ambiguous/nonexistent local times (spring-forward gap, fall-back repeated hour). Rule: "evening 6 PM–midnight" on a 23/25-hour day is defined by wall-clock bounds, not by adding 24h*n ms.
- Required tests: spring-forward and fall-back nights (e.g. America/New_York, plus a non-US zone like Europe/London and a half-hour-offset zone), event logged at 1:30 AM in the repeated hour, travel across tz mid-week, midnight-straddling sleep, backdated events.

### Pattern 4: Derived data is a cache
`baseline`, `daily_features`, `insight` (except user feedback status) can be dropped and rebuilt. Keep user feedback (dismissed/tested/wrong) in a separate small table keyed by insight dedupe key so rebuilds don't lose it. Recompute on app open after sync (data is small: months of daily rows; no workers needed in v1 unless sample series make it slow).

### Pattern 5: n-of-1 effect estimation design
Unit of analysis = **day (or night)**, one row per `localDate` in `daily_features`: outcome values (e.g. overnight HRV, deep-sleep min, BB recharge, next-day stress) plus exposure flags/doses per input and covariates (prior-night sleep, training load, day-of-week, trailing baseline z).

Pipeline per (input, outcome, window):
1. Build exposure indicator per day from events through `windowsFor`.
2. Outcome as deviation from **trailing** baseline (computed using only data prior to that day, to avoid leakage; use robust z). This detrends slow drift.
3. Comparable-day filter: exclude unexposed days that are contaminated by another exposure in the same window (co-exposure) unless modelled; exclude days with missing outcome.
4. Effect = difference in medians (or means of robust z) exposed minus unexposed, in native units and in SD. Uncertainty by **permutation test and/or bootstrap CI** with seeded PRNG (distribution-free, fits tiny n). Optionally Hodges-Lehmann or Mann-Whitney p as secondary. Avoid parametric-only claims.
5. Consistency = fraction of exposed occasions with effect in the same direction vs. baseline ("6 of 8").
6. Dose-response: Spearman rank correlation between dose and outcome among exposed days; only if ≥3 distinct dose levels. Event-count-only inputs (nicotine, marijuana) get `doseResponse: unavailable`.
7. Timing sensitivity: split exposed by event hour bucket (e.g. caffeine before/after 14:00), report only if each bucket meets threshold.
8. Covariate adjustment: small OLS/stratified comparison only when n allows (config: ≥ ~10 observations per covariate); otherwise stratify (e.g. same day-of-week type) or just flag.
9. Confounding: compute co-occurrence between exposures across days (phi/Jaccard); if above threshold (config), emit `confounded` flag and withhold attribution to either.
10. Multiple comparisons: many (input × outcome × window) tests inflate false positives. Apply FDR (Benjamini–Hochberg) over the set tested, plus effect-size floor, plus thresholds (≥5 exposed, ≥10 unexposed). Track false-positive rate via synthetic nulls in CI (e.g. 200 seeded null datasets, assert FP rate under a stated bound).
11. Output `EffectEstimate { input, outcome, window, effect, unit, sd, ci, nExposed, nUnexposed, consistency, doseResponse?, timing?, flags[], confidence }` where confidence is a deterministic function of n, CI width and flags (low/medium/high), defined in config.

All thresholds in a single `config.ts` (`minExposed`, `minUnexposed`, `fdrQ`, `minEffectSd`, `confoundJaccard`, baseline window 28d, etc.).

### Pattern 6: Explanation layer (Layer 4)
Input: a flagged day (BB recharge or stress deviates > k robust-SD) + that day's exposures/covariates + Layer 3 estimates (only those passing thresholds). Output ranked contributors with expected contribution from estimates, plus `unexplained = observed deviation − sum(attributed)` (clamped; shown if large). Contributors with no qualifying estimate are listed as "coincided, no personal evidence yet", never given a number. Templates in `engine/templates.ts` (single file) take a structured `Insight` and return strings; engine returns structured data, templates render, UI displays.

### Pattern 7: Garmin auth and token flow
- Verified (official page): `POST https://personal.connectapi.garmin.com/personalapitoken-service/personal-api/personal-api-key/token` with header `Authorization: ApiKey <key>`. Access token lasts 24h or until the key expires; no refresh tokens, so re-POST with the key. (MEDIUM; Garmin FAQ via search plus official page.)
- Client design: `getToken()` caches token + expiry in memory only (never persisted); refresh at ~23h or on a 401, single in-flight refresh promise (dedupe concurrent callers), one retry per request. Key obtained via injected `getApiKey()`; never logged; redact `Authorization` in every error object and fixture recorder.
- Key expiry: user enters expiry date at key entry (API likely does not report it; probe whether token response includes it); store alongside the encrypted key; UI warns at 14/7/1 days.
- Web key storage: passphrase-derived AES-GCM in IndexedDB (recommended over passkey/WebAuthn for v1; WebAuthn PRF support on iOS PWAs is unverified and adds scope). Protects against casual access and offline disk reads; does not protect against XSS in an unlocked session or a device-unlocked attacker. Decrypted key lives in memory for the session only.
- CLI: key from `GARMIN_API_KEY` env var or prompt; `.env` gitignored.

### Pattern 8: Researching the real endpoints (Phase 0 method)
The Swagger page (`https://developer.garmin.com/gc-developer-program/personal/swagger-docs/`) is JS-rendered and returned no endpoint list to my fetch tool; the base URL for data calls, rate limits, history depth and CORS are **unverified (LOW)**. Procedure:
1. Open the swagger page in a real browser, download the underlying OpenAPI JSON from the Network tab (or "Explore" URL); commit a copy as `docs/garmin-openapi-snapshot.json` (contains no secret). Generate TS types from it with `openapi-typescript` for reference only, but hand-write zod schemas from **observed** responses (docs vs. reality will differ; weight reportedly returns 400).
2. Probe script (`apps/cli probe`): for each GET endpoint, call with a 1-day, 7-day, 30-day, and very old date range; log status, response shape (keys/types only, no raw health values in committed output), item counts, sample spacing (to derive granularity), latency, rate-limit headers (`Retry-After`, `X-RateLimit-*`), and probe max history by bisecting date ranges. Classify each result into the error taxonomy.
3. Record scrubbed responses as fixtures (strip tokens, shift/keep values as needed) for client and ingest tests.
4. CORS: a static page in `apps/web` (or a bare HTML) doing the token POST + one GET from the real deployed GitHub Pages origin and from iPhone Safari. Check preflight (`OPTIONS`) behaviour and `Access-Control-Allow-Origin`; note that a custom `Authorization: ApiKey` header forces a preflight. Verdict goes into `docs/garmin-capabilities.md`.
5. Treat the unofficial endpoints known from other libraries (python-garminconnect uses a different, SSO-based API) as irrelevant; do not mix them in.

### Pattern 9: Optional stateless CORS proxy
Build only if step 4 shows blocked. Cloudflare Worker: allow-list a single upstream host (`personal.connectapi.garmin.com`), allow-list the single Pages origin in `Access-Control-Allow-Origin`, forward method/path/query and the `Authorization` header, return response, set no cache, no `console.log` of headers, no KV/DO storage. The key is sent per request from the device (it transits the proxy; state this tradeoff to the user before building, since the proxy operator, i.e. the user's own CF account, can technically see it). Client takes a `baseUrl` config so the swap is a one-line change; fixtures/tests are unaffected. Security: reject non-allow-listed paths to avoid becoming an open relay.

## Data Flow

```
App open / manual refresh
  → web shell: unlock vault (passphrase) → key in memory
  → ingest.sync(client, store, {from: lastSyncedDate-overlap, to: today})
       per endpoint: client.pull → validate (zod) → normalize (+localDate) → store.upsert → sync_log row
       errors classified per endpoint; one failure doesn't abort others
  → shell: load windowed data from store → engine.computeAll(data, config, tz, asOf)
       baselines → daily_features → effects (FDR) → explanations → insights (dedupe by key)
  → store.replaceDerived(...) ; merge insight user-status by dedupe key
  → UI renders from store (derived + raw)
User logs event/check-in → store.put → (debounced) recompute derived → UI
```
Re-pull a small overlap window (e.g. last 3 days) each sync because today's data is revised as the day progresses; upserts make this safe. Backfill = same function over a long range, chunked, resumable via sync_log, respecting rate limits (sequential, backoff on 429).

## Storage recommendation
**Dexie (IndexedDB)** over sqlite-wasm/OPFS. Reasons: data volume is tiny (daily rows plus possibly minute-level series for a few months), no SQL needed since engine does its own computation on arrays, Dexie is mature and typed, and OPFS-sqlite on iOS PWAs adds worker/COOP-COEP complexity. Both are evictable on iOS, so persistence mitigation is the same: `navigator.storage.persist()`, JSON export/import, last-backup indicator. If minute-level series prove large (probe will tell), store series as one row per (metric, localDate) holding an array rather than one row per sample. MemoryStore for tests/CLI; CLI persistence via JSON file (reuses export format). Confidence: MEDIUM-HIGH.

## Anti-Patterns to Avoid

### Engine reads the store
**Why bad:** couples engine to async I/O and browser APIs, breaks Swift portability and synthetic testing. **Instead:** shell loads arrays and passes them in.

### Computing local dates at read time from current device tz
**Why bad:** travel/DST silently re-buckets history. **Instead:** persist `localDate` + `tzId` at write time.

### Mixing derived with source-of-truth
**Why bad:** can't rebuild/migrate. **Instead:** separate tables, `replaceDerived`, feedback in own table.

### Testing many hypotheses with raw p-values
**Why bad:** insight feed full of noise. **Instead:** FDR, effect floor, thresholds, synthetic-null CI gate.

### Persisting access tokens or storing the key server-side
**Why bad:** needless exposure. **Instead:** in-memory tokens, encrypted key on device, proxy stateless.

### Building UI/proxy before the probe
Probe outcome changes granularity (what outcomes exist), the store shape (series vs. summaries) and whether a proxy exists.

## Scalability Considerations

Single user; "scale" is data volume and device limits.

| Concern | 3 months | 1 year | 3+ years |
|---------|----------|--------|----------|
| Raw rows | Trivial | Fine; per-day series rows | Consider pruning old minute series to daily aggregates |
| Recompute | Sync, <100ms | Sync, <1s | Move to Web Worker (engine is already pure, so cheap to do) |
| Evictions | Export weekly | Same | Same |

## Suggested Build Order (dependencies)

1. **Monorepo skeleton + `core` types + CI (tests, gitleaks, .gitignore)**: before any key is used.
2. **`garmin-client` + CLI probe + CORS page** (Phase 0): gates schemas, store shape, proxy decision. Outputs fixtures and `docs/garmin-capabilities.md`.
3. **`store` interface + MemoryStore + conformance tests + export/import**; then **`ingest`** over fixtures; then DexieStore (can wait until UI, but export format is fixed now).
4. **`engine` time module + baselines + CLI report** (Phase 2). Time helper and DST tests come first as every later window depends on them.
5. **Logging model + check-in** (store tables and events; minimal temporary UI or CLI entry if needed to start collecting labels early; check-in is time-critical, which may justify a thin early web page, so flag to roadmap).
6. **Effect engine + synth generator** (generator should be built at the start of this phase and used TDD-style).
7. **Explanations + templates + insight lifecycle.**
8. **Web UI/PWA, vault, DexieStore, SW**: last because everything beneath is UI-independent; test on real iPhone.
9. **Proxy**: only inserted after step 2 if CORS blocked; it can be built then, before the web sync works.
10. Polish/docs.

Tension to flag: check-in labels can't be backfilled, but UI is planned late. Recommend an early minimal web page (check-in + quick-log writing to Dexie) right after Phase 0, even before ingest is complete, or accept the data loss.

## Sources

- Garmin Personal API page (official): https://developer.garmin.com/gc-developer-program/personal/personal-api (token endpoint and `ApiKey` header verified; HIGH)
- Garmin Personal API FAQ: https://developer.garmin.com/gc-developer-program/personal/personal-faq/ (24h token, no refresh, per search summary; MEDIUM)
- Swagger docs page: https://developer.garmin.com/gc-developer-program/personal/swagger-docs/ (content not retrievable by fetch; endpoint list, base URL, limits, CORS UNVERIFIED)
- Third-party overview: https://the5krunner.com/2026/10/22/garmin-personal-api/ (LOW-MEDIUM)
- Statistical/time-handling/DST/storage guidance: established practice and training knowledge, not re-verified against current library docs (MEDIUM); versions of Dexie/Luxon/Temporal polyfill should be checked at install time.
