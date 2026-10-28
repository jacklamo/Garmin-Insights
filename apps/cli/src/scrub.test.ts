import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { scan } from './scan.js';
import { scrub } from './scrub.js';

// All secrets are built at runtime so no literal secret-shaped string lives in the repo.
const jwt = ['eyJ' + 'hbGciOiJIUzI1NiJ9', 'eyJ' + 'zdWIiOiIxMjM0NTYifQ', 'c2lnbmF0dXJl'].join('.');
const KEY = 'k'.repeat(8) + '-' + 'fake-key-' + '9'.repeat(10);
const rnd = (n: number): string => Array.from({ length: n }, () => 'aZ3kQ9xLmP7wRt2vBn5cYd8fGh4jSe6uHq1'[Math.floor(Math.random() * 35)]).join('');

const sample = {
  userProfileId: 987654321,
  displayName: 'Jane Q Tester',
  activityName: 'Morning run with Bob',
  birthDate: '1990-05-05',
  weight: 70000,
  accessToken: jwt,
  calendarDate: '2026-03-10',
  startTimeGMT: 1773100800000,
  startTimeLocal: 1773082800000,
  latitude: 40.1234,
  polyline: 'abcdef',
  stress: -2,
  restingHR: null,
  nested: { activityId: 555000111, owner: { userId: 987654321 } },
  days: [1, 2, 3, 4, 5].map((i) => ({ calendarDate: `2026-03-0${i}`, v: i })),
  hrValues: [[1773100800000, 60], [1773100860000, 61], [1773100920000, 62], [1773100980000, 63]],
};

let run: string;
let out: string;
beforeEach(() => {
  const d = mkdtempSync(path.join(tmpdir(), 'scrub-'));
  run = path.join(d, 'run');
  out = path.join(d, 'out');
  mkdirSync(run);
  writeFileSync(path.join(run, 'daily.json'), JSON.stringify(sample));
  writeFileSync(path.join(run, 'daily.headers.json'), JSON.stringify({ status: 200, names: ['content-type'], values: { 'set-cookie': 'sid=' + jwt } }));
});
const read = (f: string): any => JSON.parse(readFileSync(path.join(out, f), 'utf8'));

describe('scrub', () => {
  it('removes identifiers, preserves shape, shifts dates uniformly', () => {
    scrub(run, out, { seed: 1, secrets: [KEY, jwt] });
    const o = read('daily.json');
    expect(o.userProfileId).toBe(o.nested.owner.userId); // consistent pseudonym
    expect(o.userProfileId).not.toBe(987654321);
    expect(o.displayName).toMatch(/^id-/);
    expect(o.activityName).toBe('<redacted>');
    expect(o.accessToken).toBe('<redacted>');
    for (const k of ['birthDate', 'weight', 'latitude', 'polyline']) expect(k in o).toBe(false);
    expect(o.stress).toBe(-2);
    expect(o.restingHR).toBeNull();
    expect(o.days).toHaveLength(3);
    expect(o.hrValues).toHaveLength(4);
    // GMT and local shifted by the same amount; calendarDate by the same number of days.
    const dg = o.startTimeGMT - sample.startTimeGMT;
    expect(dg).toBe(o.startTimeLocal - sample.startTimeLocal);
    expect(dg % 86_400_000).toBe(0);
    expect((Date.parse(o.calendarDate) - Date.parse(sample.calendarDate))).toBe(dg);
    expect(read('daily.headers.json')).toEqual({ status: 200, names: ['content-type'] });
  });

  it('is deterministic with a seed', () => {
    scrub(run, out, { seed: 7 });
    const a = readFileSync(path.join(out, 'daily.json'), 'utf8');
    scrub(run, out, { seed: 7 });
    expect(readFileSync(path.join(out, 'daily.json'), 'utf8')).toBe(a);
  });
});

describe('scan', () => {
  const plant = (text: string): void => {
    mkdirSync(out, { recursive: true });
    writeFileSync(path.join(out, 'x.json'), JSON.stringify({ v: text }));
  };
  const opts = { secrets: [KEY], ids: ['987654321'] };

  it('passes clean output', () => {
    plant('nothing here');
    expect(() => scan(out, opts)).not.toThrow();
  });
  it('fails on key', () => { plant(KEY); expect(() => scan(out, opts)).toThrow(/key\/token/); });
  it('fails on in-memory token', () => { plant('t ' + 'tok'.repeat(5)); expect(() => scan(out, { ...opts, secrets: ['tok'.repeat(5)] })).toThrow(/key\/token/); });
  it('fails on JWT shape', () => { plant(jwt); expect(() => scan(out, opts)).toThrow(/JWT/); });
  it('fails on original ID', () => { plant('id 987654321 here'); expect(() => scan(out, opts)).toThrow(/original ID/); });
  it('fails on gitleaks hit', () => { plant('ghp_' + rnd(36)); expect(() => scan(out, opts)).toThrow(/gitleaks/); });
  it('fails when gitleaks is missing', () => {
    plant('ok');
    expect(() => scan(out, { ...opts, gitleaks: 'no-such-gitleaks-bin' })).toThrow(/not runnable/);
  });
});
