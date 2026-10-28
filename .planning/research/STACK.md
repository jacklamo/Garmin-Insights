# Technology Stack

**Project:** Insights (local-first iPhone PWA, Garmin Personal API, n-of-1 stats)
**Researched:** 2026-10-28
**Version source:** `npm view` against the live registry on 2026-10-28 (HIGH for "latest exists"; compatibility with each other is MEDIUM until a scaffold is installed and tested).

## Recommended Stack

### Core
| Technology | Version | Purpose | Why | Confidence |
|---|---|---|---|---|
| Node | 24.x LTS | Dev, CLI probe, tests, CI | Engine/ingest must run headless; Node 24 has global `fetch`, `crypto.subtle`, `structuredClone` | HIGH |
| TypeScript | 7.0.2 (latest) | Language | Current stable. Fallback: pin a 5.x/6.x release if a plugin chokes on 7 (new native compiler; ecosystem catch-up risk). Use `strict`, `noUncheckedIndexedAccess` | MEDIUM |
| Vite | 8.3.x | Dev server, bundler | Standard; vite-plugin-pwa 2.0 and vite-plugin-svelte 7.3 both declare Vite 8 support | HIGH |
| Svelte | 5.57.x (runes) | UI | See below. No SvelteKit; plain Vite SPA served as static files | MEDIUM |
| @sveltejs/vite-plugin-svelte | 7.3.x | Svelte in Vite | Peer: vite ^8, svelte ^5.46 | HIGH |

**Svelte over React:** The UI is small (Today, quick-log, feed, charts, settings), one developer, 10 hrs/week. Svelte 5 gives smaller bundles (matters for a cold-start PWA on a phone), less boilerplate, and built-in stores/transitions, so no state library. React's ecosystem advantage (component kits) is irrelevant here since the UI is hand-built for a phone and the engine is framework-free. Portfolio-wise either is fine. If the user already knows React well, React 19.3 is an acceptable swap; nothing else in the stack changes. Keep the engine/ingest/store packages free of framework imports regardless.

### Local database
| Technology | Version | Purpose | Why | Confidence |
|---|---|---|---|---|
| Dexie | 4.4.x | IndexedDB wrapper behind a `Store` interface | Boring, typed, compound indexes and bulk upserts (`bulkPut` = idempotent ingest), works on iOS Safari everywhere | HIGH (existence), MEDIUM (iOS behavior; verify on device) |
| fake-indexeddb | 6.2.x (dev) | Run Dexie store in Node tests/CLI | Lets the same store code run headless | HIGH |
| In-memory `Store` impl | hand-written | Engine/CLI tests | Satisfies the "store behind an interface" constraint; no dependency | HIGH |

**Dexie over sqlite-wasm + OPFS:** The data is small (daily rows plus maybe a few hundred thousand time-series samples/year), access is key-range by date, and all heavy analysis is done in TS over arrays. SQL buys little. sqlite-wasm (`@sqlite.org/sqlite-wasm` 3.54.1) adds a worker, WASM payload, OPFS VFS quirks (sync access handles only in workers; the multi-tab-safe VFS choice, COOP/COEP headers that GitHub Pages cannot set for the fast VFS), and is a less-trodden path on iOS PWAs. It does NOT fix eviction: OPFS is the same origin storage bucket subject to the same iOS eviction rules. Revisit only if time-series queries become slow. Because the store is an interface, this is a swap, not a rewrite.

