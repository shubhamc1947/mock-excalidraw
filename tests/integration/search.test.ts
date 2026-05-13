import { describe, it, expect, vi } from 'vitest';
import { getPrisma } from '../helpers/db';
import { makeUser, makeFolder, makePage, makeCollab } from '../helpers/factories';

vi.mock('@/lib/auth', () => ({ auth: vi.fn(), signIn: vi.fn(), signOut: vi.fn(), handlers: {} }));
vi.mock('@/lib/db', () => ({ get db() { return (globalThis as any).__prisma; } }));
import { auth } from '@/lib/auth';
import { GET } from '@/app/api/search/route';

const u = (id: string | null) => (auth as any).mockResolvedValue(id ? { user: { id } } : null);

describe('search api', () => {
  it('finds owned folders + pages by case-insensitive title', async () => {
    const me = await makeUser();
    await makeFolder(me.id, null, 'Marketing');
    await makePage(me.id, null, 'Market plan');
    await makePage(me.id, null, 'Other');
    u(me.id);
    const res = await GET(new Request('http://x?q=mark'));
    const json = await res.json();
    expect(json.folders.map((f: any) => f.name)).toContain('Marketing');
    expect(json.pages.map((p: any) => p.title)).toContain('Market plan');
    expect(json.pages.map((p: any) => p.title)).not.toContain('Other');
  });

  it('includes pages I am a collaborator on', async () => {
    const me = await makeUser();
    const owner = await makeUser();
    const p = await makePage(owner.id, null, 'Shared with me');
    await makeCollab(p.id, me.id, me.email, 'VIEWER', owner.id);
    u(me.id);
    const res = await GET(new Request('http://x?q=shared'));
    const json = await res.json();
    expect(json.pages.map((p: any) => p.title)).toContain('Shared with me');
  });

  it('does not include pages I have no access to', async () => {
    const me = await makeUser();
    const owner = await makeUser();
    await makePage(owner.id, null, 'Secret');
    u(me.id);
    const res = await GET(new Request('http://x?q=secret'));
    const json = await res.json();
    expect(json.pages).toHaveLength(0);
  });

  it('excludes deleted pages', async () => {
    const me = await makeUser();
    const p = await makePage(me.id, null, 'Gone');
    await getPrisma().page.update({ where: { id: p.id }, data: { deletedAt: new Date() } });
    u(me.id);
    const res = await GET(new Request('http://x?q=gone'));
    const json = await res.json();
    expect(json.pages).toHaveLength(0);
  });

  it('excludes deleted folders', async () => {
    const me = await makeUser();
    const f = await makeFolder(me.id, null, 'Gone');
    await getPrisma().folder.update({ where: { id: f.id }, data: { deletedAt: new Date() } });
    u(me.id);
    const res = await GET(new Request('http://x?q=gone'));
    const json = await res.json();
    expect(json.folders).toHaveLength(0);
  });

  it('empty q returns empty', async () => {
    const me = await makeUser();
    u(me.id);
    const res = await GET(new Request('http://x?q='));
    const json = await res.json();
    expect(json.folders).toEqual([]);
    expect(json.pages).toEqual([]);
  });

  it('caps results (10 folders, 20 pages)', async () => {
    const me = await makeUser();
    for (let i = 0; i < 15; i++) await makeFolder(me.id, null, `find-folder-${i}`);
    for (let i = 0; i < 25; i++) await makePage(me.id, null, `find-page-${i}`);
    u(me.id);
    const res = await GET(new Request('http://x?q=find'));
    const json = await res.json();
    expect(json.folders.length).toBe(10);
    expect(json.pages.length).toBe(20);
  });
});
