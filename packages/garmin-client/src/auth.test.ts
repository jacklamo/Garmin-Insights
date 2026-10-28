import { describe, it, expect } from 'vitest';
import { fetchToken, tokenExpiry, get } from './auth.js';
import { GarminHttpError } from './errors.js';

const key = 'k' + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
const stub = (status: number, body: string) => (async () => new Response(body, { status })) as unknown as typeof fetch;
const b64u = (o: object) => btoa(JSON.stringify(o)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

describe('fetchToken', () => {
  it('trims bare JWT', async () => expect(await fetchToken(key, stub(200, 'aaa.bbb.ccc\n'))).toBe('aaa.bbb.ccc'));
  it('tolerates JSON wrapped', async () => {
    expect(await fetchToken(key, stub(200, '{"token":"a.b.c"}'))).toBe('a.b.c');
    expect(await fetchToken(key, stub(200, '"a.b.c"'))).toBe('a.b.c');
  });
  it('401 error leaks nothing', async () => {
    const err = await fetchToken(key, stub(401, 'nope')).catch((e: any) => e);
    expect(err).toBeInstanceOf(GarminHttpError);
    for (const s of [String(err), err.message, JSON.stringify(err)]) {
      expect(s).not.toContain(key);
      expect(s).not.toMatch(/ApiKey|Bearer/);
    }
  });
  it('sanitizes rejected fetch', async () => {
    const bad = (async () => { throw new Error(`boom Authorization: ApiKey ${key} https://x?token=zzz`); }) as unknown as typeof fetch;
    const err = await fetchToken(key, bad).catch((e: any) => e);
    expect(err).toBeInstanceOf(GarminHttpError);
    expect(err.status).toBe(0);
    expect(String(err) + JSON.stringify(err)).not.toMatch(new RegExp(`${key}|ApiKey|zzz`));
    const err2 = await get('tok' + key, '/x?y=1', bad).catch((e: any) => e);
    expect(String(err2)).not.toContain(key);
  });
});

describe('tokenExpiry', () => {
  it('decodes exp/iat', () => expect(tokenExpiry(`h.${b64u({ exp: 200, iat: 100 })}.s`)).toEqual({ exp: 200, iat: 100 }));
  it('null on garbage', () => {
    expect(tokenExpiry('garbage')).toBeNull();
    expect(tokenExpiry('a.!!!.c')).toBeNull();
  });
});
