import { describe, it, expect } from 'vitest';
import { saveSceneAndSnapshot, SNAPSHOT_RETENTION } from '@/lib/snapshots';
import { getPrisma } from '../helpers/db';
import { makeUser, makePage } from '../helpers/factories';

describe('saveSceneAndSnapshot', () => {
  it('updates currentSceneJson and creates a snapshot', async () => {
    const me = await makeUser();
    const p = await makePage(me.id);
    const scene = { elements: [{ id: 'a' }], appState: {}, files: {} };
    await saveSceneAndSnapshot(getPrisma(), p.id, me.id, scene);
    const after = await getPrisma().page.findUnique({ where: { id: p.id } });
    expect((after?.currentSceneJson as any).elements[0].id).toBe('a');
    const snaps = await getPrisma().drawingSnapshot.findMany({ where: { pageId: p.id } });
    expect(snaps).toHaveLength(1);
  });

  it('saves thumbnailDataUrl when provided', async () => {
    const me = await makeUser();
    const p = await makePage(me.id);
    await saveSceneAndSnapshot(getPrisma(), p.id, me.id,
      { elements: [], appState: {}, files: {} }, 'data:image/png;base64,XYZ');
    const after = await getPrisma().page.findUnique({ where: { id: p.id } });
    expect(after?.thumbnailDataUrl).toBe('data:image/png;base64,XYZ');
  });

  it('prunes snapshots beyond retention', async () => {
    const me = await makeUser();
    const p = await makePage(me.id);
    for (let i = 0; i < SNAPSHOT_RETENTION + 5; i++) {
      await saveSceneAndSnapshot(getPrisma(), p.id, me.id,
        { elements: [{ id: `e${i}` }], appState: {}, files: {} });
    }
    const snaps = await getPrisma().drawingSnapshot.findMany({ where: { pageId: p.id } });
    expect(snaps.length).toBe(SNAPSHOT_RETENTION);
  });

  it('keeps the newest snapshots when pruning', async () => {
    const me = await makeUser();
    const p = await makePage(me.id);
    for (let i = 0; i < SNAPSHOT_RETENTION + 2; i++) {
      await saveSceneAndSnapshot(getPrisma(), p.id, me.id,
        { elements: [{ id: `e${i}` }], appState: {}, files: {} });
    }
    const snaps = await getPrisma().drawingSnapshot.findMany({
      where: { pageId: p.id }, orderBy: { createdAt: 'asc' },
    });
    // first kept snapshot should be e2 (e0 and e1 pruned)
    expect((snaps[0].sceneJson as any).elements[0].id).toBe('e2');
  });
});
