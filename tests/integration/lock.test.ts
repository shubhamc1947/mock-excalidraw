import { describe, it, expect, vi } from 'vitest';
import { getPrisma } from '../helpers/db';
import { makeUser, makePage, makeCollab } from '../helpers/factories';

vi.mock('@/lib/auth', () => ({ auth: vi.fn(), signIn: vi.fn(), signOut: vi.fn(), handlers: {} }));
vi.mock('@/lib/db', () => ({ get db() { return (globalThis as any).__prisma; } }));
import { auth } from '@/lib/auth';
import { POST as ACQUIRE } from '@/app/api/pages/[id]/lock/acquire/route';
import { POST as HEARTBEAT } from '@/app/api/pages/[id]/lock/heartbeat/route';
import { POST as RELEASE } from '@/app/api/pages/[id]/lock/release/route';
import { GET as LOCK_STATE } from '@/app/api/pages/[id]/lock/route';

const u = (id: string | null) => (auth as any).mockResolvedValue(id ? { user: { id } } : null);
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

describe('lock endpoints', () => {
  it('acquire 200 for editor', async () => {
    const me = await makeUser();
    const p = await makePage(me.id);
    u(me.id);
    const res = await ACQUIRE(new Request('http://x', { method: 'POST' }), ctx(p.id));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.granted).toBe(true);
  });

  it('acquire 409 when someone else holds', async () => {
    const a = await makeUser();
    const b = await makeUser();
    const p = await makePage(a.id);
    await makeCollab(p.id, b.id, b.email, 'AUTHOR', a.id);
    u(a.id);
    await ACQUIRE(new Request('http://x', { method: 'POST' }), ctx(p.id));
    u(b.id);
    const res = await ACQUIRE(new Request('http://x', { method: 'POST' }), ctx(p.id));
    expect(res.status).toBe(409);
  });

  it('acquire 403 for non-editor', async () => {
    const owner = await makeUser();
    const viewer = await makeUser();
    const p = await makePage(owner.id);
    await makeCollab(p.id, viewer.id, viewer.email, 'VIEWER', owner.id);
    u(viewer.id);
    const res = await ACQUIRE(new Request('http://x', { method: 'POST' }), ctx(p.id));
    expect(res.status).toBe(403);
  });

  it('heartbeat 200 for holder, 409 for non-holder', async () => {
    const me = await makeUser();
    const p = await makePage(me.id);
    u(me.id);
    await ACQUIRE(new Request('http://x', { method: 'POST' }), ctx(p.id));
    let res = await HEARTBEAT(new Request('http://x', { method: 'POST' }), ctx(p.id));
    expect(res.status).toBe(200);
    const other = await makeUser();
    await makeCollab(p.id, other.id, other.email, 'AUTHOR', me.id);
    u(other.id);
    res = await HEARTBEAT(new Request('http://x', { method: 'POST' }), ctx(p.id));
    expect(res.status).toBe(409);
  });

  it('release frees the lock for the next acquirer', async () => {
    const a = await makeUser();
    const b = await makeUser();
    const p = await makePage(a.id);
    await makeCollab(p.id, b.id, b.email, 'AUTHOR', a.id);
    u(a.id);
    await ACQUIRE(new Request('http://x', { method: 'POST' }), ctx(p.id));
    await RELEASE(new Request('http://x', { method: 'POST' }), ctx(p.id));
    u(b.id);
    const res = await ACQUIRE(new Request('http://x', { method: 'POST' }), ctx(p.id));
    expect(res.status).toBe(200);
  });

  it('GET /lock returns read-only state without claiming', async () => {
    const a = await makeUser();
    const b = await makeUser();
    const p = await makePage(a.id);
    await makeCollab(p.id, b.id, b.email, 'AUTHOR', a.id);
    u(a.id);
    await ACQUIRE(new Request('http://x', { method: 'POST' }), ctx(p.id));
    u(b.id);
    const res = await LOCK_STATE(new Request('http://x'), ctx(p.id));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.holderUserId).toBe(a.id);
    // Verify state didn't change (b didn't steal)
    const after = await getPrisma().page.findUnique({ where: { id: p.id } });
    expect(after?.editingUserId).toBe(a.id);
  });
});
