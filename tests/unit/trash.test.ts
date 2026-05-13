import { describe, it, expect } from 'vitest';
import {
  cascadeSoftDeleteFolder, purgeExpiredTrash, TRASH_TTL_MS,
  restoreFolder, restorePage,
} from '@/lib/trash';
import { getPrisma } from '../helpers/db';
import { makeUser, makeFolder, makePage } from '../helpers/factories';

describe('trash', () => {
  it('cascade soft-deletes nested folders and their pages', async () => {
    const me = await makeUser();
    const root = await makeFolder(me.id);
    const child = await makeFolder(me.id, root.id);
    await makePage(me.id, root.id);
    await makePage(me.id, child.id);
    await cascadeSoftDeleteFolder(getPrisma(), root.id);
    const all = await getPrisma().folder.findMany({});
    expect(all.every(f => f.deletedAt !== null)).toBe(true);
    const pages = await getPrisma().page.findMany({});
    expect(pages.every(p => p.deletedAt !== null)).toBe(true);
  });

  it('restoreFolder clears deletedAt', async () => {
    const me = await makeUser();
    const f = await makeFolder(me.id);
    await getPrisma().folder.update({ where: { id: f.id }, data: { deletedAt: new Date() } });
    await restoreFolder(getPrisma(), f.id);
    const after = await getPrisma().folder.findUnique({ where: { id: f.id } });
    expect(after?.deletedAt).toBeNull();
  });

  it('restorePage clears deletedAt', async () => {
    const me = await makeUser();
    const p = await makePage(me.id);
    await getPrisma().page.update({ where: { id: p.id }, data: { deletedAt: new Date() } });
    await restorePage(getPrisma(), p.id);
    const after = await getPrisma().page.findUnique({ where: { id: p.id } });
    expect(after?.deletedAt).toBeNull();
  });

  it('purgeExpiredTrash hard-deletes only items older than TTL', async () => {
    const me = await makeUser();
    const old = await makePage(me.id);
    const fresh = await makePage(me.id);
    await getPrisma().page.update({
      where: { id: old.id },
      data: { deletedAt: new Date(Date.now() - TRASH_TTL_MS - 1000) },
    });
    await getPrisma().page.update({
      where: { id: fresh.id },
      data: { deletedAt: new Date() },
    });
    await purgeExpiredTrash(getPrisma());
    const after = await getPrisma().page.findMany({});
    expect(after.map(p => p.id)).toEqual([fresh.id]);
  });

  it('purge cascades to snapshots/collaborators/comments/notifications', async () => {
    const me = await makeUser();
    const friend = await makeUser();
    const oldPage = await makePage(me.id);
    await getPrisma().drawingSnapshot.create({
      data: { pageId: oldPage.id, sceneJson: {}, createdByUserId: me.id },
    });
    await getPrisma().collaborator.create({
      data: { pageId: oldPage.id, email: friend.email, userId: friend.id, role: 'AUTHOR', invitedByUserId: me.id },
    });
    await getPrisma().comment.create({ data: { pageId: oldPage.id, userId: me.id, body: 'x' } });
    await getPrisma().notification.create({
      data: { recipientUserId: me.id, type: 'COMMENT', actorUserId: friend.id, pageId: oldPage.id },
    });
    await getPrisma().page.update({
      where: { id: oldPage.id },
      data: { deletedAt: new Date(Date.now() - TRASH_TTL_MS - 1000) },
    });
    await purgeExpiredTrash(getPrisma());
    expect(await getPrisma().drawingSnapshot.count()).toBe(0);
    expect(await getPrisma().collaborator.count()).toBe(0);
    expect(await getPrisma().comment.count()).toBe(0);
    expect(await getPrisma().notification.count({ where: { pageId: oldPage.id } })).toBe(0);
  });
});
