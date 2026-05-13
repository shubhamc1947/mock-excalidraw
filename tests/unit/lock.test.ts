import { describe, it, expect } from 'vitest';
import { acquireLock, heartbeat, releaseLock, getLockState, LOCK_TTL_MS } from '@/lib/lock';
import { getPrisma } from '../helpers/db';
import { makeUser, makePage } from '../helpers/factories';

describe('lock state machine', () => {
  it('acquires lock when free', async () => {
    const me = await makeUser();
    const p = await makePage(me.id);
    const r = await acquireLock(getPrisma(), p.id, me.id);
    expect(r.granted).toBe(true);
    expect(r.holderUserId).toBe(me.id);
  });

  it('rejects acquire when held by someone else and not expired', async () => {
    const a = await makeUser();
    const b = await makeUser();
    const p = await makePage(a.id);
    await acquireLock(getPrisma(), p.id, a.id);
    const r = await acquireLock(getPrisma(), p.id, b.id);
    expect(r.granted).toBe(false);
    expect(r.holderUserId).toBe(a.id);
  });

  it('allows acquire when previous lock expired', async () => {
    const a = await makeUser();
    const b = await makeUser();
    const p = await makePage(a.id);
    await getPrisma().page.update({
      where: { id: p.id },
      data: { editingUserId: a.id, editingExpiresAt: new Date(Date.now() - 1000) },
    });
    const r = await acquireLock(getPrisma(), p.id, b.id);
    expect(r.granted).toBe(true);
    expect(r.holderUserId).toBe(b.id);
  });

  it('acquire is idempotent for current holder (refreshes TTL)', async () => {
    const me = await makeUser();
    const p = await makePage(me.id);
    await acquireLock(getPrisma(), p.id, me.id);
    const before = (await getPrisma().page.findUnique({ where: { id: p.id } }))!.editingExpiresAt!;
    await new Promise(r => setTimeout(r, 30));
    const r = await acquireLock(getPrisma(), p.id, me.id);
    expect(r.granted).toBe(true);
    const after = (await getPrisma().page.findUnique({ where: { id: p.id } }))!.editingExpiresAt!;
    expect(after.getTime()).toBeGreaterThan(before.getTime());
  });

  it('heartbeat extends own lock', async () => {
    const me = await makeUser();
    const p = await makePage(me.id);
    await acquireLock(getPrisma(), p.id, me.id);
    const before = (await getPrisma().page.findUnique({ where: { id: p.id } }))!.editingExpiresAt!;
    await new Promise(r => setTimeout(r, 30));
    const r = await heartbeat(getPrisma(), p.id, me.id);
    expect(r.granted).toBe(true);
    const after = (await getPrisma().page.findUnique({ where: { id: p.id } }))!.editingExpiresAt!;
    expect(after.getTime()).toBeGreaterThan(before.getTime());
  });

  it('heartbeat from non-holder fails', async () => {
    const a = await makeUser();
    const b = await makeUser();
    const p = await makePage(a.id);
    await acquireLock(getPrisma(), p.id, a.id);
    const r = await heartbeat(getPrisma(), p.id, b.id);
    expect(r.granted).toBe(false);
  });

  it('release clears lock when called by holder', async () => {
    const me = await makeUser();
    const p = await makePage(me.id);
    await acquireLock(getPrisma(), p.id, me.id);
    await releaseLock(getPrisma(), p.id, me.id);
    const s = await getLockState(getPrisma(), p.id);
    expect(s.holderUserId).toBeNull();
  });

  it('release from non-holder is a no-op', async () => {
    const a = await makeUser();
    const b = await makeUser();
    const p = await makePage(a.id);
    await acquireLock(getPrisma(), p.id, a.id);
    await releaseLock(getPrisma(), p.id, b.id);
    const s = await getLockState(getPrisma(), p.id);
    expect(s.holderUserId).toBe(a.id);
  });

  it('getLockState returns null when expired', async () => {
    const me = await makeUser();
    const p = await makePage(me.id);
    await getPrisma().page.update({
      where: { id: p.id },
      data: { editingUserId: me.id, editingExpiresAt: new Date(Date.now() - 1000) },
    });
    const s = await getLockState(getPrisma(), p.id);
    expect(s.holderUserId).toBeNull();
  });

  it('LOCK_TTL_MS is at least 5 minutes', () => {
    expect(LOCK_TTL_MS).toBeGreaterThanOrEqual(5 * 60 * 1000);
  });
});
