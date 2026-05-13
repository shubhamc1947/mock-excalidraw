import { describe, it, expect, vi } from 'vitest';
import { getPrisma } from '../helpers/db';
import { makeUser, makePage } from '../helpers/factories';
import { enqueueCommentNotification, enqueueInviteNotification } from '@/lib/notifications';

vi.mock('@/lib/auth', () => ({ auth: vi.fn(), signIn: vi.fn(), signOut: vi.fn(), handlers: {} }));
vi.mock('@/lib/db', () => ({ get db() { return (globalThis as any).__prisma; } }));
import { auth } from '@/lib/auth';
import { GET } from '@/app/api/notifications/route';
import { POST as MARK_READ } from '@/app/api/notifications/read/route';

const u = (id: string | null) => (auth as any).mockResolvedValue(id ? { user: { id } } : null);

describe('notifications api', () => {
  it('GET returns own notifications, newest first, with actor + page enrichment', async () => {
    const owner = await makeUser({ name: 'Owner' });
    const actor = await makeUser({ name: 'Actor' });
    const p = await makePage(owner.id, null, 'My page');
    const c = await getPrisma().comment.create({
      data: { pageId: p.id, userId: actor.id, body: 'x' },
    });
    await enqueueCommentNotification(getPrisma(), p.id, actor.id, c.id);
    u(owner.id);
    const res = await GET(new Request('http://x/api/notifications'));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toHaveLength(1);
    expect(json[0].type).toBe('COMMENT');
    expect(json[0].actor.name).toBe('Actor');
    expect(json[0].page.title).toBe('My page');
  });

  it('GET ?unread=1 returns count only', async () => {
    const owner = await makeUser();
    const actor = await makeUser();
    const p = await makePage(owner.id);
    const c = await getPrisma().comment.create({
      data: { pageId: p.id, userId: actor.id, body: 'x' },
    });
    await enqueueCommentNotification(getPrisma(), p.id, actor.id, c.id);
    u(owner.id);
    const res = await GET(new Request('http://x/api/notifications?unread=1'));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.unread).toBe(1);
  });

  it('comment by self does not enqueue notification', async () => {
    const me = await makeUser();
    const p = await makePage(me.id);
    const c = await getPrisma().comment.create({
      data: { pageId: p.id, userId: me.id, body: 'x' },
    });
    await enqueueCommentNotification(getPrisma(), p.id, me.id, c.id);
    expect(await getPrisma().notification.count()).toBe(0);
  });

  it('GET only returns my notifications, not others', async () => {
    const meActor = await makeUser();
    const owner = await makeUser();
    const otherOwner = await makeUser();
    const myPage = await makePage(owner.id);
    const otherPage = await makePage(otherOwner.id);
    const c1 = await getPrisma().comment.create({ data: { pageId: myPage.id, userId: meActor.id, body: 'a' } });
    const c2 = await getPrisma().comment.create({ data: { pageId: otherPage.id, userId: meActor.id, body: 'b' } });
    await enqueueCommentNotification(getPrisma(), myPage.id, meActor.id, c1.id);
    await enqueueCommentNotification(getPrisma(), otherPage.id, meActor.id, c2.id);
    u(owner.id);
    const res = await GET(new Request('http://x/api/notifications'));
    const json = await res.json();
    expect(json).toHaveLength(1);
  });

  it('GET caps at 30 newest', async () => {
    const owner = await makeUser();
    const actor = await makeUser();
    const p = await makePage(owner.id);
    for (let i = 0; i < 35; i++) {
      const c = await getPrisma().comment.create({ data: { pageId: p.id, userId: actor.id, body: `${i}` } });
      await enqueueCommentNotification(getPrisma(), p.id, actor.id, c.id);
    }
    u(owner.id);
    const res = await GET(new Request('http://x/api/notifications'));
    const json = await res.json();
    expect(json).toHaveLength(30);
  });

  it('mark-read updates readAt for all unread of recipient', async () => {
    const owner = await makeUser();
    const actor = await makeUser();
    const p = await makePage(owner.id);
    const c = await getPrisma().comment.create({ data: { pageId: p.id, userId: actor.id, body: 'x' } });
    await enqueueCommentNotification(getPrisma(), p.id, actor.id, c.id);
    u(owner.id);
    const res = await MARK_READ(new Request('http://x', { method: 'POST' }));
    expect(res.status).toBe(200);
    const all = await getPrisma().notification.findMany({ where: { recipientUserId: owner.id } });
    expect(all.every(n => n.readAt !== null)).toBe(true);
  });

  it('mark-read does not affect others readAt', async () => {
    const a = await makeUser();
    const b = await makeUser();
    const actor = await makeUser();
    const pa = await makePage(a.id);
    const pb = await makePage(b.id);
    const ca = await getPrisma().comment.create({ data: { pageId: pa.id, userId: actor.id, body: '1' } });
    const cb = await getPrisma().comment.create({ data: { pageId: pb.id, userId: actor.id, body: '2' } });
    await enqueueCommentNotification(getPrisma(), pa.id, actor.id, ca.id);
    await enqueueCommentNotification(getPrisma(), pb.id, actor.id, cb.id);
    u(a.id);
    await MARK_READ(new Request('http://x', { method: 'POST' }));
    const bUnread = await getPrisma().notification.count({
      where: { recipientUserId: b.id, readAt: { isSet: false } },
    });
    expect(bUnread).toBe(1);
  });

  it('invite enqueue creates INVITED row', async () => {
    const inviter = await makeUser();
    const invitee = await makeUser();
    const p = await makePage(inviter.id);
    await enqueueInviteNotification(getPrisma(), invitee.id, inviter.id, p.id);
    const n = await getPrisma().notification.findFirst();
    expect(n?.type).toBe('INVITED');
    expect(n?.recipientUserId).toBe(invitee.id);
  });
});
