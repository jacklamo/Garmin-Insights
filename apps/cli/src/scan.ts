import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

export interface ScanOpts { secrets: string[]; ids: Iterable<string>; gitleaks?: string }

const JWT = /eyJ[\w-]+\.[\w-]+\.[\w-]+/;

// Throws on the first leak. Messages name the check and file, never the matched value.
export function scan(dir: string, o: ScanOpts): void {
  const ids = [...o.ids].filter((i) => i.length >= 6); // shorter values would match everywhere
  for (const f of readdirSync(dir, { recursive: true, withFileTypes: true })) {
    if (!f.isFile()) continue;
    const p = path.join(f.parentPath, f.name);
    const text = readFileSync(p, 'utf8');
    if (o.secrets.some((s) => s && text.includes(s))) throw new Error(`leak: key/token in ${p}`);
    if (JWT.test(text)) throw new Error(`leak: JWT-shaped string in ${p}`);
    if (ids.some((i) => new RegExp(`(?<![\\w])${i.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\w])`).test(text)))
      throw new Error(`leak: original ID value in ${p}`);
  }
  const r = spawnSync(o.gitleaks ?? 'gitleaks', ['dir', dir, '--no-banner', '--redact'], { encoding: 'utf8' });
  if (r.error) throw new Error('leak scan failed: gitleaks not runnable (install it / add to PATH)');
  if (r.status !== 0) throw new Error('leak: gitleaks flagged output');
}
