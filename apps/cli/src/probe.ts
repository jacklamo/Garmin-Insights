import { BASE, ENDPOINTS, TOKEN_PATH, buildPath, classify, fetchToken, get, type EndpointDef, type Status } from '@insights/garmin-client';
import { findDepth, type DayResult, type DepthResult } from './depth.js';

const KEEP_VALUE = /ratelimit|retry-after|x-.*limit|x-.*remaining|date|server|cf-|access-control/i;
const DAY = 86_400_000;

export interface Finding {
  endpoint: string;
  status: Status | 'skipped';
  http: number;
  count: number;
  dateMin?: string;
  dateMax?: string;
  latencyMs: number;
  contentType: string;
  headerNames: string[];
  rateHeaders: Record<string, string>;
  shape: unknown;
  depth?: DepthResult;
  note?: string;
}

export interface ProbeDeps {
  key: string;
  dir: string; // timestamped run folder, already outside the repo
  fetch?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  write: (file: string, content: string) => void;
  out?: (line: string) => void;
  delayMs?: number;
  cap?: number;
}

class Stop extends Error {}

export function shapeOf(v: unknown, d = 0): unknown {
  if (Array.isArray(v)) return v.length && d < 4 ? [shapeOf(v[0], d + 1)] : [];
  if (v && typeof v === 'object') {
    if (d >= 4) return 'object';
    return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, shapeOf(x, d + 1)]));
  }
  return v === null ? 'null' : typeof v;
}

export function countOf(v: unknown): number {
  if (Array.isArray(v)) return v.length;
  if (v && typeof v === 'object') {
    const lens = Object.values(v).filter(Array.isArray).map((a) => a.length);
    return lens.length ? Math.max(...lens) : Object.keys(v).length ? 1 : 0;
  }
  return v == null ? 0 : 1;
}

export function dateRange(v: unknown): { min?: string; max?: string } {
  let min: string | undefined;
  let max: string | undefined;
  const walk = (x: unknown): void => {
    if (typeof x === 'string') {
      const m = /^\d{4}-\d{2}-\d{2}/.exec(x);
      if (m) {
        if (!min || m[0] < min) min = m[0];
        if (!max || m[0] > max) max = m[0];
      }
    } else if (Array.isArray(x)) x.forEach(walk);
    else if (x && typeof x === 'object') Object.values(x).forEach(walk);
  };
  walk(v);
  return { min, max };
}

export function pickHeaders(h: Headers): { names: string[]; values: Record<string, string> } {
  const names: string[] = [];
  const values: Record<string, string> = {};
  h.forEach((val, name) => {
    if (name.toLowerCase() === 'set-cookie') return;
    names.push(name);
    if (KEEP_VALUE.test(name)) values[name] = val;
  });
  return { names, values };
}

function claims(token: string): Record<string, unknown> {
  try {
    const b64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4)));
  } catch {
    return {};
  }
}

const ymd = (ms: number): string => new Date(ms).toISOString().slice(0, 10);

const skipped = (endpoint: string, note: string): Finding => ({
  endpoint, status: 'skipped', http: 0, count: 0, latencyMs: 0, contentType: '', headerNames: [], rateHeaders: {}, shape: null, note,
});

