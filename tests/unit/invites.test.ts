import { describe, it, expect } from 'vitest';
import { backLinkInvitesForUser } from '@/lib/invites';
import { getPrisma } from '../helpers/db';
import { makeUser, makePage } from '../helpers/factories';

describe('backLinkInvitesForUser', () => {
  it('links unlinked collaborator rows by email and returns linked pageIds', async () => {
    const inviter = await makeUser();
    const p1 = await makePage(inviter.id);
    const p2 = await makePage(inviter.id);
    const db = getPrisma();
    await db.collaborator.create({ data: { pageId: p1.id, email: 'new@example.com',
      role: 'AUTHOR', invitedByUserId: inviter.id } });
    await db.collaborator.create({ data: { pageId: p2.id, email: 'new@example.com',
      role: 'VIEWER', invitedByUserId: inviter.id } });

    const newUser = await makeUser({ email: 'new@example.com' });
    const linked = await backLinkInvitesForUser(db, newUser.id, newUser.email);
    expect(linked.sort()).toEqual([p1.id, p2.id].sort());

    const rows = await db.collaborator.findMany({ where: { email: 'new@example.com' } });
    expect(rows.every(r => r.userId === newUser.id)).toBe(true);
  });

  it('does nothing when no pending invites exist', async () => {
    const u = await makeUser({ email: 'fresh@example.com' });
    const linked = await backLinkInvitesForUser(getPrisma(), u.id, u.email);
    expect(linked).toEqual([]);
  });

  it('does not relink already-linked rows', async () => {
    const inviter = await makeUser();
    const friend = await makeUser({ email: 'friend@example.com' });
    const p = await makePage(inviter.id);
    const db = getPrisma();
    await db.collaborator.create({ data: { pageId: p.id, email: friend.email,
      role: 'AUTHOR', invitedByUserId: inviter.id, userId: friend.id } });
    const linked = await backLinkInvitesForUser(db, friend.id, friend.email);
    expect(linked).toEqual([]);
  });
});
