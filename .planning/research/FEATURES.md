# Feature Landscape

**Domain:** Single-user, phone-first personal health insights (Garmin data + self-logged inputs, n-of-1 analysis)
**Researched:** 2026-10-28
**Confidence:** MEDIUM-LOW. Based on knowledge of Whoop, Oura, Bearable, Exist.io, Garmin Connect and the project brief. No live web verification in this pass (training data is a hypothesis). Product feature lists may have changed; verify before copying any specific competitor behavior.

## What comparables do (summary)

| Product | Strong at | Weak at (the gap Insights fills) |
|---------|-----------|----------------------------------|
| Whoop | Journal (yes/no behaviors) correlated to next-day Recovery; "Behavior Insights" with impact % | Proprietary score; subscription; journal toggles only; opaque |
| Oura | Readiness/sleep scores with contributors list; Tags; trends vs baseline range | Contributors are generic; tags weakly analyzed |
| Bearable | Fast symptom/mood/factor logging, customizable factors, correlation charts, reminders | No wearable depth for Garmin; correlations naive, little confidence reporting |
| Exist.io | Pulls many sources, daily correlations with plain-language "X tends to go with Y" and confidence | Cross-source shallow; no exposure windows/lag; no sample-size-first UX |
| Garmin Connect | Body Battery, Stress, sleep score, HRV status (personal baseline band), "Insights" cards | Population labels; no user context; no causal/behavior link |

## Table Stakes

Missing = product feels incomplete or logging dies.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Today view (key metrics vs own baseline) | Every comparable has a daily home screen | Med | Show deviation, not raw number only; "still learning, N more days" for cold start |
| Daily metrics: sleep (stages), HRV, resting HR, stress, Body Battery, steps, activities | Baseline Garmin Connect parity | Med | Gated by Phase 0 probe of what the API actually returns |
| Trend charts (7/30/90 day) with baseline band | Oura/Garmin all show baseline range | Med | Band = median +/- MAD; one chart lib |
| Quick-log of inputs (<10 s) | Bearable/Whoop journal: friction kills data | Med | One-tap button grid, tap = event now, long-press/sheet = backdate; undo toast; recent/favorite ordering; count stepper for repeats |
| Backdating / editing / deleting events | Users forget to log in the moment | Low | Time picker defaulting to "now", chips for "1h ago / last night" |
| Daily check-in (energy, mood, soreness 1-5) | Bearable/Exist/Whoop all have subjective capture | Low | Single screen, 3 taps, skippable, optional note; ship first (labels cannot be backfilled) |
| Workout perceived effort (RPE 1-10) | Standard in training apps | Low | Attach to activity; prompt after sync finds new activity |
| Manual refresh + sync on app open, last-synced indicator | Pull-only API, no background on iOS | Low | Show per-endpoint status (no data vs denied vs error) |
| Export / import / delete all, last-backup indicator | Required by privacy + Safari eviction | Low-Med | JSON first; CSV optional |
| Installable PWA with offline shell | "Phone-first" | Med | Setup inside installed app |
| Key-expiry warning, replace-key flow | Garmin key expires | Low | Warn at e.g. 14/7/1 days |
| Custom input types (user-extensible) | Bearable factor customization is core | Low | Name, icon, optional unit; seeded set per brief |

## Differentiators

Where Insights beats the comparables. All consistent with the core value.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Evidence-first insights: effect size in own units + "6 of 8 occasions" + n + confidence | Competitors show correlation % or vague "tends to"; this is the stated core value | High | Min thresholds (>=5 exposed, >=10 unexposed) in one config; hide below threshold |
| Exposure windows per input (same evening, overnight, next morning, next day, 2-day lag) | Whoop journal is next-day only; lag/time-of-day is what makes caffeine/alcohol analysis real | High | Timezone/DST safe; configurable per type |
| Confounding flags (collinear exposures refuse attribution) | Competitors silently attribute | High | "Alcohol and marijuana co-occurred on 7 of 8 nights; can't separate" |
| Dose-response and timing sensitivity (1 vs 3 coffees, before/after 2 PM) | Almost nobody does this | High | Only caffeine/alcohol have dose; nicotine/marijuana are count-only so limited |
| Body Battery / Stress explanation with ranked contributors + explicit "unexplained" remainder | Garmin is a black box; Oura contributors are generic | High | Uses Layer 3 estimates; never forces an explanation; copy: "recharged +34 vs usual +62; likely: ..." |
| Personal baselines (28-day median/MAD) for every metric, "today vs you" | Oura/Garmin partly do this; Insights does it uniformly | Med | Cold-start handling is the real feature |
| Suggested experiments ("skip for 5 nights, compare") and result tracking | n-of-1 closing the loop; Exist/Bearable stop at observation | Med | Experiment = a tracked window + auto-compare when complete |
| Insight lifecycle: dedupe, age out, tap-through to underlying days, tested/wrong/dismissed feedback | Prevents stale/noisy feed | Med | Feedback should suppress re-surfacing |
| Check-in as ground truth: later "which watch metrics predict how I feel" | Unique personal learning | High | Later phase, needs months of data |
| Synthetic-data validated engine, false-positive rate tracked | Trustworthiness, portfolio value | Med | Mostly engineering, not user-visible; surface a "how sure" badge |
| Private/local-first, no account, no analytics | Substance data sensitivity | Med | Strongest positioning vs subscription apps |

