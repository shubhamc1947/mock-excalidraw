import { describe, it, expect, vi } from 'vitest';
import { getPrisma } from '../helpers/db';
import { makeUser, makeFolder } from '../helpers/factories';

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
  signIn: vi.fn(), signOut: vi.fn(), handlers: {},
}));
vi.mock('@/lib/db', () => ({
  get db() { return (globalThis as any).__prisma; },
}));

import { auth } from '@/lib/auth';
import { POST, GET } from '@/app/api/folders/route';
import { PATCH, DELETE } from '@/app/api/folders/[id]/route';

const asUser = (id: string | null) =>
  (auth as any).mockResolvedValue(id ? { user: { id } } : null);

const j = (url: string, body?: object, method: string = 'POST') =>
  new Request(url, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });

describe('POST /api/folders', () => {
  it('creates a root folder', async () => {
    const me = await makeUser();
    asUser(me.id);
    const res = await POST(j('http://x/api/folders', { name: 'My folder', parentFolderId: null }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.name).toBe('My folder');
    expect(json.parentFolderId).toBeNull();
  });

  it('rejects unauthenticated', async () => {
    asUser(null);
    const res = await POST(j('http://x/api/folders', { name: 'x', parentFolderId: null }));
    expect(res.status).toBe(401);
  });

  it('rejects creating under another user folder', async () => {
    const me = await makeUser();
    const other = await makeUser();
    const otherFolder = await makeFolder(other.id);
    asUser(me.id);
    const res = await POST(j('http://x/api/folders', { name: 'x', parentFolderId: otherFolder.id }));
    expect(res.status).toBe(403);
  });
});

describe('GET /api/folders', () => {
  it('lists my non-deleted folders, optionally filtered by parent', async () => {
    const me = await makeUser();
    const root = await makeFolder(me.id, null, 'root');
    await makeFolder(me.id, root.id, 'child');
    asUser(me.id);
    const res = await GET(new Request('http://x/api/folders?parentFolderId=null'));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.map((f: any) => f.name)).toEqual(['root']);
  });
});

describe('PATCH /api/folders/:id', () => {
  it('renames a folder', async () => {
    const me = await makeUser();
    const f = await makeFolder(me.id, null, 'old');
    asUser(me.id);
    const res = await PATCH(
      j(`http://x/api/folders/${f.id}`, { name: 'new' }, 'PATCH'),
      { params: Promise.resolve({ id: f.id }) }
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.name).toBe('new');
  });

  it('rejects moves that would create a cycle', async () => {
    const me = await makeUser();
    const a = await makeFolder(me.id, null, 'a');
    const b = await makeFolder(me.id, a.id, 'b');
    asUser(me.id);
    const res = await PATCH(
      j(`http://x/api/folders/${a.id}`, { parentFolderId: b.id }, 'PATCH'),
      { params: Promise.resolve({ id: a.id }) }
    );
    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/folders/:id', () => {
  it('soft-deletes a folder', async () => {
    const me = await makeUser();
    const f = await makeFolder(me.id);
    asUser(me.id);
    const res = await DELETE(
      new Request(`http://x/api/folders/${f.id}`, { method: 'DELETE' }),
      { params: Promise.resolve({ id: f.id }) }
    );
    expect(res.status).toBe(200);
    const after = await getPrisma().folder.findUnique({ where: { id: f.id } });
    expect(after?.deletedAt).toBeTruthy();
  });

  it('rejects non-owner', async () => {
    const me = await makeUser();
    const other = await makeUser();
    const f = await makeFolder(other.id);
    asUser(me.id);
    const res = await DELETE(
      new Request(`http://x/api/folders/${f.id}`, { method: 'DELETE' }),
      { params: Promise.resolve({ id: f.id }) }
    );
    expect(res.status).toBe(403);
  });
});
