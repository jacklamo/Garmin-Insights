import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { loadConfig } from './config.js';
import { preflight, runProbe } from './probe.js';
import { formatTable, renderSkeleton } from './report.js';

const write = (file: string, content: string): void => {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, content);
};

async function main(argv: string[]): Promise<void> {
  const [cmd, arg] = argv;
  if (cmd === 'probe') {
    const cfg = loadConfig();
    const dir = path.join(cfg.dataDir, new Date().toISOString().replace(/:/g, '-'));
    if (cfg.pagesOrigin) await preflight(cfg.pagesOrigin, dir, write);
    else process.stdout.write('INSIGHTS_PAGES_ORIGIN unset: skipping CORS preflight capture\n');
    const r = await runProbe({ key: cfg.key, dir, write });
    process.stdout.write(formatTable(r.findings) + `\nrun folder: ${dir}\n`);
  } else if (cmd === 'report' && arg) {
    process.stdout.write(renderSkeleton(arg));
  } else {
    process.stderr.write('usage: main.ts probe | report <runDir>\n');
    process.exitCode = 1;
  }
}

main(process.argv.slice(2)).catch((e: unknown) => {
  // Client errors carry fixed messages; print the message only, never the object.
  process.stderr.write(`error: ${e instanceof Error ? e.message : 'unknown'}\n`);
  process.exitCode = 1;
});