## Anti-Features

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Proprietary "Recovery/Readiness" composite score | Out of scope, black box, competes with Whoop | Show deviations of raw metrics + explain Garmin's scores |
| Reverse-engineering Garmin Stress/Body Battery formulas | Unknowable, false precision | "What coincided" language only |
| Medical claims, diagnosis, abstinence advice, scolding/streaks/cheerleading | Brief tone rules; liability | Neutral observations with counts |
| Gamification (streaks, badges, points) | Wellness-app fluff; guilt on substance logs | None; at most a quiet "logged today" state |
| Push notifications / background sync | Unreliable on iOS PWA | In-app banners (key expiry, "check-in not done") on open |
| LLM-generated insight text | Privacy, nondeterminism | Templates in one file |
| ML/predictive models in v1 | Too little data | Simple stats; revisit after months, must beat Layer 3 |
| Social, sharing, multi-user, accounts, cloud sync | Terms + privacy | Export file only |
| Insights from stripped FIT fields (VO2 max, training effect, recovery time, sweat loss) | Not delivered by API | Say "not supportable by this data" |
| Detailed substance dose/method forms for nicotine/marijuana in v1 | Slows logging | Event count only; optional later |
| Third-party SDKs/analytics/CDN scripts | CSP + privacy | Self-bundled, pinned deps |
| Showing an insight below sample thresholds or "causal" wording | Dishonest uncertainty | Show "gathering data (3 of 5 exposures)" progress instead |
| Nutrition/calorie tracking, weight, mood journaling essays | Scope creep (weight endpoint also buggy) | Meals/late-eating as a simple timestamped event only |

## Feature Dependencies

```
Phase 0 capability probe -> every Garmin-derived feature (granularity decides what is possible)
Ingest + store -> baselines -> Today view / trend charts
Baselines -> effect engine (deviations are the outcome variable)
Input events (logging) + ingest -> exposure windows -> effect estimation -> confounding flags
Effect estimation -> dose-response, timing sensitivity
Effect estimation -> Body Battery/Stress explanation (ranks contributors using Layer 3 estimates)
Effect estimation + explanations -> insight lifecycle -> suggested experiments -> tested/wrong feedback
Check-in (independent, ship early) -> later "metrics that predict my check-ins"
Activities (ingest) -> RPE prompt
Export/import -> required before relying on stored data (Safari eviction)
Key storage + expiry tracking -> sync
Quick-log UI -> needs input_type seed + event store only (can ship before engine)
```

Note: logging and check-in have no dependency on Garmin ingest working, so they can ship early; value comes from accumulating labeled history while engine is built.

## Quick-log UX notes (table-stakes detail)

- Home/Today has a fixed grid of the user's top inputs; one tap logs "now" with haptic-like confirmation and 5 s undo.
- Long-press or "…" opens sheet: time (default now; presets "1h ago", "last night"), count, optional note.
- Repeat-able items (caffeine) show today's count on the button.
- Late-night retro-logging: "Yesterday" tab to add missed events.
- Check-in is a card at top of Today until done; three 1-5 rows, one tap each.

## Insight presentation notes

- Card = one-sentence headline + effect in own units + "n of m occasions" + confidence chip; tap opens evidence (the specific days, chart with exposed days highlighted vs baseline band) and a suggested experiment.
- Statuses: new / seen / tested / dismissed; "wrong" feedback lowers rank.
- Empty/learning states are first-class ("need 3 more nights after evening use").
- Body Battery/Stress explanation: shown on Today when a day deviates; bar of ranked contributors plus a visible grey "unexplained" segment.

## MVP Recommendation

Prioritize:
1. Capability probe, ingest, export/import/delete (foundation, gate)
2. Baselines + "today vs you" (table stakes, immediate personal value)
3. Quick-log + daily check-in + RPE (start accumulating data early)
4. Effect engine with thresholds, windows, confounding flags (core differentiator)
5. Body Battery/Stress explanation + insight lifecycle with templates
6. PWA UI polish: trend charts, key-expiry warning

Defer: dose-response beyond caffeine/alcohol (data-limited), check-in-to-metric learning (needs months), anomaly detection (illness/overreaching), CSV export, ML.

## Sources

- Project brief: docs/insights-context.md, .planning/PROJECT.md (HIGH for project constraints)
- Competitor feature knowledge (Whoop Journal/Behavior Insights, Oura Readiness contributors/Tags, Bearable factors/correlations, Exist.io correlations, Garmin Body Battery/Stress/HRV Status): training data only, LOW-MEDIUM; not re-verified against current product pages