**Eviction (applies to any choice):** Installed home-screen PWAs get a separate container and are exempt from the 7-day script-storage cap per web.dev, but reports of eviction under low disk space persist and Apple docs for `storage.persist()` on iOS are thin (MEDIUM/LOW, [firt.dev iOS PWA notes](https://firt.dev/notes/pwa-ios/), [web.dev](https://web.dev/storage-for-the-web)). Call `navigator.storage.persist()` on every launch, show result, and treat JSON export + "last backup" as the real durability mechanism.

### PWA / service worker
| Technology | Version | Purpose | Why | Confidence |
|---|---|---|---|---|
| vite-plugin-pwa | 2.0.0 | Manifest + service worker generation | De facto standard; wraps Workbox (workbox-build 7.4.1) | MEDIUM (2.0 is a new major; read its migration notes, fall back to 1.x if Vite 8 issues) |

Use `generateSW` with precache of the app shell only. Do NOT runtime-cache Garmin API responses in the SW (health data in Cache Storage, token leakage risk). Set Vite `base` to `/<repo>/` for GitHub Pages and make manifest `scope`/`start_url` match. Use `registerType: 'prompt'` (update toast) so a stale shell never silently runs against a newer DB schema. Include `apple-touch-icon` and `apple-mobile-web-app-capable` meta tags; iOS ignores much of the manifest.

### Charting
| Library | Version | Purpose | Why | Confidence |
|---|---|---|---|---|
| uPlot | 1.6.32 | Trend/time-series charts | ~50 KB, canvas, fast with dense HR/stress series, MIT, no deps. Needs a small Svelte action wrapper and hand-built tooltips | MEDIUM |

Alternative if uPlot's low-level API costs too much time: Chart.js 4.6 (heavier, friendlier). Avoid D3 (overkill), ECharts (bundle size), anything with telemetry.

### Testing
| Library | Version | Purpose | Why | Confidence |
|---|---|---|---|---|
| Vitest | 5.0.5 | Unit/integration tests | Native Vite/TS; peer vite ^6.4/^7/^8 OK | HIGH |
| @vitest/coverage-v8 | 5.0.5 | Coverage report (portfolio) | Same version as vitest | HIGH |
| fast-check | 4.10.x | Property tests (order invariance, "insufficient data never yields insight") | Matches the brief's property-test requirement | HIGH |
| Timezone testing | `TZ=` env in Vitest scripts, run key tests under several zones (America/New_York, Australia/Lord_Howe, UTC) | DST window tests | No library needed | HIGH |

Garmin client tests use recorded JSON fixtures (a tiny fetch stub); no HTTP-mocking lib needed (skip msw).

### Key encryption (Web Crypto)
| Piece | Choice | Why |
|---|---|---|
| KDF | PBKDF2-SHA-256, >= 600,000 iterations (OWASP 2023 guidance), random 16-byte salt | Built into `crypto.subtle` on iOS Safari; zero dependencies. Argon2 would need WASM (hash-wasm 4.12) for modest gain on a one-user threat model |
| Cipher | AES-GCM 256, fresh random 12-byte IV per encryption, store `{salt, iv, ciphertext, iterations, version}` in IndexedDB | Authenticated, standard |
| Key handling | Derive with `extractable: false`; hold the CryptoKey in memory only for the session; store only ciphertext | Limits XSS exfiltration to "while unlocked" |
| Token | Never persist the 24h access token; keep in memory, refresh from the decrypted key | Smaller blast radius |

Protects against: casual access to the unlocked phone's storage, backup/inspection of raw IndexedDB, accidental leakage in export (exclude the key from JSON export). Does not protect against: XSS while unlocked, a weak passphrase, a device compromised with the passphrase typed. WebAuthn PRF-based unlock on iOS PWAs is not something I verified; treat as LOW and defer (passphrase first). Encrypting the substance-log tables with the same scheme is optional and costs query ability (can't index ciphertext); recommend NOT in v1 and relying on device passcode + encrypted export option, flag to user.

CSP (meta tag, since GitHub Pages can't set headers): `default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src https://personal.connectapi.garmin.com [+ proxy origin]; manifest-src 'self'; base-uri 'none'; form-action 'none'`. Note: meta CSP cannot do `frame-ancestors`. Svelte compiles CSS into the bundle, so `style-src 'self'` should hold; verify with the built output.

### Secret scanning / CI
| Tool | Version | Purpose | Why |
|---|---|---|---|
| GitHub Actions | n/a | Test + build + deploy to Pages | Free, same host as repo |
| gitleaks (Action `gitleaks/gitleaks-action` or pinned binary) | verify latest at setup | Secret scan on every push/PR + full-history scan | Standard; add custom rule for the Garmin key format once known (probe will reveal shape) |
| GitHub secret scanning + push protection | built-in | Second layer | Free for public repos; enable in settings |
| `.gitignore`, `.env*`, `fixtures/raw/` | n/a | Prevent commits | Recorded fixtures must be scrubbed (tokens, user IDs, GPS coordinates, device serials) before commit |
| Pre-commit hook (gitleaks `protect --staged`) via simple git hook | n/a | Catch before push | Do it before first code commit, per brief. Pin Action versions by SHA |

Also: `npm ci` with committed lockfile, exact-pinned deps (`save-exact=true` in `.npmrc`), Dependabot/`npm audit` in CI, no postinstall-script packages. Deploy job gets only `pages: write`/`id-token: write`.

### Statistics
**Hand-roll, in the pure `engine` package.** Needed functions are tiny: median, MAD (scaled 1.4826), IQR/quantiles, robust z-score, rolling window, Hodges-Lehmann or median difference, permutation test for exposed vs unexposed (seeded PRNG such as mulberry32/sfc32, hand-written ~10 lines), bootstrap CI, Spearman for dose-response, simple OLS with a couple of covariates. Reasons: tiny surface, you must understand and test every line (portfolio), seeded determinism, no dependency on browser APIs, and exact control of NaN/missing handling. Permutation/bootstrap beat parametric t-tests at n of 5 to 30 with skewed data. `simple-statistics` 7.12.1 is the only library I'd allow as an optional cross-check in tests (compare your median/quantile/regression to it), not as a runtime dependency. Avoid jstat/mathjs/TensorFlow.js (stale or heavy). Multiple-comparison control (many inputs x many outcomes x windows) is the real statistical risk; implement Benjamini-Hochberg yourself and validate with the null-data false-positive test.

Dates/time zones: store UTC instants plus IANA zone string and Garmin's local-day key; do window math with `Intl.DateTimeFormat` and a small hand-written helper. Temporal API availability in Safari is unverified (LOW); if helper code gets painful use `@js-temporal/polyfill` in the engine (verify bundle cost) rather than moment/dayjs. Unit-test across DST transitions.

### Cloudflare Worker proxy (conditional, only if Phase 0 shows no CORS)
| Technology | Version | Purpose | Why |
|---|---|---|---|
| Wrangler | 4.154.x | Dev/deploy | Standard tooling |
| @cloudflare/workers-types | 5.x (npm shows 5.20261028.1) | Types | Same TS toolchain |

Design: stateless, ~40 lines. Forward only to an allowlist of Garmin paths on `personal.connectapi.garmin.com`, pass the client's `Authorization` header through, add CORS headers restricted to the exact GitHub Pages origin (not `*`), no KV/D1, no `console.log` of headers, `observability` logging disabled in wrangler config. Both the token POST and data GETs go through it. Note this means the key transits Cloudflare in memory; this is the tradeoff to flag to the user, as the brief requires.

CORS status: Garmin's personal API doc page makes no CORS statement and I found no evidence either way (a Garmin forum thread requesting CORS for Connect was unanswered). **Unknown; Phase 0 must test with a real browser fetch incl. the preflight for the `Authorization` header.** Separately, forum reports claim Garmin uses Cloudflare TLS fingerprinting against third-party clients (about the unofficial Connect endpoints; unclear for the official personal API). Test the Node CLI too; a Worker's fetch has a different fingerprint than a browser or Node and may be blocked, which would make the proxy approach fail even if CORS is the only issue you intended to solve. (LOW, sources: [Garmin forum](https://forums.garmin.com/apps-software/mobile-apps-web/f/garmin-connect-web/433892/tls-fingerprinting-blocks-third-party-clients/2023526), [personal API docs](https://developer.garmin.com/gc-developer-program/personal/personal-api)).

### Other tooling
| Tool | Purpose |
|---|---|
| ESLint (flat config) + typescript-eslint, Prettier | Hygiene; Svelte via eslint-plugin-svelte. Pin versions at scaffold time |
| `svelte-check` | Type-check .svelte files in CI |
| tsx or Node 24 native TS stripping | Run CLI without a build step (Node 24 can run `.ts` with type stripping; use `tsx` if enums/paths needed) |
| zod (optional) | Validate Garmin responses at the trust boundary; recommended since API shapes are unverified and some endpoints misbehave. Alternative: hand-written guards. Verify version at install |

## Repo layout (keeps engine portable)
npm workspaces or plain folders with import boundaries enforced by ESLint `no-restricted-imports`: `garmin-client`, `ingest`, `store` (interface + dexie + memory impls), `engine` (zero DOM/Node imports, a lint rule bans them), `cli`, `app`, `worker` (optional).

## Alternatives Considered
| Category | Recommended | Alternative | Why Not |
|---|---|---|---|
| UI | Svelte 5 | React 19 | More boilerplate/bundle for a small UI; fine if user prefers |
| UI | Svelte 5 + Vite | SvelteKit | SSR/routing machinery unneeded; static SPA, hash/simple routing |
| DB | Dexie | sqlite-wasm + OPFS | Complexity, worker, no eviction benefit, little query need |
| DB | Dexie | raw IndexedDB / idb | More code for same result |
| Charts | uPlot | Chart.js | Heavier; ok fallback |
| Stats | hand-rolled | simple-statistics / jstat | Surface too small to justify; correctness needs ownership |
| Crypto KDF | PBKDF2 | Argon2 (hash-wasm) | Extra WASM dep for marginal one-user benefit |
| Mocking | fixture stub | msw | Dependency not needed |
| Hosting | GitHub Pages | Cloudflare Pages | User chose Pages; Cloudflare Pages is the easy switch if custom headers (real CSP) are wanted, and puts a Worker in the same account |

## Installation
```bash
# app
npm i -E svelte uplot dexie
npm i -E -D vite typescript @sveltejs/vite-plugin-svelte svelte-check vite-plugin-pwa \
  vitest @vitest/coverage-v8 fast-check fake-indexeddb tsx
# optional
npm i -E zod
npm i -E -D wrangler @cloudflare/workers-types   # only if proxy needed
```

## What NOT to use
- sqlite-wasm in v1; localStorage for anything but trivial UI prefs (sync, ~5 MB, not for the key); any analytics/CDN-hosted script/font (breaks CSP and privacy); Workbox runtime caching of API calls; service-worker Background Sync/periodic sync/web push (unsupported or unreliable on iOS); moment.js; TensorFlow.js; storing the key or token in `localStorage`/`sessionStorage`; Firebase/Supabase/any hosted DB.

## Open verification items
- Compatibility of TS 7 + vite-plugin-pwa 2.0 + svelte-check: scaffold and run build in week 1 (MEDIUM until done).
- Browser CORS and Worker-origin blocking for Garmin: Phase 0.
- iOS 26.6 persist() behavior and eviction: test on device.
- Garmin key format (for gitleaks custom rule): from probe.

## Sources
- npm registry (`npm view`), 2026-10-28: versions above (HIGH)
- [Garmin Personal API docs](https://developer.garmin.com/gc-developer-program/personal/personal-api): base URL `personal.connectapi.garmin.com`, token endpoint, ApiKey auth header (HIGH); no CORS/rate-limit info on that page
- [web.dev storage for the web](https://web.dev/storage-for-the-web), [firt.dev iOS PWA](https://firt.dev/notes/pwa-ios/): storage behavior (MEDIUM)
- Garmin forum TLS-fingerprinting thread (LOW)
- OWASP password storage cheat sheet PBKDF2 600k figure: from training knowledge, not re-verified this session (MEDIUM)
