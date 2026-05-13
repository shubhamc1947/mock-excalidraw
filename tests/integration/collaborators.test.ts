import { describe, it, expect, vi } from 'vitest';
import { getPrisma } from '../helpers/db';
import { makeUser, makePage } from '../helpers/factories';

vi.mock('@/lib/auth', () => ({ auth: vi.fn(), signIn: vi.fn(), signOut: vi.fn(), handlers: {} }));
vi.mock('@/lib/db', () => ({ get db() { return (globalThis as any).__prisma; } }));
import { auth } from '@/lib/auth';
import { POST, DELETE } from '@/app/api/pages/[id]/share/collaborators/route';

const u = (id: string | null) => (auth as any).mockResolvedValue(id ? { user: { id } } : null);
const post = (body: object, id: string) =>
  POST(
    new Request('http://x', { method: 'POST',
      headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }),
    { params: Promise.resolve({ id }) }
  );
const del = (body: object, id: string) =>
  DELETE(
    new Request('http://x', { method: 'DELETE',
      headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }),
    { params: Promise.resolve({ id }) }
  );

describe('collaborators api', () => {
  it('POST adds existing user immediately (userId linked) + creates INVITED notification', async () => {
    const me = await makeUser();
    const friend = await makeUser({ email: 'friend@example.com' });
    const p = await makePage(me.id);
    u(me.id);
    const res = await post({ email: 'friend@example.com', role: 'AUTHOR' }, p.id);
    expect(res.status).toBe(200);
    const row = await getPrisma().collaborator.findFirst({ where: { pageId: p.id } });
    expect(row?.userId).toBe(friend.id);
    expect(row?.role).toBe('AUTHOR');
    const notif = await getPrisma().notification.findFirst({
      where: { recipientUserId: friend.id, type: 'INVITED' },
    });
    expect(notif).toBeTruthy();
  });

  it('POST adds unknown email as pending (userId null, no notification yet)', async () => {
    const me = await makeUser();
    const p = await makePage(me.id);
    u(me.id);
    await post({ email: 'pending@example.com', role: 'VIEWER' }, p.id);
    const row = await getPrisma().collaborator.findFirst({ where: { pageId: p.id } });
    expect(row?.userId).toBeNull();
    expect(row?.email).toBe('pending@example.com');
    expect(row?.role).toBe('VIEWER');
    const notifs = await getPrisma().notification.findMany();
    expect(notifs).toHaveLength(0);
  });

  it('POST upserts when email already exists (changes role)', async () => {
    const me = await makeUser();
    const friend = await makeUser({ email: 'f@example.com' });
    const p = await makePage(me.id);
    u(me.id);
    await post({ email: 'f@example.com', role: 'VIEWER' }, p.id);
    await post({ email: 'f@example.com', role: 'AUTHOR' }, p.id);
    const rows = await getPrisma().collaborator.findMany({ where: { pageId: p.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0].role).toBe('AUTHOR');
  });

  it('DELETE removes a collaborator', async () => {
    const me = await makeUser();
    const friend = await makeUser({ email: 'friend@example.com' });
    const p = await makePage(me.id);
    u(me.id);
    await post({ email: 'friend@example.com', role: 'AUTHOR' }, p.id);
    const row = (await getPrisma().collaborator.findFirst({ where: { pageId: p.id } }))!;
    const res = await del({ collaboratorId: row.id }, p.id);
    expect(res.status).toBe(200);
    expect(await getPrisma().collaborator.count({ where: { pageId: p.id } })).toBe(0);
  });

  it('non-owner cannot manage collaborators', async () => {
    const me = await makeUser();
    const stranger = await makeUser();
    const p = await makePage(me.id);
    u(stranger.id);
    const res = await post({ email: 'x@y.com', role: 'AUTHOR' }, p.id);
    expect(res.status).toBe(403);
  });
});
