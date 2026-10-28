import { randomInt } from 'node:crypto';
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { scan } from './scan.js';

const ID_KEY = /^(userProfileId|userId|displayName|fullName|firstName|lastName|email|ownerId|deviceId|serial\w*|unitId|activityId|uuid|guid)$/;
const SECRET_KEY = /^(accessToken|token|apiKey|authorization)$/i;
const GEO_KEY = /^(lat|lon|lng|latitude|longitude|\w*polyline\w*|geoPoly\w*|\w*(Lat|Lon|Latitude|Longitude))$/i;
const TEXT_KEY = /^(activityName|name|description|notes?|comment)$/;
const DROP_KEY = /^(birthDate|weight|height|gender)$/;
const TIME_KEY = /(GMT|Local|Timestamp|Time)$/;
const DAY = 86_400_000;
const DATE = /^(\d{4})-(\d{2})-(\d{2})(?=$|[T ])/;

// mulberry32: tiny seeded PRNG, only used so tests can pin the date offset.
function rng(seed: number): () => number {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function scrub(runDir: string, outDir: string, o: { seed?: number; secrets?: string[]; gitleaks?: string } = {}): void {
  const days = 30 + (o.seed === undefined ? randomInt(300) : Math.floor(rng(o.seed)() * 300));
  const ids = new Set<string>();
  const pseudo = new Map<string, string | number>();
  const alias = (v: string | number): string | number => {
    ids.add(String(v));
    const k = `${typeof v}:${v}`;
    if (!pseudo.has(k)) pseudo.set(k, typeof v === 'number' ? pseudo.size + 1 : `id-${pseudo.size + 1}`);
    return pseudo.get(k)!;
  };
  const shiftDate = (s: string): string =>
    s.replace(DATE, (_, y, m, d) => new Date(Date.UTC(+y, +m - 1, +d) + days * DAY).toISOString().slice(0, 10));

  const walk = (v: unknown, key = ''): unknown => {
    if (Array.isArray(v)) {
      // shortcut: only per-day record arrays are trimmed; intraday arrays stay full. Revisit if a file is huge.
      const perDay = v.length > 3 && v.every((e) => e && typeof e === 'object' && 'calendarDate' in e);
      return (perDay ? v.slice(0, 3) : v).map((e) => walk(e, key));
    }
    if (v && typeof v === 'object') {
      const out: Record<string, unknown> = {};
      for (const [k, x] of Object.entries(v)) {
        if (GEO_KEY.test(k) || DROP_KEY.test(k)) continue;
        out[k] = walk(x, k);
      }
      return out;
    }
    if (v === null || v === undefined) return v;
    if (SECRET_KEY.test(key)) return '<redacted>';
    if (ID_KEY.test(key) && (typeof v === 'string' || typeof v === 'number')) return alias(v);
    if (TEXT_KEY.test(key) && typeof v === 'string') return '<redacted>';
    if (typeof v === 'number' && TIME_KEY.test(key) && String(Math.trunc(v)).length === 13) return v + days * DAY;
    if (typeof v === 'string') return DATE.test(v) ? shiftDate(v) : v;
    return v;
  };

  mkdirSync(outDir, { recursive: true });
  for (const f of readdirSync(runDir)) {
    if (!f.endsWith('.json') || f === 'results.json' || f === 'preflight.json') continue;
    const raw = JSON.parse(readFileSync(path.join(runDir, f), 'utf8')) as unknown;
    // Headers: names only, values dropped (cookies, auth, etc.).
    const body = f.endsWith('.headers.json')
      ? { status: (raw as { status?: unknown }).status, names: (raw as { names?: unknown }).names }
      : walk(raw);
    writeFileSync(path.join(outDir, f), JSON.stringify(body, null, 2));
  }
  scan(outDir, { secrets: o.secrets ?? [], ids, gitleaks: o.gitleaks });
}
