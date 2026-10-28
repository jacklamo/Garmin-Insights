import { readFileSync } from 'node:fs';
import type { Finding } from './probe.js';

export function formatTable(fs: Finding[]): string {
  const rows = [['endpoint', 'status', 'http', 'count', 'dates', 'ms'], ...fs.map((x) => [
    x.endpoint, x.status, String(x.http), String(x.count), x.dateMin ? `${x.dateMin}..${x.dateMax}` : '-', String(x.latencyMs),
  ])];
  const w = rows[0].map((_, i) => Math.max(...rows.map((r) => r[i].length)));
  return rows.map((r) => r.map((c, i) => c.padEnd(w[i])).join('  ')).join('\n');
}

function shapeSummary(s: unknown): string {
  if (Array.isArray(s)) return `list of ${shapeSummary(s[0])}`.slice(0, 80);
  if (s && typeof s === 'object') return `{${Object.keys(s).slice(0, 8).join(', ')}}`;
  return String(s);
}

export function renderSkeleton(runDir: string): string {
  const { findings } = JSON.parse(readFileSync(`${runDir}/results.json`, 'utf8')) as { findings: Finding[] };
  const lines = [
    '# Garmin API capabilities (generated skeleton)', '',
    '| Endpoint | Status | Shape | Granularity | Rate-limit headers | History depth | Verdict | Quirks |',
    '|---|---|---|---|---|---|---|---|',
    ...findings.map((x) => `| ${x.endpoint} | ${x.status} (${x.http}) | ${shapeSummary(x.shape)} | ${x.count} records (guess) | ${Object.keys(x.rateHeaders).join(', ') || '-'} | ${x.depth?.note ?? '-'} |  |  |`),
    '', 'Verdict:', 'Quirks:', '',
  ];
  for (const s of ['CORS verdict', 'Proxy go/no-go', 'Shared-origin risk', 'Browser matrix', 'Sleep dating', 'Token claims']) lines.push(`## ${s}`, '', '');
  return lines.join('\n');
}
