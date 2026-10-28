// Seed list from Garmin's Python client; the Swagger page lists ~26 - user adds the 2 missing in plan 07.
// Single source the probe iterates. Templates use {date} {start} {end} {id}.
export interface EndpointDef {
  name: string;
  path: string;
  params: 'none' | 'date' | 'range' | 'activityId';
  deep: boolean;
  skip?: 'binary' | 'irrelevant';
}

export const ENDPOINTS: EndpointDef[] = [
  { name: 'daily-summaries', path: '/usersummary-service/v2/dailysummaries?startDate={start}&endDate={end}', params: 'range', deep: true },
  { name: 'stress', path: '/usersummary-service/stats/stress/daily/{start}/{end}', params: 'range', deep: true },
  { name: 'steps', path: '/usersummary-service/stats/steps/daily/{start}/{end}', params: 'range', deep: false },
  { name: 'hydration', path: '/usersummary-service/stats/hydration/daily/{start}/{end}', params: 'range', deep: false },
  { name: 'sleep', path: '/sleep-service/sleep/dailySleep?date={date}', params: 'date', deep: true },
  { name: 'sleep-summaries', path: '/sleep-service/sleep/dailySleepSummariesByDate?startDate={start}&endDate={end}', params: 'range', deep: false },
  { name: 'body-battery', path: '/wellness-service/wellness/bodyBattery/reports/daily?startDate={start}&endDate={end}', params: 'range', deep: true },
  { name: 'heart-rate', path: '/wellness-service/wellness/dailyHeartRate?date={date}', params: 'date', deep: true },
  { name: 'hrv', path: '/hrv-service/hrv/{date}', params: 'date', deep: true },
  { name: 'hrv-summaries', path: '/hrv-service/hrv/daily/{start}/{end}', params: 'range', deep: true },
  { name: 'spo2', path: '/wellness-service/wellness/daily/spo2acclimation/{date}', params: 'date', deep: false },
  { name: 'wellness-activity-summaries', path: '/wellnessactivity-service/activity/summary/range/{start}/{end}', params: 'range', deep: false },
  { name: 'activities-search', path: '/activitylist-service/activities/search/activities?start=0&limit=20', params: 'none', deep: true },
  { name: 'activity-detail', path: '/activity-service/activity/{id}', params: 'activityId', deep: false },
  { name: 'activity-workouts', path: '/activity-service/activity/{id}/workouts', params: 'activityId', deep: false },
  { name: 'activity-download', path: '/download-service/files/activity/{id}', params: 'activityId', deep: false, skip: 'binary' },
  { name: 'weight', path: '/weight-service/weight/range/{start}/{end}?includeAll=true', params: 'range', deep: false },
  { name: 'weight-goals', path: '/goal-service/goal/user/effective/weightgoal/{start}/{end}', params: 'range', deep: false },
  { name: 'food-logs', path: '/nutrition-service/food/logs/{date}', params: 'date', deep: false },
  { name: 'profile-settings', path: '/userprofile-service/userprofile/settings', params: 'none', deep: false },
  { name: 'hr-zones', path: '/biometric-service/heartRateZones/v2', params: 'none', deep: false },
  { name: 'fitness-age', path: '/fitnessage-service/fitnessage/v2/{date}', params: 'date', deep: false },
  { name: 'menstrual-summary', path: '/periodichealth-service/menstrualcycle/summary/{date}', params: 'date', deep: false, skip: 'irrelevant' },
  { name: 'menstrual-dayview', path: '/periodichealth-service/menstrualcycle/dayview/{date}?todayDate={date}', params: 'date', deep: false, skip: 'irrelevant' },
];

export interface PathArgs { date?: string; start?: string; end?: string; activityId?: string | number }

export function buildPath(def: EndpointDef, a: PathArgs): string {
  const vals: Record<string, string | number | undefined> = { date: a.date, start: a.start, end: a.end, id: a.activityId };
  return def.path.replace(/\{(\w+)\}/g, (_, k: string) => {
    const v = vals[k];
    if (v === undefined) throw new Error(`missing param ${k} for ${def.name}`);
    return String(v);
  });
}
