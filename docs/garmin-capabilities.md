# Garmin Personal API capabilities

Probed live on 2026-10-28 with a vivoactive 5 account: 101 of a 200-request cap, 2s between requests, no 429. Shapes are top-level field names only; no values are recorded here.

## Endpoints

| Endpoint | Status | Shape | Granularity | Verdict | Quirks |
|---|---|---|---|---|---|
| daily-summaries | ok (200) | `{data}` | per day, 8 rows | usable | |
| stress | ok (200) | list of `{calendarDate, values}` | per day, 8 rows | usable | `values` is a nested series |
| steps | ok (200) | list of `{calendarDate, totalSteps, totalDistance, stepGoal}` | per day, 8 rows | usable | |
| hydration | no_data (200) | empty list | none | no data on this account | 200 with `[]`, not 404 |
| sleep | ok (200) | single object `{id, calendarDate, sleepTimeSeconds, napTimeSeconds, sleepStartTimestampGMT, ...}` | one sleep per call | usable | window returned only 1 record |
| sleep-summaries | ok (200) | list of the same sleep objects | per sleep, 2 rows over 8 days | usable | rows missing for days without a recorded sleep |
| body-battery | ok (200) | list of `{date, charged, drained, startTimestampGMT, endTimestampGMT, ...}` | per day, 8 rows | usable | |
| heart-rate | ok (200) | `{calendarDate, startTimestampGMT, endTimestampGMT, maxHeartRate, minHeartRate, ...}` | intraday series, 460 points over 2 days | usable | |
| hrv | ok (204) | no body | none | empty for the probed day | 204 counts as ok but has nothing to parse |
| hrv-summaries | ok (200) | `{hrvSummaries, userProfilePk}` | per day | usable | |
| spo2 | ok (200) | `{calendarDate, startTimestampGMT, sleepStartTimestampGMT, ...}` | per day, 8 rows | usable | |
| wellness-activity-summaries | no_data (200) | empty list | none | no data on this account | |
| activities-search | ok (200) | list of `{activityId, activityName, startTimeLocal, startTimeGMT, activityType, ...}` | per activity | usable | paged by index, not by date |
| activity-detail | ok (200) | `{activityId, activityUUID, activityName, userProfileId, ...}` | per activity | usable | |
| activity-workouts | no_data (200) | empty list | none | no data on this account | |
| activity-download | skipped | none | none | not probed | binary file download, skipped to stay polite |
| weight | ok (200) | `{dailyWeightSummaries, totalAverage, ...}` | per day | usable but empty here | no weigh-ins in the window |
| weight-goals | no_data (200) | `{userGoals, userGoalRanges}` | none | no data on this account | |
| food-logs | ok (200) | `{mealDate, mealDetails, loggedFoodsWithServingSizes, ...}` | per day | usable but empty here | nothing logged |
| profile-settings | ok (200) | `{displayName, preferredLocale, measurementSystem, ...}` | single object | usable | contains identifying fields, scrub before committing |
| hr-zones | ok (200) | list of `{trainingMethod, restingHeartRateUsed, ...}` | single record | usable | |
| fitness-age | ok (200) | `{chronologicalAge, fitnessAge, previousFitnessAge, components, lastUpdated}` | single record | usable | |
| menstrual-summary | skipped | none | none | not probed | not applicable to this account |
| menstrual-dayview | skipped | none | none | not probed | not applicable to this account |

## Rate limits

No rate-limit headers were returned. Responses carry only generic Cloudflare and cache headers (`cf-cache-status`, `cf-ray`, `cache-control`, `date`, `server`, and similar). No 429 appeared in 101 requests at 2s spacing, so the real limit is unknown. Keep the 2s delay, the 200-request cap and stop-on-first-429 until it is measured.

## History depth

- `daily-summaries` and `stress`: about 127 days back.
- `sleep`, `body-battery`, `heart-rate`, `hrv`, `hrv-summaries`: at least 365 days. That is the probe's search limit, not a measured ceiling.
- `activities-search`: paged by index, so there is no date depth.
- Other endpoints: not measured.

## Token claims

The token lasts 86400 seconds (24 hours). Claim names: `managed_status`, `client_ecosystem`, `scope`, `iss`, `revocation_eligibility`, `client_type`, `exp`, `iat`, `garmin_guid`, `jti`, `client_id`. Values are not recorded.

## Sleep dating

Undetermined. Both sleep records returned (2026-10-21 and 2026-10-26) start and end on the same local day as `calendarDate`, so the sample cannot show whether Garmin dates a sleep by wake-up day or by start day. Re-test with a night that spans midnight before relying on either.

## CORS verdict

Blocked from a browser. On desktop (Edge 154) the token request from the origin `https://jacklamo.github.io` failed with a CORS error, so the page never reached the data endpoint. An `OPTIONS` preflight sent from the CLI with that Origin returned 403 for both the token and the data endpoints. Only the status was captured, not the response headers.

## Proxy go/no-go

Go. A client-only app cannot call Garmin directly, so a small proxy is needed. It would hold or forward the key in memory without logging it, and the key would transit the proxy. Whether a serverless Worker can do this was not tested. Recommend promoting the proxy work (V2-06).

## Shared-origin risk

`github.io` is shared by every Pages site. Anything stored in the browser on that origin, and any page-level script that runs there, sits next to other tenants' sites. The mitigations are a dedicated GitHub account or org, or a custom domain (V2-08). This risk is stated as the recommended position; the project owner has not yet signed off on accepting it.

## Browser matrix

| Browser | Origin | Result |
|---|---|---|
| Desktop (Edge 154, Windows) | `https://jacklamo.github.io` | token: FAIL cors |
| iPhone Safari | `https://jacklamo.github.io` | not tested; the owner chose not to enter the key on the phone. The block comes from Garmin's response to the preflight, so Safari is not expected to differ. |
