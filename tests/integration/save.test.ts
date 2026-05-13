import { describe, it, expect, vi } from 'vitest';
import { getPrisma } from '../helpers/db';
import { makeUser, makePage } from '../helpers/factories';

vi.mock('@/lib/auth', () => ({ auth: vi.fn(), signIn: vi.fn(), signOut: vi.fn(), handlers: {} }));
vi.mock('@/lib/db', () => ({ get db() { return (globalThis as any).__prisma; } }));
import { auth } from '@/lib/auth';
import { POST } from '@/app/api/pages/[id]/save/route';

const u = (id: string | null) => (auth as any).mockResolvedValue(id ? { user: { id } } : null);

describe('POST /api/pages/:id/save', () => {
  it('saves scene + creates snapshot for editor', async () => {
    const me = await makeUser();
    const p = await makePage(me.id);
    u(me.id);
    const res = await POST(
      new Request(`http://x/api/pages/${p.id}/save`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sceneJson: { elements: [{ id: 'z' }], appState: {}, files: {} } }),
      }),
      { params: Promise.resolve({ id: p.id }) }
    );
    expect(res.status).toBe(200);
    const after = await getPrisma().page.findUnique({ where: { id: p.id } });
    expect((after?.currentSceneJson as any).elements[0].id).toBe('z');
  });

  it('rejects non-editor', async () => {
    const owner = await makeUser();
    const stranger = await makeUser();
    const p = await makePage(owner.id);
    u(stranger.id);
    const res = await POST(
      new Request(`http://x/api/pages/${p.id}/save`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sceneJson: {} }),
      }),
      { params: Promise.resolve({ id: p.id }) }
    );
    expect(res.status).toBe(403);
  });
});
