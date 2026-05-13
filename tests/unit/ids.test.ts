import { describe, it, expect } from 'vitest';
import { newPublicSlug } from '@/lib/ids';

describe('newPublicSlug', () => {
  it('returns 8 url-safe chars', () => {
    const s = newPublicSlug();
    expect(s).toHaveLength(8);
    expect(s).toMatch(/^[A-Za-z0-9_-]+$/);
  });
  it('is unique across many calls', () => {
    const set = new Set(Array.from({ length: 1000 }, () => newPublicSlug()));
    expect(set.size).toBe(1000);
  });
});
