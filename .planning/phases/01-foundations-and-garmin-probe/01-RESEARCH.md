# Phase 1: Foundations and Garmin Probe - Research

**Researched:** 2026-10-28
**Domain:** Repo secret hygiene, npm-workspaces monorepo with import boundaries, Garmin Personal API probing (Node CLI + browser CORS page)
**Confidence:** MEDIUM (auth flow and endpoint paths HIGH from Garmin's own repo; rate limits, CORS, history depth, response shapes are unknowable until the probe runs)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
**Key handling (CLI)**
- Garmin key lives in a `.env` file located **outside the repo** (OneDrive Desktop syncs to cloud), e.g. `%LOCALAPPDATA%\insights\.env`; its path is set via an env var. The repo ships only `.env.example`.
- 24h access token is refreshed on every CLI run and held in memory only; never cached to disk.
- Pre-commit hook and CI use generic gitleaks rules now; add a Garmin-specific custom rule once the first probe reveals the key's shape.
- The pre-commit hook must demonstrably block a fake key-shaped string (success criterion 1).

**Probe output and fixtures**
- Terminal output: compact table per endpoint (endpoint, status class ok / no data / access denied / rate limited / error, record count, date range, latency). No response bodies on screen.
- Raw responses saved **outside the repo**, one timestamped folder per run, never committed.
- Fixtures are produced by a repeatable scrub script, shape-preserving: strips IDs, names, GPS, device serials, shifts dates, keeps field names/types/realistic values and sentinel values. A scan confirms no key/token strings remain. Only scrubbed copies are committed.
- `docs/garmin-capabilities.md`: probe generates a per-endpoint table skeleton, then hand-annotated with verdicts (proxy go/no-go, quirks, shared-origin risk).

**Browser CORS test page**
- Hosted on the real GitHub Pages origin (`user.github.io/repo`) so the verdict reflects production. Page contains no secrets.
- Key typed/pasted at runtime, held in memory only; no URL fragment, no storage.
- Reports pass/fail per step (token refresh, one data call) with the raw error class (CORS/network/HTTP status), browser, and origin. Does not display response bodies.
- Run on desktop browser and iPhone Safari (and installed home-screen mode if feasible); results hand-copied into the capabilities doc.

**Probe depth and politeness**
- One light call to every reported endpoint (~26) to learn what exists; deep-dive only daily summary, sleep (stages), HRV, stress, Body Battery, heart rate, activities.
- History depth found by binary search back from today (expect shallow, watch worn since mid-summer 2026).
- Gentle: fixed delay between calls, hard request cap per run, record rate-limit headers, stop on first 429, never deliberately provoke throttling.
- Misbehaving endpoints (e.g. weight 400): record and continue, one retry at most; failure is a finding.

### Claude's Discretion
- Monorepo tooling, package manager, test runner, and how the import-boundary check is implemented.
- Exact gitleaks/pre-commit tooling and CI layout.
- Probe CLI structure, delay/cap values, scrub script internals.
- CORS page styling and deployment mechanics.

### Deferred Ideas (OUT OF SCOPE)
None: discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| FND-01 | .gitignore, pre-commit secret scan, CI (tests + gitleaks) before any real key | Husky + gitleaks `git --staged` hook; CI with pinned gitleaks binary; ordering: plan 1 lands before any key use |
| FND-02 | Key/tokens never in source, logs, fixtures, repo, deployed site | Out-of-repo `.env` + out-of-repo raw dir; in-memory token; scrub script + leak-scan test; page has no secrets |
| FND-03 | Monorepo with enforced one-way boundaries | npm workspaces + dependency-cruiser `forbidden` rules, self-tested with a violating fixture |
| PRB-01 | CLI authenticates and refreshes 24h token | Verified token endpoint/flow (below); token body is a bare JWT string |
| PRB-02 | Per-endpoint status, shape, granularity, rate-limit headers, history depth | Known endpoint list (24 paths) with parameters; status taxonomy; binary-search depth |
| PRB-03 | Static page tests auth + one data call from browser origin incl. iPhone Safari | Plain static HTML/JS deployed via Pages Actions; no-cors control request to classify failures |
| PRB-04 | `docs/garmin-capabilities.md` with proxy go/no-go and shared-origin risk | Generator skeleton + hand annotation; shared-origin facts below |
| PRB-05 | Scrubbed recorded responses as fixtures | Scrub script design, key-scan test |
</phase_requirements>

## Summary

The Garmin Personal API flow is now verified from Garmin's own docs and their official Python client (`garmin/connect-personal-api-python`, Apache-2.0, 2026). Base URL `https://personal.connectapi.garmin.com`. Token: `POST /personalapitoken-service/personal-api/personal-api-key/token` with header `Authorization: ApiKey <key>` and `Accept: */*`, no body. The response body is the bare access token as text (a JWT with an `exp` claim), not a JSON envelope. Tokens last 24h or until the key expires, no refresh tokens (re-POST). Data calls are GETs with `Authorization: Bearer <token>`, `Accept: application/json`. Garmin's client does not retry 401. Keys expire at 30/90/180 days or 1 year; Garmin emails about a week before. Rate limits, history depth, CORS, and response shapes are documented nowhere I could reach; the probe exists to find them.

The Python client's README lists 24 GET endpoints with exact paths (table below), which is the best available substitute for the Swagger page (Swagger is a JS-rendered page I could not scrape; the reported "26" probably includes 2 not in the Python wrapper). The planner should include one manual step: the user opens https://developer.garmin.com/gc-developer-program/personal/swagger-docs/ and compares/pastes the endpoint list into the probe's endpoint config so the CLI covers all ~26.

Phase 1 is mostly plumbing plus one decisive experiment. Keep it small: npm workspaces (matches STACK.md), Husky + gitleaks binary, dependency-cruiser for boundaries, Vitest, `tsx`/Node 24 for the CLI, a dependency-free static HTML+JS page for CORS.

**Primary recommendation:** Plan order: (1) security scaffolding + CI + boundary check, with the fake-key test, before any key exists on disk; (2) `garmin-client` + CLI probe; (3) CORS page + Pages deploy; (4) run probe, scrub, fixtures, write capabilities doc.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node | 24.x (local is v24.21.0) | CLI, tests | `fetch`, `process.loadEnvFile`, native TS type-stripping |
| npm workspaces | npm 11.11 (installed) | Monorepo | Already decided in STACK.md; no pnpm needed (pnpm 11 is installed, but stay with one tool, npm) |
| TypeScript | 7.0.2 per STACK.md (fallback 5.x/6.x if tooling chokes) | Types | Run `tsc --noEmit` in CI only |
| Vitest | 5.0.5 | Tests | Per STACK.md |
| tsx | 4.23.15 | Run CLI .ts | Handles path/enum edge cases Node stripping does not |
| dependency-cruiser | 18.7.0 | Import-boundary check | `forbidden` rules by path; fails with non-zero exit; also detects cycles |
| Husky | 9.1.7 | Git hook install via `prepare` script | Hooks are versioned in repo (`.husky/pre-commit`) |
| gitleaks | v8.30.1 (latest release found via GitHub API) | Secret scan | `gitleaks git --staged` for pre-commit; `gitleaks git` / `dir` in CI |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| zod | 4.6.7 | Validate response shapes at the trust boundary | Optional in Phase 1; probe should only record *observed* shape, not assert it. Skip until Phase 2 |
| ESLint 10.13 + typescript-eslint | verify at scaffold | Lint | Optional now; do not use ESLint for boundaries |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| dependency-cruiser | ESLint `no-restricted-imports` per package | Fewer deps but only matches import strings, not resolved paths; weaker for "package X may not import Y" and no cycle detection. Pick dep-cruiser |
| Husky | `git config core.hooksPath .githooks` + a committed script | Zero dependency, equally valid; Husky only adds auto-install on `npm install`. Either is fine; Husky chosen for auto-install |
| `gitleaks/gitleaks-action` | Pinned binary download in CI | The Action requires a license key only for org repos; personal-account repos are free. A pinned binary with checksum is simpler to reason about and also used locally. Recommend binary |
| pre-commit (Python framework) | Husky | Python 3.14 is installed but adds a second toolchain; skip |

**Installation:**
```bash
# repo root; .npmrc has save-exact=true
npm init -y
npm i -E -D typescript vitest tsx dependency-cruiser husky
npx husky init
# gitleaks is a Go binary, not npm. Local (Windows): winget install gitleaks  (or download gitleaks_8.30.1_windows_x64.zip)
```
gitleaks is NOT currently installed on this machine (`which gitleaks` empty). Plan 1 needs a task for installing it and a hook that fails loudly (not silently skips) when it is missing.

## Architecture Patterns

### Recommended Project Structure
```
packages/
  core/            # shared types (no deps)
  garmin-client/   # token + fetch wrapper, endpoint table, error taxonomy; NO node-only APIs, uses global fetch (so browser page can reuse)
  ingest/          # empty stub w/ package.json + index.ts (Phase 2)
  store/           # stub
  engine/          # stub (no browser APIs ever)
apps/
  cli/             # probe command, scrub script, doc generator (Node-only; may import garmin-client, core)
  cors-probe/      # static index.html + probe.js (no build step)
fixtures/garmin/   # scrubbed JSON only (committed)
docs/garmin-capabilities.md
.dependency-cruiser.cjs
.gitleaks.toml     # extends default; allowlist only fixtures if scrub output trips rules (prefer fixing the scrub)
.husky/pre-commit
.github/workflows/ci.yml, pages.yml
.env.example
```
Order enforced: `core <- garmin-client <- ingest <- store <- engine <- apps` as per PROJECT.md. Note: PROJECT.md order puts engine after store; define allowed edges explicitly rather than "lower index only", e.g. garmin-client may import core only; ingest: core, garmin-client, store-interface? Decide concretely at plan time; the one decision point is where the `Store` interface type lives (put it in `core` so ingest does not import `store`). `engine` imports `core` only. `apps/*` may import anything. Packages must not import from `apps/*`.

### Pattern 1: dependency-cruiser forbidden rules
**What:** path-based rules in `.dependency-cruiser.cjs`; run `depcruise packages apps --config`. Exit code non-zero on violation.
**Self-test (needed for success criterion 5):** a Vitest test that runs depcruise's API/CLI against a tiny fixture tree under `tools/boundary-fixtures/bad/` (excluded from the real run) and asserts a violation is reported; second assert that the real tree passes. Otherwise the check could be silently misconfigured (e.g. wrong path regex matches nothing).
```js
// .dependency-cruiser.cjs  (sketch; verify option names against dependency-cruiser docs at install)
module.exports = {
  forbidden: [
    { name: 'garmin-client-only-core', severity: 'error',
      from: { path: '^packages/garmin-client' },
      to:   { path: '^packages/(ingest|store|engine)|^apps' } },
    { name: 'engine-only-core', severity: 'error',
      from: { path: '^packages/engine' },
      to:   { path: '^packages/(garmin-client|ingest|store)|^apps' } },
    { name: 'packages-not-apps', severity: 'error',
      from: { path: '^packages' }, to: { path: '^apps' } },
    { name: 'no-circular', severity: 'error', from: {}, to: { circular: true } },
  ],
  options: { tsConfig: { fileName: 'tsconfig.json' }, doNotFollow: { path: 'node_modules' } },
};
```
Gotcha: workspace imports resolve to `node_modules/@insights/x` symlinks; set `options.preserveSymlinks: false` (default) and make sure the resolved path is `packages/x/...`, otherwise `to.path` rules match nothing. Verify with the self-test.

### Pattern 2: Husky pre-commit with fail-loud gitleaks
```sh
# .husky/pre-commit
command -v gitleaks >/dev/null 2>&1 || { echo "gitleaks not installed; refusing to commit"; exit 1; }
gitleaks git --pre-commit --staged --redact -v
```
Check current flag syntax with `gitleaks git --help` after install (v8.19+ uses `gitleaks git --pre-commit --staged`; the old `protect --staged` is deprecated; MEDIUM confidence on exact flags). Husky 9 hooks are plain shell run by Git for Windows' sh; works from VS Code and terminal.

**Demonstrating the block (criterion 1):** automated test is hard because hooks run in git. Do it as a script `scripts/verify-hook.sh` (or a Vitest test using a temp git repo with the same hook): writes `const k = "AKIAIOSFODNN7EXAMPLE"`-style or a generic-api-key-shaped line, `git add`, `git commit`, asserts non-zero exit, then cleans up. Use a string that default gitleaks rules actually match (the default `generic-api-key` rule needs a keyword like `api_key = "<high-entropy 16+ chars>"`; entropy threshold applies, so use a random-looking value, and confirm by running `gitleaks dir` on it). Note the AWS docs example key `AKIAIOSFODNN7EXAMPLE` is on gitleaks' built-in allowlist-style stopwords (contains "EXAMPLE"), so it may NOT trigger; use a fabricated GitHub-token-shaped string (`ghp_` + 36 random alphanumerics) or a high-entropy `api_key=` assignment. Verify empirically. Never put the fake string in a committed file; generate it at test time.

### Pattern 3: Garmin client (shared by CLI and browser page)
```ts
// packages/garmin-client/src/auth.ts
// Source: garmin/connect-personal-api-python (auth.py, constants.py), Garmin personal-faq
const BASE = 'https://personal.connectapi.garmin.com';
const TOKEN_PATH = '/personalapitoken-service/personal-api/personal-api-key/token';

export async function fetchToken(key: string, f: typeof fetch = fetch): Promise<string> {
  const r = await f(BASE + TOKEN_PATH, { method: 'POST', headers: { Accept: '*/*', Authorization: `ApiKey ${key}` } });
  if (!r.ok) throw new GarminHttpError('token', r.status);   // never include key or headers in the error
  return (await r.text()).trim();   // bare JWT string, not JSON
}
export async function get(token: string, pathAndQuery: string, f = fetch) {
  return f(BASE + pathAndQuery, { headers: { Accept: 'application/json', Authorization: `Bearer ${token}` } });
}
```
Classification (feeds ING-01 later, define now): 2xx with data = `ok`; 2xx/204 with empty body or empty array/object = `no_data`; 401/403 = `access_denied` (401 after a fresh token = key expired/revoked); 429 = `rate_limited`; everything else (400, 5xx, network) = `error`. Parse `exp` from the JWT payload (base64url middle segment) to log token lifetime without logging the token.

### Pattern 4: Known endpoint table (seed for probe config)
Source: Garmin's official Python client README. All GET, base URL above. Dates are `YYYY-MM-DD`. (HIGH for paths existing in Garmin's client; responses unverified.)

