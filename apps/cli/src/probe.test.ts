import { describe, expect, it } from 'vitest';
import { runProbe, pickHeaders } from './probe.js';

const jwt = (p: object) => ['h', Buffer.from(JSON.stringify(p)).toString('base64url'), 's'].join('.');
const fakeKey = 'fake-' + Math.random().toString(36).slice(2);
const TOKEN = jwt({ exp: 1100, iat: 1000, sub: 'x' });

function setup(handler: (url: string, n: number) => Response) {
  const calls: string[] = [];
  const sleeps: number[] = [];
  const files: Record<string, string> = {};
  const lines: string[] = [];
  const fetchStub = (async (url: string) => {
    calls.push(url);
    if (url.includes('personal-api-key/token')) return new Response(TOKEN);
    return handler(url, calls.length);
  }) as unknown as typeof fetch;
  const deps = {
    key: fakeKey, dir: '/out/run', fetch: fetchStub, now: () => Date.parse('2026-06-01T12:00:00Z'),
    sleep: async (ms: number) => { sleeps.push(ms); },
    write: (f: string, c: string) => { files[f] = c; }, out: (l: string) => lines.push(l),
  };
  return { calls, sleeps, files, lines, deps };
}
const json = (b: unknown, status = 200, h: Record<string, string> = {}) =>
  new Response(JSON.stringify(b), { status, headers: { 'content-type': 'application/json', ...h } });

describe('runProbe', () => {
  it('delays between calls, writes raw files, leaks nothing', async () => {
    const s = setup((url) => json(
      url.includes('activities/search') ? [{ activityId: 7 }] : { a: [{ d: '2026-05-01' }] },
      200, { 'set-cookie': 'secret=1', 'x-ratelimit-remaining': '9' },
    ));
    const r = await runProbe({ ...s.deps, cap: 400 });
    expect(s.sleeps.every((x) => x === 2000)).toBe(true);
    expect(s.files['/out/run/profile-settings.json']).toBeDefined();
    expect(s.files['/out/run/profile-settings.headers.json']).toContain('x-ratelimit-remaining');
    expect(s.files['/out/run/profile-settings.headers.json']).not.toMatch(/set-cookie|secret/i);
    expect(r.used).toBeLessThanOrEqual(400);
    const all = s.lines.join('\n');
    expect(all).not.toContain(fakeKey);
    expect(all).not.toContain(TOKEN);
    expect(all).not.toContain('2026-05-01');
    expect(all).toMatch(/lifetime 100s/);
  });
  it('never exceeds cap', async () => {
    const s = setup(() => json({ a: [1] }));
    const r = await runProbe({ ...s.deps, cap: 5 });
    expect(r.used).toBeLessThanOrEqual(5);
    expect(s.calls.length).toBeLessThanOrEqual(5);
    expect(r.stopped).toMatch(/cap/);
  });
  it('stops on first 429 keeping partial results', async () => {
    const s = setup((_, n) => (n === 4 ? new Response('', { status: 429 }) : json({ a: [1] })));
    const r = await runProbe({ ...s.deps, cap: 100 });
    expect(r.stopped).toMatch(/429/);
    expect(s.calls.length).toBe(4);
    expect(s.files['/out/run/results.json']).toBeDefined();
  });
  it('retries 5xx once, never 4xx, continues past 400', async () => {
    const hits: Record<string, number> = {};
    const s = setup((url) => {
      hits[url] = (hits[url] ?? 0) + 1;
      if (url.includes('dailysummaries')) return new Response('', { status: 503 });
      if (url.includes('stats/stress')) return new Response('', { status: 400 });
      return json({ a: [1] });
    });
    const r = await runProbe({ ...s.deps, cap: 12 });
    const n = (frag: string) => Object.entries(hits).find(([u]) => u.includes(frag))![1];
    expect(n('dailysummaries')).toBe(2);
    expect(n('stats/stress')).toBe(1);
    expect(r.findings.find((x) => x.endpoint === 'stress')?.status).toBe('error');
    expect(r.findings.length).toBeGreaterThan(2);
  });
  it('pickHeaders drops set-cookie', () => {
    const h = pickHeaders(new Headers({ 'set-cookie': 'a=b', server: 'x', 'x-other': 'y' }));
    expect(h.names).not.toContain('set-cookie');
    expect(h.values).toEqual({ server: 'x' });
  });
});
