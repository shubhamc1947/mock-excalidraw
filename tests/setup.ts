import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { afterAll, beforeAll, beforeEach } from 'vitest';
import { execSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';

let replset: MongoMemoryReplSet;
let prisma: PrismaClient;

beforeAll(async () => {
  replset = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  const uri = replset.getUri('mock_excalidraw_test');
  process.env.DATABASE_URL = uri;
  execSync('npx prisma db push --skip-generate', { env: process.env, stdio: 'inherit' });
  prisma = new PrismaClient({ datasources: { db: { url: uri } } });
  (globalThis as any).__prisma = prisma;
});

beforeEach(async () => {
  const models = ['user','account','session','verificationToken',
    'folder','page','drawingSnapshot','collaborator','comment','notification'];
  for (const m of models) await (prisma as any)[m].deleteMany({});
});

afterAll(async () => {
  await prisma?.$disconnect();
  await replset?.stop();
});
