export type DayResult = 'data' | 'none' | 'refused';
export interface DepthResult { days: number | null; note: string; steps: number }

const LADDER = [7, 14, 30, 60, 120, 240, 365];

// hasData(daysBack) is asked for one day at a time. A miss only counts when 3 older
// adjacent days are also empty, so a single gap day is not mistaken for the floor.
export async function findDepth(
  hasData: (daysBack: number) => Promise<DayResult>,
  opts: { maxSteps?: number; deviceStartDays?: number } = {},
): Promise<DepthResult> {
  const max = opts.maxSteps ?? 10;
  let steps = 0;
  let refused = false;
  const isMiss = async (d: number): Promise<boolean> => {
    steps++;
    const r = await hasData(d);
    if (r === 'refused') { refused = true; return true; }
    if (r === 'data') return false;
    for (const k of [1, 2, 3]) {
      if ((await hasData(d + k)) === 'data') return false;
    }
    return true;
  };
  const done = (days: number | null, note: string): DepthResult => ({ days, note, steps });
  let lo = 0;
  let hi: number | null = null;
  for (const d of LADDER) {
    if (steps >= max) break;
    if (await isMiss(d)) { hi = d; break; }
    lo = d;
  }
  if (refused) return done(lo || null, `range refused at ${hi} days`);
  if (hi === null) return done(lo, `>= ${lo} days (search limit)`);
  while (hi - lo > 1 && steps < max) {
    const mid = Math.floor((lo + hi) / 2);
    if (await isMiss(mid)) hi = mid; else lo = mid;
    if (refused) return done(lo || null, `range refused at ${hi} days`);
  }
  const hint = opts.deviceStartDays !== undefined && Math.abs(lo - opts.deviceStartDays) <= 7
    ? '; floor equals device start' : '';
  return done(lo, `about ${lo} days${hint}`);
}
