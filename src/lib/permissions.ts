import type { PrismaClient } from '@prisma/client';

export type PagePermission = {
  canView: boolean;
  canEdit: boolean;
  canComment: boolean;
  canManage: boolean;
  canDelete: boolean;
};

const NONE: PagePermission = {
  canView: false, canEdit: false, canComment: false, canManage: false, canDelete: false,
};

export async function resolvePagePermission(
  db: PrismaClient,
  pageId: string,
  userId: string | null,
): Promise<PagePermission> {
  const page = await db.page.findUnique({ where: { id: pageId } });
  if (!page) return NONE;

  const isOwner = userId !== null && page.ownerId === userId;

  if (page.deletedAt) {
    if (isOwner) return { canView: true, canEdit: false, canComment: false, canManage: false, canDelete: true };
    return NONE;
  }

  if (isOwner) {
    return { canView: true, canEdit: true, canComment: true, canManage: true, canDelete: true };
  }

  if (userId) {
    const collab = await db.collaborator.findFirst({ where: { pageId, userId } });
    if (collab?.role === 'AUTHOR') {
      return { canView: true, canEdit: true, canComment: true, canManage: false, canDelete: false };
    }
    if (collab?.role === 'VIEWER') {
      return { canView: true, canEdit: false, canComment: true, canManage: false, canDelete: false };
    }
  }

  if (page.isPublic) {
    return {
      canView: true,
      canEdit: false,
      canComment: userId !== null,
      canManage: false,
      canDelete: false,
    };
  }

  return NONE;
}

export class PermissionError extends Error {
  constructor(public action: keyof PagePermission) {
    super(`Forbidden: ${action}`);
  }
}

export async function assertPagePermission(
  db: PrismaClient,
  pageId: string,
  userId: string | null,
  action: keyof PagePermission,
): Promise<void> {
  const p = await resolvePagePermission(db, pageId, userId);
  if (!p[action]) throw new PermissionError(action);
}
