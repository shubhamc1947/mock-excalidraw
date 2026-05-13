import { describe, it, expect, vi } from 'vitest';
import { getPrisma } from '../helpers/db';
import { makeUser, makePage } from '../helpers/factories';

vi.mock('@/lib/auth', () => ({ auth: vi.fn(), signIn: vi.fn(), signOut: vi.fn(), handlers: {} }));
vi.mock('@/lib/db', () => ({ get db() { return (globalThis as any).__prisma; } }));
import { auth } from '@/lib/auth';
import { GET, PATCH } from '@/app/api/pages/[id]/share/route';
import { GET as PUBLIC_GET } from '@/app/api/p/[slug]/route';

const u = (id: string | null) => (auth as any).mockResolvedValue(id ? { user: { id } } : null);
const patch = (body: object, id: string) =>
  PATCH(
    new Request('http://x', {
      method: 'PATCH', headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id }) }
  );

describe('share api', () => {
  it('GET returns isPublic, publicSlug, collaborators (empty in v1)', async () => {
    const me = await makeUser();
    const p = await makePage(me.id);
    u(me.id);
    const res = await GET(new Request('http://x'), { params: Promise.resolve({ id: p.id }) });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.isPublic).toBe(false);
    expect(json.publicSlug).toMatch(/^[A-Za-z0-9_-]{8}$/);
    expect(json.collaborators).toEqual([]);
  });

  it('PATCH isPublic=true rotates slug and sets public', async () => {
    const me = await makeUser();
    const p = await makePage(me.id);
    const before = (await getPrisma().page.findUnique({ where: { id: p.id } }))!;
    u(me.id);
    const res = await patch({ isPublic: true }, p.id);
    const json = await res.json();
    expect(json.isPublic).toBe(true);
    expect(json.publicSlug).toMatch(/^[A-Za-z0-9_-]{8}$/);
    expect(json.publicSlug).not.toBe(before.publicSlug);
  });

  it('PATCH isPublic=false rotates slug and sets private (kill switch)', async () => {
    const me = await makeUser();
    const p = await makePage(me.id);
    u(me.id);
    await patch({ isPublic: true }, p.id);
    const mid = (await getPrisma().page.findUnique({ where: { id: p.id } }))!;
    const res = await patch({ isPublic: false }, p.id);
    const json = await res.json();
    expect(json.isPublic).toBe(false);
    expect(json.publicSlug).toMatch(/^[A-Za-z0-9_-]{8}$/);
    expect(json.publicSlug).not.toBe(mid.publicSlug);
  });

  it('toggling on twice rotates slug', async () => {
    const me = await makeUser();
    const p = await makePage(me.id);
    u(me.id);
    const r1 = await (await patch({ isPublic: true }, p.id)).json();
    await patch({ isPublic: false }, p.id);
    const r2 = await (await patch({ isPublic: true }, p.id)).json();
    expect(r1.publicSlug).not.toBe(r2.publicSlug);
  });

  it('non-owner cannot manage sharing', async () => {
    const me = await makeUser();
    const stranger = await makeUser();
    const p = await makePage(me.id);
    u(stranger.id);
    const res = await patch({ isPublic: true }, p.id);
    expect(res.status).toBe(403);
  });
});

describe('public viewer api (/api/p/[slug])', () => {
  it('returns page scene when public', async () => {
    const me = await makeUser();
    const p = await makePage(me.id, null, 'Public page');
    u(me.id);
    await patch({ isPublic: true }, p.id);
    const fresh = (await getPrisma().page.findUnique({ where: { id: p.id } }))!;
    const res = await PUBLIC_GET(
      new Request(`http://x/api/p/${fresh.publicSlug}`),
      { params: Promise.resolve({ slug: fresh.publicSlug! }) }
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.title).toBe('Public page');
    expect(json.sceneJson).toBeDefined();
  });

  it('404 when page not public', async () => {
    const me = await makeUser();
    const p = await makePage(me.id);
    const fresh = (await getPrisma().page.findUnique({ where: { id: p.id } }))!;
    const res = await PUBLIC_GET(
      new Request(`http://x/api/p/${fresh.publicSlug}`),
      { params: Promise.resolve({ slug: fresh.publicSlug! }) }
    );
    expect(res.status).toBe(404);
  });

  it('404 when slug unknown', async () => {
    const res = await PUBLIC_GET(
      new Request('http://x/api/p/AAAAAAAA'),
      { params: Promise.resolve({ slug: 'AAAAAAAA' }) }
    );
    expect(res.status).toBe(404);
  });

  it('404 when page soft-deleted', async () => {
    const me = await makeUser();
    const p = await makePage(me.id);
    u(me.id);
    await patch({ isPublic: true }, p.id);
    const fresh = (await getPrisma().page.findUnique({ where: { id: p.id } }))!;
    await getPrisma().page.update({ where: { id: p.id }, data: { deletedAt: new Date() } });
    const res = await PUBLIC_GET(
      new Request(`http://x/api/p/${fresh.publicSlug}`),
      { params: Promise.resolve({ slug: fresh.publicSlug! }) }
    );
    expect(res.status).toBe(404);
  });
});
