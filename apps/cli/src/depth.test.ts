import { describe, expect, it } from 'vitest';
import { findDepth, type DayResult } from './depth.js';

const floor = (n: number, gaps: number[] = []) => async (d: number): Promise<DayResult> =>
  d <= n && !gaps.includes(d) ? 'data' : 'none';

describe('findDepth', () => {
  it('finds the floor', async () => {
    const r = await findDepth(floor(100));
    expect(Math.abs(r.days! - 100)).toBeLessThanOrEqual(3); // ~10-step cap limits resolution
  });
  it('a single gap day is not the floor', async () => {
    const r = await findDepth(floor(200, [60]));
    expect(r.days).toBeGreaterThanOrEqual(120);
  });
  it('reports search limit', async () => {
    expect((await findDepth(floor(1000))).note).toMatch(/365/);
  });
  it('reports refused, not no data', async () => {
    const r = await findDepth(async (d) => (d > 30 ? 'refused' : 'data'));
    expect(r.note).toMatch(/refused/);
    expect(r.days).toBe(30);
  });
  it('device start hint', async () => {
    expect((await findDepth(floor(100), { deviceStartDays: 98 })).note).toMatch(/device start/);
  });
});
