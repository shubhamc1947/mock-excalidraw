import { getPrisma } from './db';
import type { CollabRole } from '@prisma/client';

let counter = 0;
const uniq = (s: string) => `${s}_${Date.now()}_${counter++}`;

export async function makeUser(overrides: Partial<{ email: string; name: string }> = {}) {
  return getPrisma().user.create({
    data: { email: overrides.email ?? uniq('u') + '@example.com', name: overrides.name ?? 'User' },
  });
}

export async function makeFolder(ownerId: string, parentFolderId: string | null = null, name = 'Folder') {
  return getPrisma().folder.create({ data: { ownerId, parentFolderId, name } });
}

export async function makePage(ownerId: string, folderId: string | null = null, title = 'Page') {
  return getPrisma().page.create({
    data: { ownerId, folderId, title, currentSceneJson: { elements: [], appState: {}, files: {} } },
  });
}

export async function makeCollab(pageId: string, userId: string, email: string, role: CollabRole, invitedByUserId: string) {
  return getPrisma().collaborator.create({ data: { pageId, userId, email, role, invitedByUserId } });
}
