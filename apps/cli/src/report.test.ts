import { describe, expect, it } from 'vitest';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { formatTable, renderSkeleton } from './report.js';
import type { Finding } from './probe.js';

const f: Finding = {
  endpoint: 'sleep', status: 'ok', http: 200, count: 3, dateMin: '2026-05-01', dateMax: '2026-05-03', latencyMs: 120,
  contentType: 'application/json', headerNames: [], rateHeaders: { 'x-ratelimit-remaining': '1' }, shape: { a: 'number' },
  depth: { days: 90, note: 'about 90 days', steps: 8 },
};

describe('report', () => {
  it('table has one row per finding plus header', () => {
    expect(formatTable([f]).split('\n')).toHaveLength(2);
  });
  it('skeleton from a synthetic run folder', () => {
    const d = mkdtempSync(path.join(tmpdir(), 'run-'));
    writeFileSync(path.join(d, 'results.json'), JSON.stringify({ findings: [f] }));
    const md = renderSkeleton(d);
    expect(md).toContain('| sleep | ok (200)');
    expect(md).toContain('about 90 days');
    for (const s of ['Verdict:', 'Quirks:', 'CORS verdict', 'Proxy go/no-go', 'Shared-origin risk', 'Browser matrix', 'Sleep dating', 'Token claims']) {
      expect(md).toContain(s);
    }
  });
});
