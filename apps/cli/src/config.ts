import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

export function insideRepo(p: string, root = REPO_ROOT): boolean {
  const rel = path.relative(root, path.resolve(p));
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

export interface Config { key: string; dataDir: string; pagesOrigin?: string }

// load is injectable for tests; the real one populates process.env from the file.
export function loadConfig(
  env: NodeJS.ProcessEnv = process.env,
  root = REPO_ROOT,
  load: (f: string) => void = (f) => process.loadEnvFile(f),
): Config {
  const base = path.join(env.LOCALAPPDATA ?? '', 'insights');
  const envFile = env.INSIGHTS_ENV_FILE ?? path.join(base, '.env');
  const dataDir = env.INSIGHTS_DATA_DIR ?? path.join(base, 'runs');
  if (insideRepo(envFile, root)) throw new Error('Refusing to run: env file is inside the repo');
  if (insideRepo(dataDir, root)) throw new Error('Refusing to run: raw-output dir is inside the repo');
  try { load(envFile); } catch { throw new Error('Could not read env file (set INSIGHTS_ENV_FILE)'); }
  const key = env.GARMIN_PERSONAL_API_KEY;
  if (!key) throw new Error('GARMIN_PERSONAL_API_KEY not set in env file');
  return { key, dataDir, pagesOrigin: env.INSIGHTS_PAGES_ORIGIN };
}
