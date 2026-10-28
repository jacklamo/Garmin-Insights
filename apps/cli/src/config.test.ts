import { describe, expect, it } from 'vitest';
import path from 'node:path';
import { insideRepo, loadConfig } from './config.js';

const root = path.resolve('/r/repo');
const fakeKey = ['k', 'e', 'y'].join('') + Date.now();

describe('config', () => {
  it('insideRepo', () => {
    expect(insideRepo('/r/repo/x/.env', root)).toBe(true);
    expect(insideRepo('/r/other/.env', root)).toBe(false);
  });
  it('refuses env file inside repo', () => {
    expect(() => loadConfig({ INSIGHTS_ENV_FILE: '/r/repo/.env', INSIGHTS_DATA_DIR: '/r/o' }, root, () => {})).toThrow(/env file/);
  });
  it('refuses data dir inside repo', () => {
    expect(() => loadConfig({ INSIGHTS_ENV_FILE: '/r/o/.env', INSIGHTS_DATA_DIR: '/r/repo/runs' }, root, () => {})).toThrow(/raw-output/);
  });
  it('loads key without echoing it in errors', () => {
    const env: NodeJS.ProcessEnv = { INSIGHTS_ENV_FILE: '/r/o/.env', INSIGHTS_DATA_DIR: '/r/o/runs' };
    expect(() => loadConfig(env, root, () => {})).toThrow(/GARMIN_PERSONAL_API_KEY/);
    const c = loadConfig(env, root, () => { env.GARMIN_PERSONAL_API_KEY = fakeKey; });
    expect(c.key).toBe(fakeKey);
  });
});
