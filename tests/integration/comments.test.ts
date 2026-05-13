import { describe, it, expect, vi } from 'vitest';
import { getPrisma } from '../helpers/db';
import { makeUser, makePage } from '../helpers/factories';

vi.mock('@/lib/auth', () => ({ auth: vi.fn(), signIn: vi.fn(), signOut: vi.fn(), handlers: {} }));
vi.mock('@/lib/db', () => ({ get db() { return (globalThis as any).__prisma; } }));
import { auth } from '@/lib/auth';
import { POST as POST_C, GET as GET_C } from '@/app/api/pages/[id]/comments/route';
import { DELETE as DEL_C } from '@/app/api/comments/[id]/route';

const u = (id: string | null) => (auth as any).mockResolvedValue(id ? { user: { id } } : null);
const ctxId = (id: string) => ({ params: Promise.resolve({ id }) });

const post = (body: object, id: string) =>
  POST_C(new Request('http://x', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }), ctxId(id));

const get = (id: string) => GET_C(new Request('http://x'), ctxId(id));
const del = (id: string) => DEL_C(new Request('http://x', { method: 'DELETE' }), ctxId(id));

describe('comments api', () => {
  it('owner can post on own page', async () => {
    const me = await makeUser();
    const p = await makePage(me.id);
    u(me.id);
    const res = await post({ body: 'hi' }, p.id);
    expect(res.status).toBe(200);
  });

  it('public-link visitor (logged in) can comment', async () => {
    const owner = await makeUser();
    const visitor = await makeUser();
    const p = await makePage(owner.id);
    await getPrisma().page.update({ where: { id: p.id }, data: { isPublic: true } });
    u(visitor.id);
    const res = await post({ body: 'public hi' }, p.id);
    expect(res.status).toBe(200);
  });

  it('stranger on private page rejected (403)', async () => {
    const owner = await makeUser();
    const stranger = await makeUser();
    const p = await makePage(owner.id);
    u(stranger.id);
    const res = await post({ body: 'x' }, p.id);
    expect(res.status).toBe(403);
  });

  it('returns 429 when over rate limit', async () => {
    const me = await makeUser();
    const p = await makePage(me.id);
    for (let i = 0; i < 10; i++) {
      await getPrisma().comment.create({ data: { pageId: p.id, userId: me.id, body: `${i}` } });
    }
    u(me.id);
    const res = await post({ body: 'overflow' }, p.id);
    expect(res.status).toBe(429);
  });

  it('creates COMMENT notification for page owner when commenter is not owner', async () => {
    const owner = await makeUser();
    const actor = await makeUser();
    const p = await makePage(owner.id);
    await getPrisma().page.update({ where: { id: p.id }, data: { isPublic: true } });
    u(actor.id);
    await post({ body: 'hi' }, p.id);
    const notif = await getPrisma().notification.findFirst({
      where: { recipientUserId: owner.id, type: 'COMMENT' },
    });
    expect(notif).toBeTruthy();
  });

  it('does not notify when commenter is owner', async () => {
    const me = await makeUser();
    const p = await makePage(me.id);
    u(me.id);
    await post({ body: 'mine' }, p.id);
    const count = await getPrisma().notification.count();
    expect(count).toBe(0);
  });

  it('comment author can delete own comment (soft delete)', async () => {
    const me = await makeUser();
    const p = await makePage(me.id);
    const c = await getPrisma().comment.create({ data: { pageId: p.id, userId: me.id, body: 'x' } });
    u(me.id);
    const res = await del(c.id);
    expect(res.status).toBe(200);
    const after = await getPrisma().comment.findUnique({ where: { id: c.id } });
    expect(after?.deletedAt).toBeTruthy();
  });

  it('page owner can delete others comments', async () => {
    const owner = await makeUser();
    const visitor = await makeUser();
    const p = await makePage(owner.id);
    const c = await getPrisma().comment.create({ data: { pageId: p.id, userId: visitor.id, body: 'x' } });
    u(owner.id);
    const res = await del(c.id);
    expect(res.status).toBe(200);
  });

  it('other users cannot delete comments', async () => {
    const owner = await makeUser();
    const visitor = await makeUser();
    const stranger = await makeUser();
    const p = await makePage(owner.id);
    const c = await getPrisma().comment.create({ data: { pageId: p.id, userId: visitor.id, body: 'x' } });
    u(stranger.id);
    const res = await del(c.id);
    expect(res.status).toBe(403);
  });

  it('GET lists non-deleted comments, includes author info, ascending', async () => {
    const me = await makeUser({ name: 'Me' });
    const p = await makePage(me.id);
    const c1 = await getPrisma().comment.create({ data: { pageId: p.id, userId: me.id, body: 'one' } });
    await new Promise(r => setTimeout(r, 5));
    const c2 = await getPrisma().comment.create({ data: { pageId: p.id, userId: me.id, body: 'two' } });
    await getPrisma().comment.update({ where: { id: c1.id }, data: { deletedAt: new Date() } });
    u(me.id);
    const res = await get(p.id);
    const json = await res.json();
    expect(json.map((c: any) => c.body)).toEqual(['two']);
    expect(json[0].user.name).toBe('Me');
  });
});

describe('public comments api (/api/p/[slug]/comments)', () => {
  it('logged-in visitor can comment via slug', async () => {
    // import lazy to keep mocks consistent
    const { POST: PUB_POST } = await import('@/app/api/p/[slug]/comments/route');
    const owner = await makeUser();
    const visitor = await makeUser();
    const p = await makePage(owner.id);
    await getPrisma().page.update({ where: { id: p.id }, data: { isPublic: true } });
    const fresh = (await getPrisma().page.findUnique({ where: { id: p.id } }))!;
    u(visitor.id);
    const res = await PUB_POST(
      new Request('http://x', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ body: 'hi from public' }),
      }),
      { params: Promise.resolve({ slug: fresh.publicSlug! }) }
    );
    expect(res.status).toBe(200);
  });

  it('404 when page not public', async () => {
    const { POST: PUB_POST } = await import('@/app/api/p/[slug]/comments/route');
    const owner = await makeUser();
    const visitor = await makeUser();
    const p = await makePage(owner.id);
    u(visitor.id);
    const res = await PUB_POST(
      new Request('http://x', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ body: 'hi' }),
      }),
      { params: Promise.resolve({ slug: p.publicSlug! }) }
    );
    expect(res.status).toBe(404);
  });
});
