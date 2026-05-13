import { describe, it, expect } from 'vitest';
import { wouldCreateCycle, listFolderTree } from '@/lib/folders';
import { getPrisma } from '../helpers/db';
import { makeUser, makeFolder } from '../helpers/factories';

describe('folders', () => {
  it('wouldCreateCycle: moving a folder under itself = true', async () => {
    const owner = await makeUser();
    const f = await makeFolder(owner.id);
    expect(await wouldCreateCycle(getPrisma(), f.id, f.id)).toBe(true);
  });

  it('wouldCreateCycle: moving a folder under its descendant = true', async () => {
    const owner = await makeUser();
    const root = await makeFolder(owner.id, null, 'root');
    const child = await makeFolder(owner.id, root.id, 'child');
    const grand = await makeFolder(owner.id, child.id, 'grand');
    expect(await wouldCreateCycle(getPrisma(), root.id, grand.id)).toBe(true);
  });

  it('wouldCreateCycle: moving sibling under sibling = false', async () => {
    const owner = await makeUser();
    const a = await makeFolder(owner.id, null, 'a');
    const b = await makeFolder(owner.id, null, 'b');
    expect(await wouldCreateCycle(getPrisma(), a.id, b.id)).toBe(false);
  });

  it('listFolderTree returns non-deleted folders for owner', async () => {
    const owner = await makeUser();
    await makeFolder(owner.id, null, 'a');
    await makeFolder(owner.id, null, 'b');
    const del = await makeFolder(owner.id, null, 'del');
    await getPrisma().folder.update({ where: { id: del.id }, data: { deletedAt: new Date() } });
    const tree = await listFolderTree(getPrisma(), owner.id);
    expect(tree.map(f => f.name).sort()).toEqual(['a','b']);
  });
});
