import { describe, it, expect } from 'vitest';
import { classify } from './classify';

describe('classify', () => {
  it.each([
    [429, {}, 'rate_limited'], [401, null, 'access_denied'], [403, null, 'access_denied'],
    [200, null, 'no_data'], [200, [], 'no_data'], [200, {}, 'no_data'], [200, { a: null, b: [], c: { d: null } }, 'no_data'],
    [200, { a: 0 }, 'ok'], [204, [1], 'ok'], [400, {}, 'error'], [500, {}, 'error'],
  ])('%i %j -> %s', (s, b, exp) => expect(classify(s as number, b)).toBe(exp));
});
