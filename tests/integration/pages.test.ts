import { describe, it, expect, vi } from 'vitest';
import { getPrisma } from '../helpers/db';
import { makeUser, makeFolder, makePage } from '../helpers/factories';

vi.mock('@/lib/auth', () => ({ auth: vi.fn(), signIn: vi.fn(), signOut: vi.fn(), handlers: {} }));
vi.mock('@/lib/db', () => ({ get db() { return (globalThis as any).__prisma; } }));

import { auth } from '@/lib/auth';
import { POST as PAGES_POST, GET as PAGES_GET } from '@/app/api/pages/route';
import { PATCH, DELETE, GET as PAGE_GET } from '@/app/api/pages/[id]/route';

const setUser = (id: string | null) => (auth as any).mockResolvedValue(id ? { user: { id } } : null);
const j = (url: string, body?: object, method: string = 'POST') =>
  new Request(url, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });

describe('pages API', () => {
  it('POST creates a page in a folder I own', async () => {
    const me = await makeUser();
    const f = await makeFolder(me.id);
    setUser(me.id);
    const res = await PAGES_POST(j('http://x/api/pages', { title: 'Hi', folderId: f.id }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.title).toBe('Hi');
    expect(json.folderId).toBe(f.id);
  });

  it('POST creates a root page (folderId null)', async () => {
    const me = await makeUser();
    setUser(me.id);
    const res = await PAGES_POST(j('http://x/api/pages', { title: 'Root', folderId: null }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.folderId).toBeNull();
  });

  it('POST rejects when folderId belongs to someone else', async () => {
    const me = await makeUser();
    const other = await makeUser();
    const otherFolder = await makeFolder(other.id);
    setUser(me.id);
    const res = await PAGES_POST(j('http://x/api/pages', { title: 'Hi', folderId: otherFolder.id }));
    expect(res.status).toBe(403);
  });

  it('POST rejects unauthenticated', async () => {
    setUser(null);
    const res = await PAGES_POST(j('http://x/api/pages', { title: 'Hi', folderId: null }));
    expect(res.status).toBe(401);
  });

  it('GET lists pages in a folder for owner', async () => {
    const me = await makeUser();
    const f = await makeFolder(me.id);
    await makePage(me.id, f.id, 'p1');
    await makePage(me.id, f.id, 'p2');
    setUser(me.id);
    const res = await PAGES_GET(j(`http://x/api/pages?folderId=${f.id}`, undefined, 'GET'));
    const json = await res.json();
    expect(json.map((p: any) => p.title).sort()).toEqual(['p1', 'p2']);
  });

  it('GET excludes deleted pages', async () => {
    const me = await makeUser();
    const p = await makePage(me.id);
    await getPrisma().page.update({ where: { id: p.id }, data: { deletedAt: new Date() } });
    setUser(me.id);
    const res = await PAGES_GET(j('http://x/api/pages?folderId=null', undefined, 'GET'));
    const json = await res.json();
    expect(json).toHaveLength(0);
  });

  it('PATCH renames page when owner', async () => {
    const me = await makeUser();
    const p = await makePage(me.id);
    setUser(me.id);
    const res = await PATCH(
      j(`http://x/api/pages/${p.id}`, { title: 'Renamed' }, 'PATCH'),
      { params: Promise.resolve({ id: p.id }) }
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.title).toBe('Renamed');
  });

  it('PATCH rejects non-manager', async () => {
    const me = await makeUser();
    const stranger = await makeUser();
    const p = await makePage(me.id);
    setUser(stranger.id);
    const res = await PATCH(
      j(`http://x/api/pages/${p.id}`, { title: 'Hacked' }, 'PATCH'),
      { params: Promise.resolve({ id: p.id }) }
    );
    expect(res.status).toBe(403);
  });

  it('DELETE soft-deletes page (sets deletedAt)', async () => {
    const me = await makeUser();
    const p = await makePage(me.id);
    setUser(me.id);
    const res = await DELETE(
      new Request(`http://x/api/pages/${p.id}`, { method: 'DELETE' }),
      { params: Promise.resolve({ id: p.id }) }
    );
    expect(res.status).toBe(200);
    const after = await getPrisma().page.findUnique({ where: { id: p.id } });
    expect(after?.deletedAt).toBeTruthy();
  });

  it('GET single page enforces permission', async () => {
    const me = await makeUser();
    const stranger = await makeUser();
    const p = await makePage(me.id);
    setUser(stranger.id);
    const res = await PAGE_GET(
      new Request(`http://x/api/pages/${p.id}`),
      { params: Promise.resolve({ id: p.id }) }
    );
    expect(res.status).toBe(403);
  });

  it('GET single page returns page + permission for owner', async () => {
    const me = await makeUser();
    const p = await makePage(me.id);
    setUser(me.id);
    const res = await PAGE_GET(
      new Request(`http://x/api/pages/${p.id}`),
      { params: Promise.resolve({ id: p.id }) }
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.page.id).toBe(p.id);
    expect(json.permission.canEdit).toBe(true);
  });
});
