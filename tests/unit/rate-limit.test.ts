import { describe, it, expect } from 'vitest';
import { commentRateLimit, COMMENT_LIMIT, COMMENT_WINDOW_MS } from '@/lib/rate-limit';
import { getPrisma } from '../helpers/db';
import { makeUser, makePage } from '../helpers/factories';

describe('commentRateLimit', () => {
  it('allowed=true with full remaining when no prior comments', async () => {
    const u = await makeUser();
    const r = await commentRateLimit(getPrisma(), u.id);
    expect(r.allowed).toBe(true);
    expect(r.remaining).toBe(COMMENT_LIMIT);
  });

  it('blocks at the cap', async () => {
    const u = await makeUser();
    const p = await makePage(u.id);
    for (let i = 0; i < COMMENT_LIMIT; i++) {
      await getPrisma().comment.create({ data: { pageId: p.id, userId: u.id, body: 'x' } });
    }
    const r = await commentRateLimit(getPrisma(), u.id);
    expect(r.allowed).toBe(false);
    expect(r.remaining).toBe(0);
  });

  it('does not count comments older than the window', async () => {
    const u = await makeUser();
    const p = await makePage(u.id);
    const old = new Date(Date.now() - COMMENT_WINDOW_MS - 1000);
    for (let i = 0; i < COMMENT_LIMIT; i++) {
      await getPrisma().comment.create({ data: { pageId: p.id, userId: u.id, body: 'x', createdAt: old } });
    }
    const r = await commentRateLimit(getPrisma(), u.id);
    expect(r.allowed).toBe(true);
  });

  it('counts across all pages (global per-user)', async () => {
    const u = await makeUser();
    const p1 = await makePage(u.id);
    const p2 = await makePage(u.id);
    for (let i = 0; i < COMMENT_LIMIT - 1; i++) {
      await getPrisma().comment.create({ data: { pageId: p1.id, userId: u.id, body: 'a' } });
    }
    await getPrisma().comment.create({ data: { pageId: p2.id, userId: u.id, body: 'b' } });
    const r = await commentRateLimit(getPrisma(), u.id);
    expect(r.allowed).toBe(false);
  });
});
