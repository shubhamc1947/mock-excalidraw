import { describe, it, expect } from 'vitest';
import { resolvePagePermission } from '@/lib/permissions';
import { getPrisma } from '../helpers/db';
import { makeUser, makePage, makeCollab } from '../helpers/factories';

describe('resolvePagePermission', () => {
  it('owner has full rights', async () => {
    const owner = await makeUser();
    const page = await makePage(owner.id);
    const p = await resolvePagePermission(getPrisma(), page.id, owner.id);
    expect(p).toEqual({ canView: true, canEdit: true, canComment: true, canManage: true, canDelete: true });
  });

  it('AUTHOR collaborator can edit and comment but not manage', async () => {
    const owner = await makeUser();
    const collab = await makeUser();
    const page = await makePage(owner.id);
    await makeCollab(page.id, collab.id, collab.email, 'AUTHOR', owner.id);
    const p = await resolvePagePermission(getPrisma(), page.id, collab.id);
    expect(p).toMatchObject({ canView: true, canEdit: true, canComment: true, canManage: false, canDelete: false });
  });

  it('VIEWER collaborator can view + comment, not edit', async () => {
    const owner = await makeUser();
    const collab = await makeUser();
    const page = await makePage(owner.id);
    await makeCollab(page.id, collab.id, collab.email, 'VIEWER', owner.id);
    const p = await resolvePagePermission(getPrisma(), page.id, collab.id);
    expect(p).toMatchObject({ canView: true, canEdit: false, canComment: true, canManage: false });
  });

  it('logged-in stranger sees public page (view + comment, no edit)', async () => {
    const owner = await makeUser();
    const stranger = await makeUser();
    const db = getPrisma();
    const page = await makePage(owner.id);
    await db.page.update({ where: { id: page.id }, data: { isPublic: true, publicSlug: 'abc12345' } });
    const p = await resolvePagePermission(db, page.id, stranger.id);
    expect(p).toMatchObject({ canView: true, canEdit: false, canComment: true, canManage: false });
  });

  it('anonymous visitor on public page: view only, no comment', async () => {
    const owner = await makeUser();
    const db = getPrisma();
    const page = await makePage(owner.id);
    await db.page.update({ where: { id: page.id }, data: { isPublic: true, publicSlug: 'abc12345' } });
    const p = await resolvePagePermission(db, page.id, null);
    expect(p).toMatchObject({ canView: true, canEdit: false, canComment: false });
  });

  it('stranger on non-public page: nothing', async () => {
    const owner = await makeUser();
    const stranger = await makeUser();
    const page = await makePage(owner.id);
    const p = await resolvePagePermission(getPrisma(), page.id, stranger.id);
    expect(p).toEqual({ canView: false, canEdit: false, canComment: false, canManage: false, canDelete: false });
  });

  it('soft-deleted page: nothing for non-owner, owner still can view (for restore)', async () => {
    const owner = await makeUser();
    const stranger = await makeUser();
    const db = getPrisma();
    const page = await makePage(owner.id);
    await db.page.update({ where: { id: page.id }, data: { deletedAt: new Date() } });
    expect(await resolvePagePermission(db, page.id, stranger.id))
      .toEqual({ canView: false, canEdit: false, canComment: false, canManage: false, canDelete: false });
    expect(await resolvePagePermission(db, page.id, owner.id))
      .toMatchObject({ canView: true, canEdit: false, canDelete: true });
  });
});
