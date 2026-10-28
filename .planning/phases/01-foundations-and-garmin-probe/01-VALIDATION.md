---
phase: 1
slug: foundations-and-garmin-probe
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-10-28
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 5.0.5 (Node 24) |
| **Config file** | none — Wave 0 creates `vitest.config.ts` |
| **Quick run command** | `npx vitest run` |
| **Full suite command** | `npm test && npm run check:boundaries && npm run typecheck` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run`
- **After every plan wave:** Run full suite command + gitleaks on tree
- **Before `/gsd:verify-work`:** Full suite must be green, CI green on GitHub
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| TBD (filled by planner) | | | FND-01 | integration | `npx vitest run tools/hook.test.ts` | ❌ W0 | ⬜ pending |
| TBD | | | FND-02 | unit | `npx vitest run packages/garmin-client apps/cli/scrub` | ❌ W0 | ⬜ pending |
| TBD | | | FND-03 | unit | `npx vitest run tools/boundaries.test.ts` | ❌ W0 | ⬜ pending |
| TBD | | | PRB-01 | unit | `npx vitest run packages/garmin-client` | ❌ W0 | ⬜ pending |
| TBD | | | PRB-02 | unit | `npx vitest run apps/cli` | ❌ W0 | ⬜ pending |
| TBD | | | PRB-03 | unit + manual | `npx vitest run apps/cors-probe` | ❌ W0 | ⬜ pending |
| TBD | | | PRB-04 | doc check | `node tools/check-doc.mjs` | ❌ W0 | ⬜ pending |
| TBD | | | PRB-05 | unit | `npx vitest run apps/cli/scrub && gitleaks dir fixtures` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `vitest.config.ts`, root `package.json` workspaces, `tsconfig.json`
- [ ] `tools/hook.test.ts`, `tools/boundaries.test.ts` (+ `tools/boundary-fixtures/bad/`)
- [ ] garmin-client stub-fetch tests and shared fixtures helper
- [ ] gitleaks install on dev machine (Windows) and in CI
- [ ] `npm i -E -D vitest typescript tsx dependency-cruiser husky`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Browser-origin call to Garmin (CORS) on desktop and iPhone Safari | PRB-03 | Needs real iPhone Safari and live Garmin | Open deployed probe page, run, record result in capabilities doc |
| Real probe run against personal key | PRB-02, PRB-04 | Needs real key and vivoactive 5 data | Run CLI probe, review per-endpoint status, scrub, write doc |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
