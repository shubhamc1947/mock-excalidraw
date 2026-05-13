import { describe, it, expect } from 'vitest';
import { getPrisma } from '../helpers/db';

describe('test harness', () => {
  it('connects and persists a user', async () => {
    const db = getPrisma();
    const u = await db.user.create({ data: { email: 'a@example.com', name: 'A' } });
    expect(u.email).toBe('a@example.com');
    const found = await db.user.findUnique({ where: { id: u.id } });
    expect(found?.name).toBe('A');
  });
});
