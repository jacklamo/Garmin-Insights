import { describe, it, expect } from 'vitest';
import { ENDPOINTS, buildPath } from './endpoints.js';

describe('endpoints', () => {
  it('has 24 defs that build clean paths', () => {
    expect(ENDPOINTS).toHaveLength(24);
    for (const d of ENDPOINTS) {
      const p = buildPath(d, { date: '2026-01-02', start: '2026-01-01', end: '2026-01-07', activityId: 123 });
      expect(p).not.toMatch(/[{}]|undefined/);
    }
  });
});