| Name | Path |
|------|------|
| daily-summaries | `/usersummary-service/v2/dailysummaries?startDate=&endDate=` |
| stress (daily range) | `/usersummary-service/stats/stress/daily/{start}/{end}` |
| steps (daily range) | `/usersummary-service/stats/steps/daily/{start}/{end}` |
| hydration | `/usersummary-service/stats/hydration/daily/{start}/{end}` |
| sleep (one day, has stages) | `/sleep-service/sleep/dailySleep?date=` |
| sleep summaries | `/sleep-service/sleep/dailySleepSummariesByDate?startDate=&endDate=` |
| body battery | `/wellness-service/wellness/bodyBattery/reports/daily?startDate=&endDate=[&chunks=]` |
| heart rate (one day) | `/wellness-service/wellness/dailyHeartRate?date=` |
| HRV (one day) | `/hrv-service/hrv/{date}` |
| HRV summaries | `/hrv-service/hrv/daily/{start}/{end}` |
| SpO2 | `/wellness-service/wellness/daily/spo2acclimation/{date}` |
| wellness activity summaries | `/wellnessactivity-service/activity/summary/range/{start}/{end}` |
| activities search | `/activitylist-service/activities/search/activities?start=&limit=[&startDate=&endDate=&activityType=]` |
| activity detail | `/activity-service/activity/{id}` |
| activity workouts | `/activity-service/activity/{id}/workouts` |
| activity download (ZIP FIT) | `/download-service/files/activity/{id}` (skip in probe except HEAD-like single small check; binary) |
| weight | `/weight-service/weight/range/{start}/{end}?includeAll=true` (known 400 reports) |
| weight goals | `/goal-service/goal/user/effective/weightgoal/{start}/{end}` |
| food logs | `/nutrition-service/food/logs/{date}` |
| profile settings | `/userprofile-service/userprofile/settings` |
| HR zones | `/biometric-service/heartRateZones/v2` |
| fitness age | `/fitnessage-service/fitnessage/v2/{date}` |
| menstrual summary / day view | `/periodichealth-service/menstrualcycle/summary/{date}`, `/dayview/{date}?todayDate=` (skip: irrelevant, likely no data; still count toward "what exists" only if user wants) |

