import { describe, it, expect, vi } from 'vitest';
import { getPrisma } from '../helpers/db';
import { makeUser, makePage } from '../helpers/factories';
import { saveSceneAndSnapshot } from '@/lib/snapshots';

vi.mock('@/lib/auth', () => ({ auth: vi.fn(), signIn: vi.fn(), signOut: vi.fn(), handlers: {} }));
vi.mock('@/lib/db', () => ({ get db() { return (globalThis as any).__prisma; } }));
import { auth } from '@/lib/auth';
import { GET as LIST } from '@/app/api/pages/[id]/snapshots/route';
import { POST as RESTORE } from '@/app/api/pages/[id]/restore/route';

const u = (id: string | null) => (auth as any).mockResolvedValue(id ? { user: { id } } : null);

describe('snapshots api', () => {
  it('lists snapshots newest first, with author info', async () => {
    const me = await makeUser({ name: 'Me' });
    const p = await makePage(me.id);
    await saveSceneAndSnapshot(getPrisma(), p.id, me.id, { elements: [{ id: 'a' }], appState: {}, files: {} });
    await saveSceneAndSnapshot(getPrisma(), p.id, me.id, { elements: [{ id: 'b' }], appState: {}, files: {} });
    u(me.id);
    const res = await LIST(new Request('http://x'), { params: Promise.resolve({ id: p.id }) });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toHaveLength(2);
    expect(json[0].sceneJson.elements[0].id).toBe('b');
    expect(json[1].sceneJson.elements[0].id).toBe('a');
    expect(json[0].author.name).toBe('Me');
  });

  it('non-viewer cannot list snapshots', async () => {
    const owner = await makeUser();
    const stranger = await makeUser();
    const p = await makePage(owner.id);
    u(stranger.id);
    const res = await LIST(new Request('http://x'), { params: Promise.resolve({ id: p.id }) });
    expect(res.status).toBe(403);
  });

  it('restore creates a new snapshot from the old scene + updates current scene', async () => {
    const me = await makeUser();
    const p = await makePage(me.id);
    await saveSceneAndSnapshot(getPrisma(), p.id, me.id, { elements: [{ id: 'OLD' }], appState: {}, files: {} });
    await saveSceneAndSnapshot(getPrisma(), p.id, me.id, { elements: [{ id: 'NEW' }], appState: {}, files: {} });
    const snaps = await getPrisma().drawingSnapshot.findMany({
      where: { pageId: p.id }, orderBy: { createdAt: 'asc' },
    });
    const oldId = snaps[0].id;
    u(me.id);
    const res = await RESTORE(
      new Request('http://x', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ snapshotId: oldId }),
      }),
      { params: Promise.resolve({ id: p.id }) }
    );
    expect(res.status).toBe(200);
    const after = await getPrisma().page.findUnique({ where: { id: p.id } });
    expect((after?.currentSceneJson as any).elements[0].id).toBe('OLD');
    const total = await getPrisma().drawingSnapshot.count({ where: { pageId: p.id } });
    expect(total).toBe(3);
  });

  it('restore rejects non-editor', async () => {
    const owner = await makeUser();
    const stranger = await makeUser();
    const p = await makePage(owner.id);
    await saveSceneAndSnapshot(getPrisma(), p.id, owner.id, { elements: [], appState: {}, files: {} });
    const snap = await getPrisma().drawingSnapshot.findFirst({ where: { pageId: p.id } });
    u(stranger.id);
    const res = await RESTORE(
      new Request('http://x', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ snapshotId: snap!.id }),
      }),
      { params: Promise.resolve({ id: p.id }) }
    );
    expect(res.status).toBe(403);
  });

  it('restore rejects snapshot from a different page', async () => {
    const me = await makeUser();
    const p1 = await makePage(me.id, null, 'one');
    const p2 = await makePage(me.id, null, 'two');
    await saveSceneAndSnapshot(getPrisma(), p2.id, me.id, { elements: [], appState: {}, files: {} });
    const otherSnap = await getPrisma().drawingSnapshot.findFirst({ where: { pageId: p2.id } });
    u(me.id);
    const res = await RESTORE(
      new Request('http://x', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ snapshotId: otherSnap!.id }),
      }),
      { params: Promise.resolve({ id: p1.id }) }
    );
    expect(res.status).toBe(404);
  });
});
