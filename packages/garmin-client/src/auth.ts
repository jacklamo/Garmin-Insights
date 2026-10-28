import { GarminHttpError } from './errors';

export const BASE = 'https://personal.connectapi.garmin.com';
export const TOKEN_PATH = '/personalapitoken-service/personal-api/personal-api-key/token';

async function safeFetch(step: string, url: string, init: RequestInit, f: typeof fetch): Promise<Response> {
  try {
    return await f(url, init);
  } catch {
    throw new GarminHttpError(step, 0);
  }
}

export async function fetchToken(key: string, f: typeof fetch = fetch): Promise<string> {
  const res = await safeFetch('token', BASE + TOKEN_PATH, {
    method: 'POST',
    headers: { Accept: '*/*', Authorization: `ApiKey ${key}` },
  }, f);
  if (!res.ok) throw new GarminHttpError('token', res.status);
  let text = (await res.text()).trim();
  try {
    const j = JSON.parse(text);
    if (typeof j === 'string') text = j;
    else if (j && typeof j === 'object') text = String(j.token ?? j.access_token ?? j.jwt ?? text);
  } catch { /* bare JWT, not JSON */ }
  text = text.trim();
  if (!text) throw new GarminHttpError('token-empty', res.status);
  return text;
}

export function get(token: string, pathAndQuery: string, f: typeof fetch = fetch): Promise<Response> {
  return safeFetch('get', BASE + pathAndQuery, {
    headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
  }, f);
}

// Decodes claims only; no signature check. Never returns the token itself.
export function tokenExpiry(token: string): { exp: number; iat?: number } | null {
  try {
    const seg = token.split('.')[1];
    const b64 = seg.replace(/-/g, '+').replace(/_/g, '/');
    const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
    const p = JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0))));
    if (typeof p.exp !== 'number') return null;
    return typeof p.iat === 'number' ? { exp: p.exp, iat: p.iat } : { exp: p.exp };
  } catch {
    return null;
  }
}