That is 24 paths, vs "26" reported. No respiration or intraday stress/body-battery series path appears in this list: stress is a daily-range stats endpoint and body battery is a "reports/daily" with optional `chunks`. Whether `chunks` yields time series is a key probe question (granularity decides the insights). Likewise whether `dailyHeartRate` returns per-minute values and `dailySleep` includes stage series/HRV/respiration fields are things to record. Note activities may only return summaries unless the FIT download is used.

Probe politeness suggestion (discretion): 1.5 s fixed delay (use 2 s), hard cap 150 requests per run (~24 light + deep dives + about 10 binary-search steps per dated endpoint x 7 endpoints = ~100 worst case; set cap 200 and print how many remain), stop on first 429, 1 retry only for 5xx/network, never for 4xx. Record every response header whose name matches `/ratelimit|retry-after|x-.*limit|x-.*remaining|date|server|cf-|access-control/i` plus the full header name list (names only) into the run folder; the capabilities doc includes the observed header names. Headers are safe to commit only after review (cookies/`set-cookie` stripped).

### Pattern 5: History-depth binary search
For each deep endpoint, find the earliest date with `ok` (non-empty) data: exponential probe back (7, 14, 30, 60, 120, 240, 365 days) then binary search between the last `ok` and first `no_data`/error. Caveats: a single empty day inside the window (watch not worn / sync gap) looks like "before history". Test around each candidate with a range endpoint (a range of 7 days) where one exists, or check 3 adjacent days before concluding. Also distinguish "API refuses date range too long" (400) from "no data". Cap steps per endpoint at ~10. Also the watch worn since mid-summer 2026 means the true floor may simply be the device start, so state "history depth bounded by device ownership, not API" when the search floor equals the first worn day (can't be distinguished without older data from a previous device; check profile/activities for older dates).

### Pattern 6: Config and paths (Windows, OneDrive)
- `INSIGHTS_ENV_FILE` env var set once as a user-level variable (`setx INSIGHTS_ENV_FILE "%LOCALAPPDATA%\insights\.env"`); CLI does `process.loadEnvFile(process.env.INSIGHTS_ENV_FILE ?? path.join(process.env.LOCALAPPDATA!, 'insights', '.env'))`. Key name in file: `GARMIN_PERSONAL_API_KEY` (matches Garmin's own client convention). Raw dir: `INSIGHTS_DATA_DIR` default `%LOCALAPPDATA%\insights\runs\<ISO timestamp>\`. Guard: CLI refuses to start if either resolved path is inside the repo root (`path.relative` check), since the repo is under OneDrive Desktop. Also the repo itself being in OneDrive means `.git` and `node_modules` sync; not a Phase 1 problem but note OneDrive can corrupt `.git` locks / slow `npm install`; mention to user, do not act.
- CLI must never print the key, `Authorization` header, or token; wrap fetch errors so URL query/headers are not dumped. Add a unit test that runs the client with a fake key against a stub fetch that fails and asserts the error string contains neither the key nor "ApiKey"/"Bearer".

### Pattern 7: CORS page
- `apps/cors-probe/index.html` + `probe.js` (module), zero dependencies, no build. A password-type input for the key, a "Run" button, results list. Key kept in a JS variable only; `autocomplete="off"`; do not set `name` attributes on form (avoid iOS password-manager/autofill saving it); no form submit; no URL params.
- Steps: (1) `POST token` with `Authorization: ApiKey`; (2) one GET data call with Bearer (e.g. `/userprofile-service/userprofile/settings` or `dailyHeartRate?date=today`; pick a cheap one the CLI proved returns 200).
- **Classifying failures:** a CORS block and a network failure both surface as `TypeError: Failed to fetch` (Safari: "Load failed"); status is hidden. Add a control: on failure, repeat the same URL with `mode: 'no-cors'` and no custom headers; if that resolves (opaque response) the host is reachable and the earlier failure is CORS (preflight or missing `Access-Control-Allow-Origin`). If the control also throws, it is a network/DNS/ATS problem. Additionally run an explicit `OPTIONS` isn't possible from fetch (browser does it); that's why the control exists. If a response is readable, show `status`, and whether `Access-Control-Allow-Origin` is readable. Display: step, outcome, error class, `navigator.userAgent`, `location.origin`, display-mode standalone yes/no, timestamp. No bodies.
- Also record from the CLI side (Node) `curl -i -X OPTIONS` with `Origin: https://<user>.github.io`, `Access-Control-Request-Method: POST`, `Access-Control-Request-Headers: authorization` against the token URL and one data URL, to read the preflight response directly (a plain HTTP client sees what the browser hides). This is cheap and gives the exact headers for the doc. Run it once, not repeatedly.
- Deployment: GitHub Actions Pages (`actions/configure-pages`, `actions/upload-pages-artifact` with `path: apps/cors-probe`, `actions/deploy-pages`), permissions `pages: write`, `id-token: write`, pin actions by SHA. Pages must be enabled with Source = GitHub Actions. Constraint: GitHub Pages on free plans needs a **public repo**; confirm the repo's visibility with the user (public repo + a secret scanner is why FND-01 precedes everything). Result URL is `https://<user>.github.io/<repo>/`. Keep this page deploy separate from the future app deploy (Phase 7) or reuse the workflow later.
- Test matrix to document: desktop Chrome/Edge, desktop Safari if available (otherwise skip), iPhone Safari tab, installed home-screen mode (needs a minimal manifest + `apple-mobile-web-app-capable` meta; optional, cheap: a 10-line `manifest.webmanifest`; flag as best-effort per CONTEXT).
- Shared-origin risk (PRB-04 content): every project site under `<user>.github.io` shares ONE origin, so IndexedDB/localStorage/Cache Storage of the future app is readable by any other page or repo's JS served from that user account (including a future abandoned portfolio repo, or XSS in any of them). The future app holds encrypted key and health/substance data in IndexedDB at that origin. Mitigations to document: a dedicated GitHub account/org (`<org>.github.io`) or custom domain (V2-08), or Cloudflare Pages. Record that the decision is "accepted for v1 / not accepted" as the user's call; research recommendation: before Phase 7, at least do not host any other JS under that user's Pages. (HIGH on same-origin rule; this is browser same-origin policy, not a Garmin fact.)

### Anti-Patterns to Avoid
- Writing the token to a cache file like Garmin's Python client does (user decision: memory only).
- Passing the key via CLI arg (shell history) or committing `.env`. Use the env file only.
- Committing raw responses or run folders; also don't put raw dir inside OneDrive (resolved path guard above).
- Trusting that "Node works" means the browser works (the whole point of PRB-03).
- Checking only response status for "no data": 200 with `[]`/`{}`/null fields or all-null series is "no data".
- Hand-editing fixtures: always regenerate with the scrub script.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Secret scanning | Regex scanner | gitleaks (hook + CI) | Entropy, rule coverage, history scans |
| Import boundaries | Custom AST/regex walker | dependency-cruiser | Resolves workspace paths, cycles |
| Git hooks install | Manual `.git/hooks` copy | Husky `prepare` | Hooks aren't versioned otherwise |
| Test runner | Node scripts | Vitest | Already decided |
| .env parsing | dotenv dependency | `process.loadEnvFile` (Node 24) | Built in |
| JWT parse for `exp` | jsonwebtoken | 3 lines: split, base64url decode, JSON.parse (no signature check needed; display only) | No dependency; do NOT verify |

**Key insight:** The scrub script and leak scan ARE custom and unavoidable (shape-preserving anonymization is project-specific), so make them well tested; everything else is off the shelf.

## Scrub Script Design (PRB-05, FND-02)

- Input: a run folder (outside repo). Output: `fixtures/garmin/<endpoint>.json` (one or two representative days per endpoint, trimmed array lengths where huge, e.g. keep 3 days and 1 day of intraday series intact).
- Deterministic transform walking the JSON tree by key name and value type:
  - Drop or replace by key name regex: `userProfileId|userId|displayName|fullName|firstName|lastName|email|ownerId|deviceId|serial|unitId|activityId|uuid|guid|accessToken|token|apiKey|authorization`. IDs replaced with stable pseudonyms (map original to sequential ints via a per-run map so cross-references stay consistent).
  - GPS: keys `latitude|longitude|lat|lon|startLatitude|...|polyline|geoPoly` plus any number pair; replace with a fixed fake location offset, or drop.
  - Dates/timestamps: shift all by one constant offset N days (same for every file in the run, chosen at random once, and NOT written into the repo), preserving time-of-day and the local/GMT pair relationship; `calendarDate` strings, epoch ms values (13-digit numbers under keys ending `GMT|Local|Timestamp|Time`), and ISO strings. Shift both the GMT and local fields so the tz offset stays consistent. Keep tz offset values (they are realistic; mention it reveals a coarse region, acceptable? flag: timezone region is mildly identifying; user decision, default keep because ING-05 needs tzId realism, replace with `America/New_York`-style equal offset if user prefers).
  - Preserve: field names, types, nulls, sentinel values (e.g. stress -1/-2, body battery sentinels), realistic magnitudes. Do not randomize physiological values (they are not identifying enough and the engine tests need realism). Mention to user: sleep/HR series at known dates are mildly identifying only combined with date; shifting handles that.
- Free-text fields (activity names, notes): replace with `"<redacted>"` string of the same type.
- Verification (hard gate, part of the same command and also a Vitest test on a synthetic raw sample): after writing, scan output for (a) the literal key and token strings loaded from the env file/in memory, (b) any JWT-looking `eyJ...\.\w+\.\w+`, (c) gitleaks `dir fixtures/` returns clean, (d) none of the original ID values appear (keep the pre-scrub ID set in memory and grep). Exit non-zero on any hit. Because gitleaks may flag high-entropy IDs/hashes in fixtures, prefer to fix scrubbing (replace hash-like strings) rather than allowlist; allowlist by path only as last resort and document it.
- The repo is public potentially: assume fixtures are published. Err toward dropping fields not needed (profile, HR zones user demographics: age, weight, height, birth date are identifying; scrub or drop `birthDate`, `weight`, `height`, `gender`).

## Common Pitfalls

### Pitfall 1: Hook silently inactive
**What goes wrong:** gitleaks not on PATH or Husky not installed (`prepare` not run) so commits pass unscanned.
**How to avoid:** hook exits 1 if gitleaks is missing; `npm run verify-hook` script; CI gitleaks is the backstop (and GitHub push protection/secret scanning on the repo, free on public repos, enable in settings by hand).
**Warning signs:** `.git/hooks` or `core.hooksPath` not pointing at `.husky/_`. Check `git config core.hooksPath`. Currently empty.

### Pitfall 2: Fake key does not trigger default rules
**What goes wrong:** the "blocked commit" demo uses a string gitleaks ignores (stopword "EXAMPLE", low entropy), so the demo fails or, worse, gives false confidence.
**How to avoid:** choose a string and verify `gitleaks dir` flags it before wiring the test; keep the Garmin custom rule for later per user decision.

### Pitfall 3: CI scans only the latest commit
**What goes wrong:** checkout depth 1 means gitleaks sees nothing of history. **How to avoid:** `actions/checkout` with `fetch-depth: 0`; run `gitleaks git` on whole history. Prior commits (`docs/` is currently untracked) are clean planning docs; confirm `docs/insights-context.md` contains no key before first commit (it is untracked now).

### Pitfall 4: Windows CRLF / path issues
`.husky/pre-commit` must have LF endings (add `.gitattributes`: `* text=auto eol=lf`, `*.sh text eol=lf`); dependency-cruiser regexes use forward slashes, but on Windows resolved paths are normalized to `/` by dep-cruiser (verify via self-test). Run CI on ubuntu; dev on Windows; avoid `rm -rf`/`$VAR` in npm scripts (use Node scripts) as npm scripts run under cmd.exe on Windows by default.

### Pitfall 5: Browser failure misread as CORS
`TypeError: Failed to fetch` also covers offline, ATS/TLS and content-blockers; use the no-cors control and run on both desktop and phone. Also Safari may block mixed content or extension interference; test in a private tab.

### Pitfall 6: Preflight cache / stale verdict
Browsers cache successful preflights for up to a short period; re-test in a fresh tab before recording a verdict. Record Garmin's `Access-Control-Max-Age` if present.

### Pitfall 7: Worker proxy blocked even if CORS is the only problem
STACK.md notes (LOW) forum reports of TLS-fingerprint blocking against third-party clients (about unofficial Connect endpoints). If CORS fails, the doc's go/no-go for a proxy should state that a Worker was *not* tested in Phase 1 and that the proxy verdict is "needed; feasibility to be confirmed" unless the user wants a 40-line Worker spike. Recommend including an optional single task: from Node, check that the CLI itself works (it proves the server accepts non-browser fetch fingerprints; Node undici works) and note Worker feasibility untested. Don't build the Worker in this phase (V2-06).

### Pitfall 8: Plain-text token response
Treating the token response as JSON throws. It is a bare JWT string (verified from Garmin's client: `response.text.strip()`). Also tolerate JSON-wrapped just in case the live API differs from Garmin's client (probe records content-type; LOW risk).

### Pitfall 9: Date and timezone confusion in probe results
Record both calendar date requested and returned `calendarDate`, and whether timestamps are GMT/local. The capabilities doc must state sleep dating (wake-up day vs start day) from observed data because ING-05 depends on it. DST fall-back is 2026-11-01, within days; if the probe runs near it, note it.

### Pitfall 10: Probe bloat
Probe must not become the Phase 2 ingest. Keep the CLI to: `probe` (run), `scrub`, `report` (generate doc skeleton). No store, no baselines.

## Code Examples

### Probe status table row
```ts
type Status = 'ok' | 'no_data' | 'access_denied' | 'rate_limited' | 'error';
function classify(status: number, body: unknown): Status {
  if (status === 429) return 'rate_limited';
  if (status === 401 || status === 403) return 'access_denied';
  if (status >= 200 && status < 300) return isEmpty(body) ? 'no_data' : 'ok';
  return 'error';
}
const isEmpty = (b: unknown) =>
  b == null || (Array.isArray(b) && b.length === 0) || (typeof b === 'object' && Object.keys(b as object).length === 0);
// Some responses are objects whose fields are all null/empty arrays; also treat those as no_data (check recursively) once real shapes are seen.
```

### Boundary check as test
```ts
// tools/boundaries.test.ts (sketch). Use depcruise's JS API (cruise) and assert violations.length === 0 for real tree,
// and >= 1 for tools/boundary-fixtures/bad with the same ruleset.
```

### CI skeleton (ubuntu-latest)
```yaml
# .github/workflows/ci.yml  (pin actions by SHA when writing; versions here are placeholders to verify)
on: [push, pull_request]
permissions: { contents: read }
jobs:
  test:
    steps:
      - uses: actions/checkout@<sha>
        with: { fetch-depth: 0 }
      - uses: actions/setup-node@<sha>
        with: { node-version: 24 }
      - run: npm ci
      - run: npm run typecheck && npm test && npm run check:boundaries
  gitleaks:
    steps:
      - uses: actions/checkout@<sha>
        with: { fetch-depth: 0 }
      - run: |
          curl -sSL -o gl.tgz https://github.com/gitleaks/gitleaks/releases/download/v8.30.1/gitleaks_8.30.1_linux_x64.tar.gz
          echo "<sha256 from release checksums file>  gl.tgz" | sha256sum -c -
          tar xzf gl.tgz gitleaks && ./gitleaks git --redact -v
```

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| Unofficial `garth`/OAuth1 on `connectapi.garmin.com` (scrapes Connect login) | Official Personal API key to bearer token (2026) | Ignore community libs; they are a different auth system and ToS risk |
| `gitleaks protect --staged` | `gitleaks git --pre-commit --staged` | Old command deprecated (verify flags on installed version) |
| dotenv package | `process.loadEnvFile` / `--env-file` | No dependency |

## Open Questions

1. **Does Garmin send CORS headers?**
   - Known: no documentation mentions CORS (Garmin docs, FAQ, Python client). Unknown empirically.
   - Resolve: Pattern 7 page plus raw OPTIONS from curl. Verdict gates Phase 2/7. If blocked, flag proxy tradeoff (key transits Cloudflare in memory) per PROJECT.md before building anything.
2. **What are the two endpoints missing from my 24-path list (reported 26)?** Resolve by the user viewing the Swagger page (JS-rendered; not scrapeable by my tooling) and adding to the probe's endpoint config. Possibly respiration, activity details, or user-metrics.
3. **Granularity of stress and body battery** (daily summary vs intraday series; effect of `chunks`). Probe.
4. **Rate limits:** documented nowhere. Observe headers; do not provoke. Record "no limit observed at N requests / 2 s" and cap.
5. **What is the key's shape** for the custom gitleaks rule: after first run, inspect length/charset only (never commit a sample). Add rule like prefix/length regex derived from observed shape; test the rule with a generated fake of the same shape.
6. **Is the repo public?** Pages on free plan requires it; also decides whether GitHub secret scanning/push protection is available. Needs user answer before the Pages plan.
7. **GitHub username / repo name** needed for the actual Pages origin; not known from the repo (`git remote -v` printed nothing; no remote configured). User must create the remote before the CORS page can be hosted on the real origin.
8. **Token response contents**: bare JWT per Garmin's client; confirm; record `exp` minus `iat` (documented 24h) and the JWT claim *names* (not values) in the doc, since claims may include scopes/user ID.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 5.0.5 (+ Node 24) |
| Config file | none yet; Wave 0 creates `vitest.config.ts` (root, workspace projects) |
| Quick run command | `npx vitest run` |
| Full suite command | `npm test && npm run check:boundaries && npm run typecheck` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FND-01 | Hook blocks fake key; CI runs tests + gitleaks | integration (temp git repo) + CI config assert | `npx vitest run tools/hook.test.ts`; CI: observe workflow run | Wave 0 |
| FND-02 | No key/token in logs/errors/fixtures | unit (stub fetch failure; scrub scan) | `npx vitest run packages/garmin-client apps/cli/scrub` | Wave 0 |
| FND-03 | Boundary violation fails | unit via depcruise API on bad fixture tree + real tree | `npx vitest run tools/boundaries.test.ts` | Wave 0 |
| PRB-01 | Token fetch, plain-text JWT, in-memory | unit with stub fetch (text body, exp parse, 401 handling) | `npx vitest run packages/garmin-client` | Wave 0 |
| PRB-02 | Classification, delay/cap/stop-on-429, binary search | unit with stub fetch/clock (fake timers) | `npx vitest run apps/cli` | Wave 0 |
| PRB-03 | Page reports steps and error class | manual (real browsers incl. iPhone) + unit of classifier function extracted to a testable module | manual; `npx vitest run apps/cors-probe` for classifier | Wave 0 / manual-only: needs real iPhone Safari and real Garmin |
| PRB-04 | Doc exists with go/no-go, shared-origin section | doc check script (grep headings and non-empty verdict) | `node tools/check-doc.mjs` | Wave 0 |
| PRB-05 | Fixtures scrubbed, repeatable | unit on synthetic raw sample + `gitleaks dir fixtures/` | `npx vitest run apps/cli/scrub && gitleaks dir fixtures` | Wave 0 |

### Sampling Rate
- Per task commit: `npx vitest run` (< 30 s)
- Per wave merge: full suite command + gitleaks on tree
- Phase gate: full suite green, CI green on GitHub, manual browser matrix recorded in doc, before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `vitest.config.ts`, root `package.json` workspaces, `tsconfig.json`
- [ ] `tools/hook.test.ts`, `tools/boundaries.test.ts` (+ `tools/boundary-fixtures/bad/`)
- [ ] garmin-client stub-fetch tests and shared fixtures helper
- [ ] gitleaks install on dev machine (Windows) and in CI
- [ ] Framework install: `npm i -E -D vitest typescript tsx dependency-cruiser husky`

## Sources

### Primary (HIGH confidence)
- https://developer.garmin.com/gc-developer-program/personal/personal-api : token endpoint, `Authorization: ApiKey` header
- https://developer.garmin.com/gc-developer-program/personal/personal-faq/ : token validity 24h or key expiry, no refresh tokens, key expiry options 30/90/180/365, key shown once, deletion invalidates tokens
- https://github.com/garmin/connect-personal-api-python (README, `src/garmin_personal_api/constants.py`, `auth.py`, `client.py`) : base URL, token response is plain text JWT, Accept headers, 24 endpoint paths, no rate-limit guidance
- npm registry via `npm view` 2026-10-28: dependency-cruiser 18.7.0, husky 9.1.7, vitest 5.0.5, tsx 4.23.15, typescript 7.0.2, zod 4.6.7, eslint 10.13.0
- GitHub API: gitleaks latest release v8.30.1 (windows x64 zip exists)

### Secondary (MEDIUM confidence)
- https://the5krunner.com/2026/10/22/garmin-personal-api/ : API families, personal tier is pull-only; no rate/CORS info
- .planning/research/STACK.md, PITFALLS.md (prior project research)

### Tertiary (LOW confidence)
- gitleaks hook flag syntax (`git --pre-commit --staged`) and EXAMPLE-stopword behavior: from training knowledge, verify with `gitleaks git --help` and empirically
- dependency-cruiser option names/workspace symlink resolution: verify at install via self-test
- Swagger page content (26 endpoints) not retrievable; reliance on Python client list

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH for versions (registry), MEDIUM for TS 7 compatibility with tooling
- Architecture: MEDIUM-HIGH; auth/endpoint facts from Garmin's own client
- Pitfalls: MEDIUM; CORS/rate-limit/history are empirical unknowns by nature

**Research date:** 2026-10-28
**Valid until:** 2026-11-27 (Garmin API is new in 2026 and may change; re-check Swagger before probing)
