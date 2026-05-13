import { describe, it, expect, vi } from 'vitest';
import { getPrisma } from '../helpers/db';
import { makeUser, makeFolder, makePage } from '../helpers/factories';

vi.mock('@/lib/auth', () => ({ auth: vi.fn(), signIn: vi.fn(), signOut: vi.fn(), handlers: {} }));
vi.mock('@/lib/db', () => ({ get db() { return (globalThis as any).__prisma; } }));
import { auth } from '@/lib/auth';
import { POST as RESTORE_FOLDER } from '@/app/api/folders/[id]/restore/route';
import { POST as RESTORE_PAGE } from '@/app/api/pages/[id]/restore-trash/route';

const u = (id: string | null) => (auth as any).mockResolvedValue(id ? { user: { id } } : null);
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

describe('trash restore endpoints', () => {
  it('owner can restore soft-deleted folder', async () => {
    const me = await makeUser();
    const f = await makeFolder(me.id);
    await getPrisma().folder.update({ where: { id: f.id }, data: { deletedAt: new Date() } });
    u(me.id);
    const res = await RESTORE_FOLDER(new Request('http://x', { method: 'POST' }), ctx(f.id));
    expect(res.status).toBe(200);
    const after = await getPrisma().folder.findUnique({ where: { id: f.id } });
    expect(after?.deletedAt).toBeNull();
  });

  it('non-owner cannot restore', async () => {
    const me = await makeUser();
    const stranger = await makeUser();
    const f = await makeFolder(me.id);
    u(stranger.id);
    const res = await RESTORE_FOLDER(new Request('http://x', { method: 'POST' }), ctx(f.id));
    expect(res.status).toBe(403);
  });

  it('owner can restore soft-deleted page', async () => {
    const me = await makeUser();
    const p = await makePage(me.id);
    await getPrisma().page.update({ where: { id: p.id }, data: { deletedAt: new Date() } });
    u(me.id);
    const res = await RESTORE_PAGE(new Request('http://x', { method: 'POST' }), ctx(p.id));
    expect(res.status).toBe(200);
    const after = await getPrisma().page.findUnique({ where: { id: p.id } });
    expect(after?.deletedAt).toBeNull();
  });
});
