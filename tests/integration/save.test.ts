import { describe, it, expect, vi } from 'vitest';
import { getPrisma } from '../helpers/db';
import { makeUser, makePage } from '../helpers/factories';
import { acquireLock } from '@/lib/lock';

vi.mock('@/lib/auth', () => ({ auth: vi.fn(), signIn: vi.fn(), signOut: vi.fn(), handlers: {} }));
vi.mock('@/lib/db', () => ({ get db() { return (globalThis as any).__prisma; } }));
import { auth } from '@/lib/auth';
import { POST } from '@/app/api/pages/[id]/save/route';

const u = (id: string | null) => (auth as any).mockResolvedValue(id ? { user: { id } } : null);
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const sceneReq = (scene: object) => new Request('http://x', {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ sceneJson: scene }),
});

describe('POST /api/pages/:id/save', () => {
  it('saves scene + creates snapshot when caller holds the lock', async () => {
    const me = await makeUser();
    const p = await makePage(me.id);
    await acquireLock(getPrisma(), p.id, me.id);
    u(me.id);
    const res = await POST(sceneReq({ elements: [{ id: 'z' }], appState: {}, files: {} }), ctx(p.id));
    expect(res.status).toBe(200);
    const after = await getPrisma().page.findUnique({ where: { id: p.id } });
    expect((after?.currentSceneJson as any).elements[0].id).toBe('z');
  });

  it('rejects when caller does not hold the lock (409)', async () => {
    const me = await makeUser();
    const p = await makePage(me.id);
    u(me.id);
    const res = await POST(sceneReq({ elements: [], appState: {}, files: {} }), ctx(p.id));
    expect(res.status).toBe(409);
  });

  it('rejects non-editor (403) even before lock check', async () => {
    const owner = await makeUser();
    const stranger = await makeUser();
    const p = await makePage(owner.id);
    u(stranger.id);
    const res = await POST(sceneReq({}), ctx(p.id));
    expect(res.status).toBe(403);
  });
});
