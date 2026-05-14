import type { PrismaClient } from '@prisma/client';

export const LOCK_TTL_MS = 5 * 60 * 1000;

export type LockResult = {
  granted: boolean;
  holderUserId: string | null;
  expiresAt: Date | null;
};

export async function getLockState(db: PrismaClient, pageId: string): Promise<LockResult> {
  const p = await db.page.findUnique({
    where: { id: pageId },
    select: { editingUserId: true, editingExpiresAt: true },
  });
  if (!p?.editingUserId || !p.editingExpiresAt || p.editingExpiresAt.getTime() < Date.now()) {
    return { granted: false, holderUserId: null, expiresAt: null };
  }
  return { granted: true, holderUserId: p.editingUserId, expiresAt: p.editingExpiresAt };
}

export async function acquireLock(
  db: PrismaClient,
  pageId: string,
  userId: string,
): Promise<LockResult> {
  const now = new Date();
  const expiresAt = new Date(Date.now() + LOCK_TTL_MS);

  // Atomic claim: only update if free, expired, or already mine.
  const result = await db.page.updateMany({
    where: {
      id: pageId,
      OR: [
        { editingUserId: { isSet: false } },
        { editingUserId: userId },
        { editingExpiresAt: { lt: now } },
      ],
    },
    data: { editingUserId: userId, editingExpiresAt: expiresAt },
  });

  if (result.count === 1) {
    return { granted: true, holderUserId: userId, expiresAt };
  }

  // Lock contended — read state to return holder info.
  const state = await getLockState(db, pageId);
  return { granted: false, holderUserId: state.holderUserId, expiresAt: state.expiresAt };
}

export async function heartbeat(
  db: PrismaClient,
  pageId: string,
  userId: string,
): Promise<LockResult> {
  const p = await db.page.findUnique({
    where: { id: pageId },
    select: { editingUserId: true, editingExpiresAt: true },
  });
  if (!p || p.editingUserId !== userId) {
    return {
      granted: false,
      holderUserId: p?.editingUserId ?? null,
      expiresAt: p?.editingExpiresAt ?? null,
    };
  }
  const expiresAt = new Date(Date.now() + LOCK_TTL_MS);
  await db.page.update({
    where: { id: pageId },
    data: { editingExpiresAt: expiresAt },
  });
  return { granted: true, holderUserId: userId, expiresAt };
}

export async function releaseLock(
  db: PrismaClient,
  pageId: string,
  userId: string,
): Promise<void> {
  const p = await db.page.findUnique({
    where: { id: pageId },
    select: { editingUserId: true },
  });
  if (!p || p.editingUserId !== userId) return;
  await db.page.update({
    where: { id: pageId },
    data: { editingUserId: null, editingExpiresAt: null },
  });
}