export async function runProbe(deps: ProbeDeps): Promise<{ findings: Finding[]; stopped?: string; used: number }> {
  const f = deps.fetch ?? fetch;
  const sleep = deps.sleep ?? ((ms) => new Promise<void>((r) => setTimeout(r, ms)));
  const now = deps.now ?? Date.now;
  const out = deps.out ?? ((l) => process.stdout.write(l + '\n'));
  const delay = deps.delayMs ?? 2000;
  const cap = deps.cap ?? 200;
  let used = 0;

  // Token lives only in this local; only lifetime and claim NAMES are printed.
  const token = await fetchToken(deps.key, f);
  used++;
  const c = claims(token);
  const life = typeof c.exp === 'number' && typeof c.iat === 'number' ? `${c.exp - c.iat}s` : 'unknown';
  out(`token lifetime ${life}; claims: ${Object.keys(c).join(', ') || 'none'}`);

  async function call(path: string) {
    for (let attempt = 0; ; attempt++) {
      if (used >= cap) throw new Stop('request cap reached');
      await sleep(delay);
      used++;
      const t0 = now();
      let status = 0;
      let text = '';
      let headers = new Headers();
      try {
        const r = await get(token, path, f);
        status = r.status;
        headers = r.headers;
        text = await r.text();
      } catch {
        /* network failure: status 0 */
      }
      const latencyMs = now() - t0;
      if (status === 429) throw new Stop('429 rate limited');
      if ((status >= 500 || status === 0) && attempt === 0) continue;
      let body: unknown = text;
      try { body = JSON.parse(text); } catch { /* non-JSON */ }
      return { status, text, body, headers, latencyMs };
    }
  }

  const findings: Finding[] = [];
  let stopped: string | undefined;
  let activityId: string | number | undefined;
  const t = now();
  const yesterday = ymd(t - DAY);
  const weekAgo = ymd(t - 8 * DAY);

  const depthFor = (def: EndpointDef): Promise<DepthResult> =>
    findDepth(async (d): Promise<DayResult> => {
      const day = ymd(t - d * DAY);
      const r = await call(buildPath(def, { date: day, start: day, end: day }));
      if (r.status === 400) return 'refused';
      return classify(r.status, r.body) === 'ok' ? 'data' : 'none';
    });

  try {
    for (const def of ENDPOINTS) {
      if (def.skip) { findings.push(skipped(def.name, def.skip)); continue; }
      if (def.params === 'activityId' && activityId === undefined) { findings.push(skipped(def.name, 'no activity id')); continue; }
      const r = await call(buildPath(def, { date: yesterday, start: weekAgo, end: yesterday, activityId }));
      const { names, values } = pickHeaders(r.headers);
      const base = `${deps.dir}/${def.name}`;
      deps.write(`${base}.json`, r.text);
      deps.write(`${base}.headers.json`, JSON.stringify({ status: r.status, names, values }, null, 2));
      const dr = dateRange(r.body);
      const status = classify(r.status, r.body);
      const fd: Finding = {
        endpoint: def.name, status, http: r.status, count: countOf(r.body), dateMin: dr.min, dateMax: dr.max,
        latencyMs: r.latencyMs, contentType: r.headers.get('content-type') ?? '', headerNames: names, rateHeaders: values, shape: shapeOf(r.body),
      };
      findings.push(fd);
      if (def.name === 'activities-search' && Array.isArray(r.body) && r.body[0]) {
        activityId = (r.body[0] as { activityId?: number }).activityId;
      }
      if (def.deep && status === 'ok') {
        fd.depth = def.params === 'none' ? { days: null, note: 'paged by index, no date depth', steps: 0 } : await depthFor(def);
      }
    }
  } catch (e) {
    if (!(e instanceof Stop)) throw e;
    stopped = e.message;
  }
  out(`requests used ${used}/${cap} (${cap - used} remaining)${stopped ? `; STOPPED: ${stopped}` : ''}`);
  deps.write(`${deps.dir}/results.json`, JSON.stringify({ stopped, used, findings }, null, 2));
  return { findings, stopped, used };
}

// One-time CORS preflight capture; stores only status + Access-Control-* header values.
export async function preflight(origin: string, dir: string, write: (f: string, c: string) => void, f: typeof fetch = fetch): Promise<void> {
  const res: Record<string, Record<string, string>> = {};
  const dataPath = buildPath(ENDPOINTS.find((e) => e.name === 'profile-settings')!, {});
  for (const [name, path] of [['token', TOKEN_PATH], ['data', dataPath]] as const) {
    const r = await f(BASE + path, {
      method: 'OPTIONS',
      headers: { Origin: origin, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'authorization' },
    });
    const acl: Record<string, string> = { status: String(r.status) };
    r.headers.forEach((v, k) => { if (k.toLowerCase().startsWith('access-control')) acl[k] = v; });
    res[name] = acl;
  }
  write(`${dir}/preflight.json`, JSON.stringify(res, null, 2));
}
