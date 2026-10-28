export type Status = 'ok' | 'no_data' | 'access_denied' | 'rate_limited' | 'error';

export function isEmpty(v: unknown): boolean {
  if (v === null || v === undefined) return true;
  if (Array.isArray(v)) return v.length === 0;
  if (typeof v === 'object') return Object.values(v as object).every(isEmpty);
  return false;
}

export function classify(status: number, body: unknown): Status {
  if (status === 429) return 'rate_limited';
  if (status === 401 || status === 403) return 'access_denied';
  if (status >= 200 && status < 300) return isEmpty(body) ? 'no_data' : 'ok';
  return 'error';
}
