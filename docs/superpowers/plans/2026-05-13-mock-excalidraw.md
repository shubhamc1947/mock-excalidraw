# Mock Excalidraw Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an Excalidraw-style web app where Google-authenticated users organize drawings into nested folders, share them publicly or with named collaborators, comment with rate limiting, and edit with turn-based locking.

**Architecture:** Single Next.js 14 (App Router) deploy. Auth.js + Google for auth. Prisma → MongoDB Atlas for data. `@excalidraw/excalidraw` as the canvas. No realtime — turn-based lock + polling. No Redis — comment rate limit is a Mongo count query.

**Tech Stack:** Next.js 14, TypeScript, Auth.js v5, Prisma (MongoDB), Tailwind, shadcn/ui, Zod, Vitest, mongodb-memory-server, Vercel + Vercel Cron.

**Spec reference:** [`docs/superpowers/specs/2026-05-13-mock-excalidraw-design.md`](../specs/2026-05-13-mock-excalidraw-design.md)

---

## Phase Overview

| Phase | Milestone | Outcome |
|---|---|---|
| 0 | Foundation | `npm run dev` boots; Tailwind + Prisma + Vitest green |
| 1 | Auth | Google sign-in works; User row created on first login |
| 2 | Schema + permissions | Folder/Page/etc. models live; `assertPagePermission` unit-tested |
| 3 | Folders CRUD | Create/rename/move/delete nested folders; sidebar tree renders |
| 4 | Pages CRUD | Create/rename/move/delete pages; dashboard + folder views render |
| 5 | Editor + autosave | Excalidraw mounts on `/pages/[id]`, debounced save persists scene |
| 6 | Versioning | Snapshots stored, history drawer lists/restores them |
| 7 | Public link sharing | Toggle public, copy `/p/<slug>`, slug rotates on toggle |
| 8 | Collaborators | Invite by email, back-link on first login, revoke |
| 9 | Lock | Acquire/heartbeat/release; non-holders see lock banner |
| 10 | Comments + rate limit | Comments panel, 10/user/24h cap |
| 11 | Notifications | Bell icon, unread polling, drawer, mark-read |
| 12 | Trash + cron purge | Soft-delete cascades, /trash view, daily Vercel Cron |
| 13 | Search | Title-only regex search across owned + shared |
| 14 | Polish + deploy | Empty/loading/error states, deploy to Vercel |

---

## File Structure

```
mock-excalidraw/
├── package.json, tsconfig.json, next.config.mjs, tailwind.config.ts
├── postcss.config.mjs, vitest.config.ts, .gitignore, .env.example
├── vercel.json                                  (cron schedule)
├── prisma/schema.prisma
├── tests/
│   ├── setup.ts                                 (mongodb-memory-server lifecycle)
│   ├── helpers/{db.ts, factories.ts, session.ts, request.ts}
│   ├── unit/{permissions, rate-limit, lock, ids, snapshots, trash, invites}.test.ts
│   └── integration/{folders, pages, snapshots, sharing, collaborators,
│                    lock, comments, notifications, search, trash}.test.ts
└── src/
    ├── app/
    │   ├── layout.tsx, globals.css, providers.tsx
    │   ├── (auth)/login/page.tsx
    │   ├── (app)/
    │   │   ├── layout.tsx                       (top nav, sidebar)
    │   │   ├── page.tsx                         (dashboard)
    │   │   ├── folders/[folderId]/page.tsx
    │   │   ├── pages/[pageId]/page.tsx          (editor)
    │   │   ├── shared/page.tsx
    │   │   ├── trash/page.tsx
    │   │   └── search/page.tsx
    │   ├── p/[publicSlug]/page.tsx              (public viewer)
    │   └── api/
    │       ├── auth/[...nextauth]/route.ts
    │       ├── folders/{route.ts,[id]/route.ts}
    │       ├── pages/{route.ts,[id]/{route.ts,save,snapshots,restore,share,
    │       │                          comments,lock/{acquire,heartbeat,release}}/route.ts}
    │       ├── comments/[id]/route.ts
    │       ├── notifications/{route.ts, read/route.ts}
    │       ├── search/route.ts
    │       ├── p/[slug]/{route.ts, comments/route.ts}
    │       └── cron/purge-trash/route.ts
    ├── components/
    │   ├── editor/{ExcalidrawCanvas,EditorChrome,LockBanner,
    │   │           HistoryDrawer,ShareDialog,CommentsPanel}.tsx
    │   ├── navigation/{TopNav,Sidebar,Breadcrumbs,BellMenu,SearchBox}.tsx
    │   ├── folders/{FolderCard,FolderTree,NewFolderDialog,RenameDialog}.tsx
    │   ├── pages/{PageCard,NewPageButton,PageActionsMenu}.tsx
    │   └── ui/                                  (shadcn-generated primitives)
    ├── lib/
    │   ├── auth.ts                              (Auth.js config)
    │   ├── db.ts                                (Prisma client singleton)
    │   ├── permissions.ts                       (assertPagePermission, listAccessible)
    │   ├── rate-limit.ts                        (commentRateLimit)
    │   ├── lock.ts                              (acquire/heartbeat/release pure logic)
    │   ├── snapshots.ts                         (createSnapshot, prune)
    │   ├── trash.ts                             (cascadeSoftDelete, purgeExpired)
    │   ├── notifications.ts                     (enqueue helpers)
    │   ├── invites.ts                           (backLinkInvitesForUser)
    │   ├── search.ts                            (search query builder)
    │   ├── ids.ts                               (nanoid wrappers)
    │   ├── api-helpers.ts                       (json, error, parseBody)
    │   └── env.ts                               (typed env vars)
    ├── hooks/
    │   ├── useAutosave.ts
    │   ├── useLockHeartbeat.ts
    │   ├── usePolling.ts
    │   └── useNotifications.ts
    └── types/index.ts
```

**Decomposition principle:** files in `lib/` are pure functions taking Prisma client + inputs (easy to unit test); route handlers are thin wrappers that parse + call lib + format response. UI components are split by domain (`editor/`, `folders/`, `pages/`, `navigation/`).

---

## Phase 0 — Foundation

Goal: a Next.js 14 + TypeScript app boots, Tailwind renders, Prisma client compiles, Vitest runs an empty test green, git initialized.

### Task 0.1: Initialize Next.js + TypeScript

**Files:** all generated by scaffold.

- [ ] **Step 1: Run scaffold**

```bash
cd /d/mock-excalidraw
npx create-next-app@latest . --typescript --tailwind --app --src-dir --eslint --no-import-alias --use-npm
```

When prompted "directory not empty" (it contains `docs/`), accept to continue.

- [ ] **Step 2: Verify it boots**

```bash
npm run dev
```

Expected: server on `http://localhost:3000`, default page renders. Stop with Ctrl-C.

- [ ] **Step 3: Init git, commit scaffold**

```bash
git init
git add -A
git commit -m "chore: scaffold next.js app with typescript + tailwind"
```

### Task 0.2: Install runtime dependencies

- [ ] **Step 1: Install deps**

```bash
npm install @prisma/client @auth/prisma-adapter next-auth@beta @excalidraw/excalidraw zod nanoid
npm install -D prisma vitest @vitest/ui mongodb-memory-server @types/node
```

- [ ] **Step 2: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: install runtime + test deps"
```

### Task 0.3: Configure Vitest

**Files:** Create `vitest.config.ts`, `tests/setup.ts`.

- [ ] **Step 1: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
});
```

- [ ] **Step 2: Create `tests/setup.ts`** (empty for now — populated in Task 2.1)

```ts
// populated in Task 2.1 with mongodb-memory-server lifecycle
```

- [ ] **Step 3: Add test script to `package.json`**

In `scripts`, add:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 4: Add a smoke test `tests/unit/smoke.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
describe('smoke', () => {
  it('runs', () => { expect(1 + 1).toBe(2); });
});
```

- [ ] **Step 5: Run it**

```bash
npm test
```

Expected: 1 test passed.

- [ ] **Step 6: Commit**

```bash
git add vitest.config.ts tests/ package.json package-lock.json
git commit -m "chore: configure vitest"
```

### Task 0.4: Configure environment + tsconfig path alias

**Files:** `.env.example`, `.env.local`, `src/lib/env.ts`, `tsconfig.json`.

- [ ] **Step 1: Create `.env.example`**

```
DATABASE_URL="mongodb+srv://USER:PASS@CLUSTER.mongodb.net/mock_excalidraw?retryWrites=true&w=majority"
AUTH_SECRET="generate-with-openssl-rand-base64-32"
AUTH_GOOGLE_ID=""
AUTH_GOOGLE_SECRET=""
NEXTAUTH_URL="http://localhost:3000"
CRON_SECRET=""
```

- [ ] **Step 2: Copy to `.env.local`** (user fills real values later)

```bash
cp .env.example .env.local
```

- [ ] **Step 3: Create `src/lib/env.ts`**

```ts
import { z } from 'zod';

const schema = z.object({
  DATABASE_URL: z.string().url(),
  AUTH_SECRET: z.string().min(32),
  AUTH_GOOGLE_ID: z.string().min(1),
  AUTH_GOOGLE_SECRET: z.string().min(1),
  NEXTAUTH_URL: z.string().url(),
  CRON_SECRET: z.string().min(1).optional(),
});

export const env = schema.parse(process.env);
```

- [ ] **Step 4: Add `@/*` path alias to `tsconfig.json`**

In `compilerOptions.paths`:
```json
"paths": { "@/*": ["./src/*"] }
```

- [ ] **Step 5: Confirm `.env.local` is gitignored** — already covered by Next's default `.gitignore`. Verify:

```bash
grep -n ".env" .gitignore
```

Expected: `.env*` line present.

- [ ] **Step 6: Commit**

```bash
git add .env.example src/lib/env.ts tsconfig.json
git commit -m "chore: env schema + path alias"
```

### Task 0.5: Initialize Prisma with MongoDB

**Files:** `prisma/schema.prisma`, `src/lib/db.ts`.

- [ ] **Step 1: Init Prisma**

```bash
npx prisma init --datasource-provider mongodb
```

This creates `prisma/schema.prisma` and appends to `.env`. Delete `.env` (we use `.env.local` only):

```bash
rm .env
```

- [ ] **Step 2: Replace `prisma/schema.prisma`**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "mongodb"
  url      = env("DATABASE_URL")
}
```

(Models added in Phase 1 + 2.)

- [ ] **Step 3: Create `src/lib/db.ts` (Prisma singleton)**

```ts
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db;
```

- [ ] **Step 4: Generate client**

```bash
npx prisma generate
```

Expected: "Generated Prisma Client" message.

- [ ] **Step 5: Commit**

```bash
git add prisma/ src/lib/db.ts
git commit -m "chore: init prisma with mongodb"
```

### Task 0.6: Install shadcn/ui base

- [ ] **Step 1: Init shadcn**

```bash
npx shadcn@latest init
```

Choose: Default style, Slate base color, CSS variables yes.

- [ ] **Step 2: Add commonly-used primitives**

```bash
npx shadcn@latest add button input label dialog dropdown-menu sheet toast tooltip avatar
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore: add shadcn/ui primitives"
```


---

## Phase 1 — Auth

Goal: Google sign-in works end to end. A `User` row is created on first login. `auth()` returns the session anywhere on the server.

### Task 1.1: Add Auth.js models to Prisma schema

**Files:** Modify `prisma/schema.prisma`.

- [ ] **Step 1: Append the Auth.js + User models**

Append below the `datasource` block in `prisma/schema.prisma`:

```prisma
model User {
  id            String    @id @default(auto()) @map("_id") @db.ObjectId
  name          String?
  email         String    @unique
  emailVerified DateTime?
  image         String?
  createdAt     DateTime  @default(now())

  accounts Account[]
  sessions Session[]
}

model Account {
  id                String  @id @default(auto()) @map("_id") @db.ObjectId
  userId            String  @db.ObjectId
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.String
  access_token      String? @db.String
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.String
  session_state     String?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
}

model Session {
  id           String   @id @default(auto()) @map("_id") @db.ObjectId
  sessionToken String   @unique
  userId       String   @db.ObjectId
  expires      DateTime
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model VerificationToken {
  id         String   @id @default(auto()) @map("_id") @db.ObjectId
  identifier String
  token      String   @unique
  expires    DateTime
  @@unique([identifier, token])
}
```

- [ ] **Step 2: Push schema (no migrations on Mongo)**

```bash
npx prisma db push
```

Expected: "The database is already in sync with the Prisma schema." or "Your database is now in sync".

- [ ] **Step 3: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(auth): add user/account/session models"
```

### Task 1.2: Configure Auth.js

**Files:** Create `src/lib/auth.ts`, `src/app/api/auth/[...nextauth]/route.ts`.

- [ ] **Step 1: Create `src/lib/auth.ts`**

```ts
import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import { PrismaAdapter } from '@auth/prisma-adapter';
import { db } from '@/lib/db';

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(db),
  providers: [Google],
  session: { strategy: 'database' },
  callbacks: {
    async session({ session, user }) {
      if (session.user) (session.user as { id?: string }).id = user.id;
      return session;
    },
  },
});
```

- [ ] **Step 2: Create route handler `src/app/api/auth/[...nextauth]/route.ts`**

```ts
import { handlers } from '@/lib/auth';
export const { GET, POST } = handlers;
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/auth.ts src/app/api/auth/
git commit -m "feat(auth): wire auth.js with google + prisma adapter"
```

### Task 1.3: Build the login page

**Files:** Create `src/app/(auth)/login/page.tsx`.

- [ ] **Step 1: Create the login page**

```tsx
import { signIn, auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { Button } from '@/components/ui/button';

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) redirect('/');

  return (
    <main className="min-h-screen flex items-center justify-center">
      <div className="w-full max-w-sm space-y-6 p-8 border rounded-lg">
        <h1 className="text-2xl font-semibold">Sign in</h1>
        <form action={async () => { 'use server'; await signIn('google', { redirectTo: '/' }); }}>
          <Button type="submit" className="w-full">Continue with Google</Button>
        </form>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/
git commit -m "feat(auth): add /login page"
```

### Task 1.4: Add a route-group middleware to require auth on /(app)

**Files:** Create `src/middleware.ts`.

- [ ] **Step 1: Create `src/middleware.ts`**

```ts
import { auth } from '@/lib/auth';
import { NextResponse } from 'next/server';

export default auth((req) => {
  const { nextUrl } = req;
  const isAuthed = !!req.auth;
  const isLogin = nextUrl.pathname.startsWith('/login');
  const isPublic = nextUrl.pathname.startsWith('/p/') || nextUrl.pathname.startsWith('/api/auth');

  if (isPublic) return;
  if (!isAuthed && !isLogin) {
    return NextResponse.redirect(new URL('/login', nextUrl));
  }
  if (isAuthed && isLogin) {
    return NextResponse.redirect(new URL('/', nextUrl));
  }
});

export const config = {
  matcher: ['/((?!_next|favicon.ico|.*\..*).*)'],
};
```

- [ ] **Step 2: Manual verify**

```bash
npm run dev
```

Open `http://localhost:3000` → should redirect to `/login`. Click Google button → after consent → returns to `/`. Stop server.

- [ ] **Step 3: Verify a User row was created in MongoDB Atlas (Atlas UI → Collections → `User`).**

- [ ] **Step 4: Commit**

```bash
git add src/middleware.ts
git commit -m "feat(auth): require auth on app routes via middleware"
```


---

## Phase 2 — Schema + permissions

Goal: All app models exist in Prisma. `tests/setup.ts` provides a reusable test DB. `assertPagePermission` is implemented and unit-tested.

### Task 2.1: Add app models to Prisma schema

**Files:** Modify `prisma/schema.prisma`.

- [ ] **Step 1: Append the app models**

```prisma
enum CollabRole { AUTHOR VIEWER }
enum NotifType  { COMMENT INVITED }

model Folder {
  id             String    @id @default(auto()) @map("_id") @db.ObjectId
  name           String
  ownerId        String    @db.ObjectId
  parentFolderId String?   @db.ObjectId
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt
  deletedAt      DateTime?

  @@index([ownerId, parentFolderId])
  @@index([ownerId, deletedAt])
}

model Page {
  id               String    @id @default(auto()) @map("_id") @db.ObjectId
  title            String
  ownerId          String    @db.ObjectId
  folderId         String?   @db.ObjectId
  currentSceneJson Json
  thumbnailDataUrl String?
  isPublic         Boolean   @default(false)
  publicSlug       String?   @unique
  editingUserId    String?   @db.ObjectId
  editingExpiresAt DateTime?
  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt
  deletedAt        DateTime?

  @@index([ownerId, folderId, deletedAt])
  @@index([title])
}

model DrawingSnapshot {
  id              String   @id @default(auto()) @map("_id") @db.ObjectId
  pageId          String   @db.ObjectId
  sceneJson       Json
  createdByUserId String   @db.ObjectId
  createdAt       DateTime @default(now())

  @@index([pageId, createdAt])
}

model Collaborator {
  id              String     @id @default(auto()) @map("_id") @db.ObjectId
  pageId          String     @db.ObjectId
  email           String
  userId          String?    @db.ObjectId
  role            CollabRole
  invitedByUserId String     @db.ObjectId
  invitedAt       DateTime   @default(now())

  @@unique([pageId, email])
  @@index([userId])
  @@index([email])
}

model Comment {
  id        String    @id @default(auto()) @map("_id") @db.ObjectId
  pageId    String    @db.ObjectId
  userId    String    @db.ObjectId
  body      String
  createdAt DateTime  @default(now())
  deletedAt DateTime?

  @@index([pageId, createdAt])
  @@index([userId, createdAt])
}

model Notification {
  id              String    @id @default(auto()) @map("_id") @db.ObjectId
  recipientUserId String    @db.ObjectId
  type            NotifType
  actorUserId     String    @db.ObjectId
  pageId          String?   @db.ObjectId
  commentId       String?   @db.ObjectId
  readAt          DateTime?
  createdAt       DateTime  @default(now())

  @@index([recipientUserId, readAt, createdAt])
}
```

- [ ] **Step 2: Push schema**

```bash
npx prisma db push
npx prisma generate
```

- [ ] **Step 3: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(schema): add folder/page/snapshot/collab/comment/notification models"
```

### Task 2.2: Test database lifecycle helpers

**Files:** Create `tests/helpers/db.ts`, populate `tests/setup.ts`.

> Note: `mongodb-memory-server` requires a replica set for Prisma's Mongo connector. Use `MongoMemoryReplSet`.

- [ ] **Step 1: Populate `tests/setup.ts`**

```ts
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
```

- [ ] **Step 2: Create `tests/helpers/db.ts`**

```ts
import type { PrismaClient } from '@prisma/client';

export function getPrisma(): PrismaClient {
  return (globalThis as any).__prisma as PrismaClient;
}
```

- [ ] **Step 3: Smoke-test the harness `tests/integration/harness.test.ts`**

```ts
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
```

- [ ] **Step 4: Run**

```bash
npm test
```

Expected: harness test passes (first run downloads MongoDB binary).

- [ ] **Step 5: Commit**

```bash
git add tests/
git commit -m "test: in-memory mongo test harness"
```

### Task 2.3: Test data factories

**Files:** Create `tests/helpers/factories.ts`.

- [ ] **Step 1: Create factories**

```ts
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
```

- [ ] **Step 2: Commit**

```bash
git add tests/helpers/factories.ts
git commit -m "test: data factories"
```

### Task 2.4: Permissions helper — TDD

**Files:** Create `src/lib/permissions.ts`, `tests/unit/permissions.test.ts`.

- [ ] **Step 1: Write failing tests `tests/unit/permissions.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { resolvePagePermission } from '@/lib/permissions';
import { getPrisma } from '../helpers/db';
import { makeUser, makePage, makeCollab } from '../helpers/factories';

describe('resolvePagePermission', () => {
  it('owner has full rights', async () => {
    const owner = await makeUser();
    const page = await makePage(owner.id);
    const p = await resolvePagePermission(getPrisma(), page.id, owner.id);
    expect(p).toEqual({ canView: true, canEdit: true, canComment: true, canManage: true, canDelete: true });
  });

  it('AUTHOR collaborator can edit and comment but not manage', async () => {
    const owner = await makeUser();
    const collab = await makeUser();
    const page = await makePage(owner.id);
    await makeCollab(page.id, collab.id, collab.email, 'AUTHOR', owner.id);
    const p = await resolvePagePermission(getPrisma(), page.id, collab.id);
    expect(p).toMatchObject({ canView: true, canEdit: true, canComment: true, canManage: false, canDelete: false });
  });

  it('VIEWER collaborator can view + comment, not edit', async () => {
    const owner = await makeUser();
    const collab = await makeUser();
    const page = await makePage(owner.id);
    await makeCollab(page.id, collab.id, collab.email, 'VIEWER', owner.id);
    const p = await resolvePagePermission(getPrisma(), page.id, collab.id);
    expect(p).toMatchObject({ canView: true, canEdit: false, canComment: true, canManage: false });
  });

  it('logged-in stranger sees public page (view + comment, no edit)', async () => {
    const owner = await makeUser();
    const stranger = await makeUser();
    const db = getPrisma();
    const page = await makePage(owner.id);
    await db.page.update({ where: { id: page.id }, data: { isPublic: true, publicSlug: 'abc12345' } });
    const p = await resolvePagePermission(db, page.id, stranger.id);
    expect(p).toMatchObject({ canView: true, canEdit: false, canComment: true, canManage: false });
  });

  it('anonymous visitor on public page: view only, no comment', async () => {
    const owner = await makeUser();
    const db = getPrisma();
    const page = await makePage(owner.id);
    await db.page.update({ where: { id: page.id }, data: { isPublic: true, publicSlug: 'abc12345' } });
    const p = await resolvePagePermission(db, page.id, null);
    expect(p).toMatchObject({ canView: true, canEdit: false, canComment: false });
  });

  it('stranger on non-public page: nothing', async () => {
    const owner = await makeUser();
    const stranger = await makeUser();
    const page = await makePage(owner.id);
    const p = await resolvePagePermission(getPrisma(), page.id, stranger.id);
    expect(p).toEqual({ canView: false, canEdit: false, canComment: false, canManage: false, canDelete: false });
  });

  it('soft-deleted page: nothing for non-owner, owner still can view (for restore)', async () => {
    const owner = await makeUser();
    const stranger = await makeUser();
    const db = getPrisma();
    const page = await makePage(owner.id);
    await db.page.update({ where: { id: page.id }, data: { deletedAt: new Date() } });
    expect(await resolvePagePermission(db, page.id, stranger.id))
      .toEqual({ canView: false, canEdit: false, canComment: false, canManage: false, canDelete: false });
    expect(await resolvePagePermission(db, page.id, owner.id))
      .toMatchObject({ canView: true, canEdit: false, canDelete: true });
  });
});
```

- [ ] **Step 2: Run — expect failures**

```bash
npm test -- permissions
```

Expected: cannot find module `@/lib/permissions`.

- [ ] **Step 3: Implement `src/lib/permissions.ts`**

```ts
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
```

- [ ] **Step 4: Run — expect pass**

```bash
npm test -- permissions
```

Expected: 7 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/permissions.ts tests/unit/permissions.test.ts
git commit -m "feat(permissions): per-resource permission resolver with full TDD"
```

### Task 2.5: API helpers

**Files:** Create `src/lib/api-helpers.ts`.

- [ ] **Step 1: Implement helpers**

```ts
import { NextResponse } from 'next/server';
import type { ZodSchema } from 'zod';
import { auth } from '@/lib/auth';

export function ok<T>(data: T, status = 200) { return NextResponse.json(data, { status }); }
export function fail(status: number, message: string, extra?: object) {
  return NextResponse.json({ error: message, ...extra }, { status });
}

export class ResponseError extends Error {
  constructor(public status: number, public msg: string) { super(msg); }
}

export async function requireUserId(): Promise<string> {
  const session = await auth();
  const id = (session?.user as { id?: string } | undefined)?.id;
  if (!id) throw new ResponseError(401, 'Unauthorized');
  return id;
}
export async function getUserId(): Promise<string | null> {
  const session = await auth();
  return ((session?.user as { id?: string } | undefined)?.id) ?? null;
}

export async function parseBody<T>(req: Request, schema: ZodSchema<T>): Promise<T> {
  const json = await req.json().catch(() => null);
  const result = schema.safeParse(json);
  if (!result.success) throw new ResponseError(400, 'Invalid body: ' + result.error.message);
  return result.data;
}

export function handle<C = unknown>(handler: (req: Request, ctx: C) => Promise<Response>) {
  return async (req: Request, ctx: C) => {
    try { return await handler(req, ctx); }
    catch (e) {
      if (e instanceof ResponseError) return fail(e.status, e.msg);
      const msg = (e as Error).message ?? 'Internal error';
      if (msg.startsWith('Forbidden')) return fail(403, msg);
      console.error(e);
      return fail(500, 'Internal error');
    }
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/api-helpers.ts
git commit -m "feat: api response + auth helpers"
```

### Task 2.6: ID helper — TDD

**Files:** Create `src/lib/ids.ts`, `tests/unit/ids.test.ts`.

- [ ] **Step 1: Test**

```ts
import { describe, it, expect } from 'vitest';
import { newPublicSlug } from '@/lib/ids';

describe('newPublicSlug', () => {
  it('returns 8 url-safe chars', () => {
    const s = newPublicSlug();
    expect(s).toHaveLength(8);
    expect(s).toMatch(/^[A-Za-z0-9_-]+$/);
  });
  it('is unique across many calls', () => {
    const set = new Set(Array.from({ length: 1000 }, () => newPublicSlug()));
    expect(set.size).toBe(1000);
  });
});
```

- [ ] **Step 2: Implement**

```ts
import { customAlphabet } from 'nanoid';
const ALPH = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
const slugger = customAlphabet(ALPH, 8);
export const newPublicSlug = () => slugger();
```

- [ ] **Step 3: Run + commit**

```bash
npm test -- ids
git add src/lib/ids.ts tests/unit/ids.test.ts
git commit -m "feat(ids): nanoid public-slug generator"
```

---

## Phase 3 — Folders CRUD

Goal: A user can create, rename, move, and soft-delete nested folders. Sidebar tree renders the hierarchy. Cycle prevention is unit-tested.

### Task 3.1: Folder lib (pure logic) — TDD

**Files:** Create `src/lib/folders.ts`, `tests/unit/folders.test.ts`.

- [ ] **Step 1: Test (cycle prevention + ownership)**

```ts
import { describe, it, expect } from 'vitest';
import { wouldCreateCycle, listFolderTree } from '@/lib/folders';
import { getPrisma } from '../helpers/db';
import { makeUser, makeFolder } from '../helpers/factories';

describe('folders', () => {
  it('wouldCreateCycle: moving a folder under itself = true', async () => {
    const owner = await makeUser();
    const f = await makeFolder(owner.id);
    expect(await wouldCreateCycle(getPrisma(), f.id, f.id)).toBe(true);
  });

  it('wouldCreateCycle: moving a folder under its descendant = true', async () => {
    const owner = await makeUser();
    const root = await makeFolder(owner.id, null, 'root');
    const child = await makeFolder(owner.id, root.id, 'child');
    const grand = await makeFolder(owner.id, child.id, 'grand');
    expect(await wouldCreateCycle(getPrisma(), root.id, grand.id)).toBe(true);
  });

  it('wouldCreateCycle: moving sibling under sibling = false', async () => {
    const owner = await makeUser();
    const a = await makeFolder(owner.id, null, 'a');
    const b = await makeFolder(owner.id, null, 'b');
    expect(await wouldCreateCycle(getPrisma(), a.id, b.id)).toBe(false);
  });

  it('listFolderTree returns root folders for owner, ignores deleted', async () => {
    const owner = await makeUser();
    const a = await makeFolder(owner.id, null, 'a');
    const b = await makeFolder(owner.id, null, 'b');
    const del = await makeFolder(owner.id, null, 'del');
    await getPrisma().folder.update({ where: { id: del.id }, data: { deletedAt: new Date() } });
    const tree = await listFolderTree(getPrisma(), owner.id);
    expect(tree.map(f => f.name).sort()).toEqual(['a','b']);
  });
});
```

- [ ] **Step 2: Implement `src/lib/folders.ts`**

```ts
import type { PrismaClient, Folder } from '@prisma/client';

export async function wouldCreateCycle(
  db: PrismaClient,
  folderId: string,
  newParentId: string,
): Promise<boolean> {
  if (folderId === newParentId) return true;
  let cur: string | null = newParentId;
  const seen = new Set<string>();
  while (cur) {
    if (seen.has(cur)) return false;
    seen.add(cur);
    if (cur === folderId) return true;
    const f: Folder | null = await db.folder.findUnique({ where: { id: cur } });
    cur = f?.parentFolderId ?? null;
  }
  return false;
}

export async function listFolderTree(db: PrismaClient, ownerId: string) {
  return db.folder.findMany({
    where: { ownerId, deletedAt: null },
    orderBy: { name: 'asc' },
  });
}

export async function assertFolderOwner(db: PrismaClient, folderId: string, userId: string): Promise<Folder> {
  const f = await db.folder.findUnique({ where: { id: folderId } });
  if (!f || f.ownerId !== userId) {
    const e = new Error('Forbidden: folder');
    throw e;
  }
  return f;
}
```

- [ ] **Step 3: Run + commit**

```bash
npm test -- folders
git add src/lib/folders.ts tests/unit/folders.test.ts
git commit -m "feat(folders): pure tree logic with cycle detection (TDD)"
```

### Task 3.2: Folders API — TDD

**Files:** Create `src/app/api/folders/route.ts`, `src/app/api/folders/[id]/route.ts`, `tests/integration/folders.test.ts`.

- [ ] **Step 1: Write integration test for POST + GET**

```ts
import { describe, it, expect, vi } from 'vitest';
import { getPrisma } from '../helpers/db';
import { makeUser, makeFolder } from '../helpers/factories';

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
  signIn: vi.fn(), signOut: vi.fn(), handlers: {},
}));
vi.mock('@/lib/db', () => ({ db: (globalThis as any).__prisma }));

import { auth } from '@/lib/auth';
import { POST, GET } from '@/app/api/folders/route';

function asUser(id: string) {
  (auth as any).mockResolvedValue({ user: { id } });
}

function jsonReq(body: object) {
  return new Request('http://localhost/api/folders', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/folders', () => {
  it('creates a root folder', async () => {
    const me = await makeUser();
    asUser(me.id);
    const res = await POST(jsonReq({ name: 'My folder', parentFolderId: null }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.name).toBe('My folder');
    expect(json.parentFolderId).toBeNull();
  });

  it('rejects unauthenticated', async () => {
    (auth as any).mockResolvedValue(null);
    const res = await POST(jsonReq({ name: 'x', parentFolderId: null }));
    expect(res.status).toBe(401);
  });

  it('rejects creating under another user folder', async () => {
    const me = await makeUser();
    const other = await makeUser();
    const otherFolder = await makeFolder(other.id);
    asUser(me.id);
    const res = await POST(jsonReq({ name: 'x', parentFolderId: otherFolder.id }));
    expect(res.status).toBe(403);
  });
});

describe('GET /api/folders', () => {
  it('lists my non-deleted folders, optionally filtered by parent', async () => {
    const me = await makeUser();
    const root = await makeFolder(me.id, null, 'root');
    await makeFolder(me.id, root.id, 'child');
    asUser(me.id);
    const res = await GET(new Request('http://localhost/api/folders?parentFolderId=null'));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.map((f: any) => f.name)).toEqual(['root']);
  });
});
```

- [ ] **Step 2: Implement `src/app/api/folders/route.ts`**

```ts
import { z } from 'zod';
import { db } from '@/lib/db';
import { handle, ok, parseBody, requireUserId, ResponseError } from '@/lib/api-helpers';
import { assertFolderOwner } from '@/lib/folders';

const CreateFolder = z.object({
  name: z.string().min(1).max(80),
  parentFolderId: z.string().nullable(),
});

export const POST = handle(async (req) => {
  const userId = await requireUserId();
  const { name, parentFolderId } = await parseBody(req, CreateFolder);
  if (parentFolderId) await assertFolderOwner(db, parentFolderId, userId);
  const folder = await db.folder.create({ data: { name, parentFolderId, ownerId: userId } });
  return ok(folder);
});

export const GET = handle(async (req) => {
  const userId = await requireUserId();
  const url = new URL(req.url);
  const raw = url.searchParams.get('parentFolderId');
  const parentFolderId = raw === 'null' ? null : raw;
  const where: any = { ownerId: userId, deletedAt: null };
  if (raw !== null) where.parentFolderId = parentFolderId;
  const folders = await db.folder.findMany({ where, orderBy: { name: 'asc' } });
  return ok(folders);
});
```

- [ ] **Step 3: Implement `src/app/api/folders/[id]/route.ts` (PATCH = rename or move; DELETE = soft delete)**

```ts
import { z } from 'zod';
import { db } from '@/lib/db';
import { handle, ok, parseBody, requireUserId, ResponseError } from '@/lib/api-helpers';
import { assertFolderOwner, wouldCreateCycle } from '@/lib/folders';
import { cascadeSoftDeleteFolder } from '@/lib/trash';

const Patch = z.object({
  name: z.string().min(1).max(80).optional(),
  parentFolderId: z.string().nullable().optional(),
});

export const PATCH = handle(async (req, { params }: { params: { id: string } }) => {
  const userId = await requireUserId();
  await assertFolderOwner(db, params.id, userId);
  const data = await parseBody(req, Patch);
  if (data.parentFolderId !== undefined && data.parentFolderId !== null) {
    await assertFolderOwner(db, data.parentFolderId, userId);
    if (await wouldCreateCycle(db, params.id, data.parentFolderId)) {
      throw new ResponseError(400, 'Move would create a cycle');
    }
  }
  const updated = await db.folder.update({ where: { id: params.id }, data });
  return ok(updated);
});

export const DELETE = handle(async (_req, { params }: { params: { id: string } }) => {
  const userId = await requireUserId();
  await assertFolderOwner(db, params.id, userId);
  await cascadeSoftDeleteFolder(db, params.id);
  return ok({ ok: true });
});
```

- [ ] **Step 4: Stub `src/lib/trash.ts` for now (full impl in Phase 12)**

```ts
import type { PrismaClient } from '@prisma/client';

export async function cascadeSoftDeleteFolder(db: PrismaClient, folderId: string) {
  const now = new Date();
  await db.folder.update({ where: { id: folderId }, data: { deletedAt: now } });
  const children = await db.folder.findMany({ where: { parentFolderId: folderId, deletedAt: null } });
  for (const c of children) await cascadeSoftDeleteFolder(db, c.id);
  await db.page.updateMany({ where: { folderId, deletedAt: null }, data: { deletedAt: now } });
}
```

- [ ] **Step 5: Run + commit**

```bash
npm test -- folders
git add src/app/api/folders/ src/lib/trash.ts tests/integration/folders.test.ts
git commit -m "feat(folders): CRUD api with cycle prevention"
```

### Task 3.3: Sidebar tree component

**Files:** Create `src/components/folders/FolderTree.tsx`, `src/hooks/usePolling.ts`.

- [ ] **Step 1: Implement `src/hooks/usePolling.ts`** (used in many places)

```ts
'use client';
import { useEffect, useState } from 'react';

export function usePolling<T>(fetcher: () => Promise<T>, intervalMs: number) {
  const [data, setData] = useState<T | null>(null);
  useEffect(() => {
    let cancelled = false;
    const tick = async () => { try { const d = await fetcher(); if (!cancelled) setData(d); } catch {} };
    tick();
    const id = setInterval(tick, intervalMs);
    return () => { cancelled = true; clearInterval(id); };
  }, [intervalMs]);
  return data;
}
```

- [ ] **Step 2: Implement `src/components/folders/FolderTree.tsx`**

```tsx
'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';

type Folder = { id: string; name: string; parentFolderId: string | null };

async function fetchAll(): Promise<Folder[]> {
  const r = await fetch('/api/folders');
  return r.json();
}

function group(folders: Folder[]) {
  const byParent = new Map<string | null, Folder[]>();
  for (const f of folders) {
    const k = f.parentFolderId ?? null;
    if (!byParent.has(k)) byParent.set(k, []);
    byParent.get(k)!.push(f);
  }
  return byParent;
}

function Node({ id, byParent }: { id: string; byParent: Map<string|null, Folder[]> }) {
  const f = (byParent.get(null) ?? []).concat(...byParent.values()).find(x => x.id === id)!;
  const kids = byParent.get(id) ?? [];
  const [open, setOpen] = useState(true);
  return (
    <li>
      <div className="flex items-center gap-1">
        {kids.length > 0 && (
          <button onClick={() => setOpen(!open)} className="text-xs">{open ? '▾' : '▸'}</button>
        )}
        <Link href={`/folders/${f.id}`} className="hover:underline truncate">{f.name}</Link>
      </div>
      {open && kids.length > 0 && (
        <ul className="pl-4">
          {kids.map(k => <Node key={k.id} id={k.id} byParent={byParent} />)}
        </ul>
      )}
    </li>
  );
}

export function FolderTree() {
  const [folders, setFolders] = useState<Folder[]>([]);
  useEffect(() => { fetchAll().then(setFolders); }, []);
  const byParent = group(folders);
  const roots = byParent.get(null) ?? [];
  return (
    <ul className="text-sm space-y-1">
      {roots.map(r => <Node key={r.id} id={r.id} byParent={byParent} />)}
    </ul>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/folders/ src/hooks/
git commit -m "feat(folders): sidebar tree component"
```

### Task 3.4: New folder dialog

**Files:** Create `src/components/folders/NewFolderDialog.tsx`.

- [ ] **Step 1: Implement**

```tsx
'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useRouter } from 'next/navigation';

export function NewFolderDialog({ parentFolderId }: { parentFolderId: string | null }) {
  const [name, setName] = useState('');
  const [open, setOpen] = useState(false);
  const router = useRouter();

  async function submit() {
    if (!name.trim()) return;
    await fetch('/api/folders', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name, parentFolderId }),
    });
    setName(''); setOpen(false); router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm" variant="outline">New folder</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>New folder</DialogTitle></DialogHeader>
        <Input value={name} onChange={e => setName(e.target.value)} placeholder="Folder name" />
        <Button onClick={submit}>Create</Button>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/folders/NewFolderDialog.tsx
git commit -m "feat(folders): new folder dialog"
```

---

## Phase 4 — Pages CRUD + dashboard/folder views

Goal: Create/rename/move/soft-delete pages. Dashboard shows root folders + root pages. Folder view shows children.

### Task 4.1: Pages API

**Files:** `src/app/api/pages/route.ts`, `src/app/api/pages/[id]/route.ts`, `tests/integration/pages.test.ts`.

- [ ] **Step 1: Integration test**

```ts
import { describe, it, expect, vi } from 'vitest';
import { getPrisma } from '../helpers/db';
import { makeUser, makeFolder, makePage } from '../helpers/factories';

vi.mock('@/lib/auth', () => ({ auth: vi.fn(), signIn: vi.fn(), signOut: vi.fn(), handlers: {} }));
vi.mock('@/lib/db', () => ({ db: (globalThis as any).__prisma }));
import { auth } from '@/lib/auth';
import { POST as PAGES_POST, GET as PAGES_GET } from '@/app/api/pages/route';
import { PATCH, DELETE, GET as PAGE_GET } from '@/app/api/pages/[id]/route';

const setUser = (id: string | null) => (auth as any).mockResolvedValue(id ? { user: { id } } : null);
const j = (url: string, body?: object, method: string = 'POST') =>
  new Request(url, { method, headers: { 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined });

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

  it('POST rejects when folderId belongs to someone else', async () => {
    const me = await makeUser();
    const other = await makeUser();
    const otherFolder = await makeFolder(other.id);
    setUser(me.id);
    const res = await PAGES_POST(j('http://x/api/pages', { title: 'Hi', folderId: otherFolder.id }));
    expect(res.status).toBe(403);
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

  it('PATCH renames page when owner', async () => {
    const me = await makeUser();
    const p = await makePage(me.id);
    setUser(me.id);
    const res = await PATCH(
      j(`http://x/api/pages/${p.id}`, { title: 'Renamed' }, 'PATCH'),
      { params: { id: p.id } }
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.title).toBe('Renamed');
  });

  it('DELETE soft-deletes page (sets deletedAt)', async () => {
    const me = await makeUser();
    const p = await makePage(me.id);
    setUser(me.id);
    const res = await DELETE(j(`http://x/api/pages/${p.id}`, undefined, 'DELETE'),
      { params: { id: p.id } });
    expect(res.status).toBe(200);
    const after = await getPrisma().page.findUnique({ where: { id: p.id } });
    expect(after?.deletedAt).toBeTruthy();
  });

  it('GET single page enforces permission', async () => {
    const me = await makeUser();
    const stranger = await makeUser();
    const p = await makePage(me.id);
    setUser(stranger.id);
    const res = await PAGE_GET(j(`http://x/api/pages/${p.id}`, undefined, 'GET'),
      { params: { id: p.id } });
    expect(res.status).toBe(403);
  });
});
```

- [ ] **Step 2: Implement `src/app/api/pages/route.ts`**

```ts
import { z } from 'zod';
import { db } from '@/lib/db';
import { handle, ok, parseBody, requireUserId } from '@/lib/api-helpers';
import { assertFolderOwner } from '@/lib/folders';

const Create = z.object({
  title: z.string().min(1).max(120).default('Untitled'),
  folderId: z.string().nullable().default(null),
});

export const POST = handle(async (req) => {
  const userId = await requireUserId();
  const { title, folderId } = await parseBody(req, Create);
  if (folderId) await assertFolderOwner(db, folderId, userId);
  const page = await db.page.create({
    data: { title, folderId, ownerId: userId,
      currentSceneJson: { elements: [], appState: {}, files: {} } },
  });
  return ok(page);
});

export const GET = handle(async (req) => {
  const userId = await requireUserId();
  const url = new URL(req.url);
  const raw = url.searchParams.get('folderId');
  const folderId = raw === 'null' ? null : raw;
  const where: any = { ownerId: userId, deletedAt: null };
  if (raw !== null) where.folderId = folderId;
  const pages = await db.page.findMany({
    where, orderBy: { updatedAt: 'desc' },
    select: { id: true, title: true, folderId: true, updatedAt: true,
      isPublic: true, thumbnailDataUrl: true },
  });
  return ok(pages);
});
```

- [ ] **Step 3: Implement `src/app/api/pages/[id]/route.ts`**

```ts
import { z } from 'zod';
import { db } from '@/lib/db';
import { handle, ok, parseBody, requireUserId, getUserId } from '@/lib/api-helpers';
import { assertFolderOwner } from '@/lib/folders';
import { assertPagePermission, resolvePagePermission } from '@/lib/permissions';

const Patch = z.object({
  title: z.string().min(1).max(120).optional(),
  folderId: z.string().nullable().optional(),
});

export const GET = handle(async (_req, { params }: { params: { id: string } }) => {
  const userId = await getUserId();
  const perm = await resolvePagePermission(db, params.id, userId);
  if (!perm.canView) return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });
  const page = await db.page.findUnique({ where: { id: params.id } });
  return ok({ page, permission: perm });
});

export const PATCH = handle(async (req, { params }: { params: { id: string } }) => {
  const userId = await requireUserId();
  await assertPagePermission(db, params.id, userId, 'canManage');
  const data = await parseBody(req, Patch);
  if (data.folderId) await assertFolderOwner(db, data.folderId, userId);
  const updated = await db.page.update({ where: { id: params.id }, data });
  return ok(updated);
});

export const DELETE = handle(async (_req, { params }: { params: { id: string } }) => {
  const userId = await requireUserId();
  await assertPagePermission(db, params.id, userId, 'canDelete');
  await db.page.update({ where: { id: params.id }, data: { deletedAt: new Date() } });
  return ok({ ok: true });
});
```

- [ ] **Step 4: Run + commit**

```bash
npm test -- pages
git add src/app/api/pages/ tests/integration/pages.test.ts
git commit -m "feat(pages): CRUD api with permission checks"
```

### Task 4.2: Dashboard + folder view UI

**Files:** Create `src/app/(app)/layout.tsx`, `src/app/(app)/page.tsx`, `src/app/(app)/folders/[folderId]/page.tsx`, `src/components/navigation/TopNav.tsx`, `src/components/navigation/Sidebar.tsx`, `src/components/folders/FolderCard.tsx`, `src/components/pages/PageCard.tsx`, `src/components/pages/NewPageButton.tsx`.

- [ ] **Step 1: Layout `src/app/(app)/layout.tsx`**

```tsx
import { TopNav } from '@/components/navigation/TopNav';
import { Sidebar } from '@/components/navigation/Sidebar';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <TopNav />
      <div className="flex flex-1">
        <aside className="w-64 border-r p-4 hidden md:block">
          <Sidebar />
        </aside>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: TopNav `src/components/navigation/TopNav.tsx`**

```tsx
import Link from 'next/link';
import { signOut, auth } from '@/lib/auth';
import { Button } from '@/components/ui/button';

export async function TopNav() {
  const session = await auth();
  return (
    <header className="border-b px-6 h-14 flex items-center justify-between">
      <Link href="/" className="font-semibold">Mock Excalidraw</Link>
      <div className="flex items-center gap-3">
        <Link href="/shared" className="text-sm">Shared</Link>
        <Link href="/trash" className="text-sm">Trash</Link>
        <span className="text-sm text-muted-foreground">{session?.user?.email}</span>
        <form action={async () => { 'use server'; await signOut({ redirectTo: '/login' }); }}>
          <Button size="sm" variant="outline" type="submit">Sign out</Button>
        </form>
      </div>
    </header>
  );
}
```

- [ ] **Step 3: Sidebar `src/components/navigation/Sidebar.tsx`**

```tsx
import { FolderTree } from '@/components/folders/FolderTree';
import { NewFolderDialog } from '@/components/folders/NewFolderDialog';

export function Sidebar() {
  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <h3 className="text-xs font-semibold uppercase tracking-wide">Folders</h3>
        <NewFolderDialog parentFolderId={null} />
      </div>
      <FolderTree />
    </div>
  );
}
```

- [ ] **Step 4: Cards `src/components/folders/FolderCard.tsx`**

```tsx
import Link from 'next/link';

export function FolderCard({ id, name }: { id: string; name: string }) {
  return (
    <Link href={`/folders/${id}`} className="block p-4 border rounded-lg hover:bg-accent">
      <div className="text-2xl">📁</div>
      <div className="mt-2 font-medium truncate">{name}</div>
    </Link>
  );
}
```

- [ ] **Step 5: `src/components/pages/PageCard.tsx`**

```tsx
import Link from 'next/link';

type Props = { id: string; title: string; thumbnailDataUrl?: string | null; isPublic?: boolean };

export function PageCard({ id, title, thumbnailDataUrl, isPublic }: Props) {
  return (
    <Link href={`/pages/${id}`} className="block border rounded-lg overflow-hidden hover:shadow">
      <div className="aspect-video bg-muted flex items-center justify-center">
        {thumbnailDataUrl
          ? <img src={thumbnailDataUrl} alt="" className="w-full h-full object-cover" />
          : <span className="text-muted-foreground text-sm">No preview</span>}
      </div>
      <div className="p-3 flex justify-between items-center">
        <div className="font-medium truncate">{title}</div>
        {isPublic && <span className="text-xs text-green-600">Public</span>}
      </div>
    </Link>
  );
}
```

- [ ] **Step 6: `src/components/pages/NewPageButton.tsx`**

```tsx
'use client';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';

export function NewPageButton({ folderId }: { folderId: string | null }) {
  const router = useRouter();
  async function create() {
    const r = await fetch('/api/pages', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Untitled', folderId }),
    });
    const p = await r.json();
    router.push(`/pages/${p.id}`);
  }
  return <Button onClick={create}>New page</Button>;
}
```

- [ ] **Step 7: Dashboard `src/app/(app)/page.tsx`**

```tsx
import { db } from '@/lib/db';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { FolderCard } from '@/components/folders/FolderCard';
import { PageCard } from '@/components/pages/PageCard';
import { NewPageButton } from '@/components/pages/NewPageButton';

export default async function Dashboard() {
  const session = await auth();
  const userId = (session?.user as { id?: string })?.id;
  if (!userId) redirect('/login');

  const [folders, pages] = await Promise.all([
    db.folder.findMany({ where: { ownerId: userId, parentFolderId: null, deletedAt: null }, orderBy: { name: 'asc' } }),
    db.page.findMany({
      where: { ownerId: userId, folderId: null, deletedAt: null },
      orderBy: { updatedAt: 'desc' }, take: 24,
    }),
  ]);

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold">Home</h1>
        <NewPageButton folderId={null} />
      </div>

      {folders.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold mb-3">Folders</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
            {folders.map(f => <FolderCard key={f.id} id={f.id} name={f.name} />)}
          </div>
        </section>
      )}

      <section>
        <h2 className="text-sm font-semibold mb-3">Recent pages</h2>
        {pages.length === 0 ? <p className="text-sm text-muted-foreground">No pages yet.</p> : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {pages.map(p => (
              <PageCard key={p.id} id={p.id} title={p.title}
                thumbnailDataUrl={p.thumbnailDataUrl} isPublic={p.isPublic} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
```

- [ ] **Step 8: Folder view `src/app/(app)/folders/[folderId]/page.tsx`**

```tsx
import { db } from '@/lib/db';
import { auth } from '@/lib/auth';
import { notFound, redirect } from 'next/navigation';
import { FolderCard } from '@/components/folders/FolderCard';
import { PageCard } from '@/components/pages/PageCard';
import { NewPageButton } from '@/components/pages/NewPageButton';
import { NewFolderDialog } from '@/components/folders/NewFolderDialog';

export default async function FolderView({ params }: { params: { folderId: string } }) {
  const session = await auth();
  const userId = (session?.user as { id?: string })?.id;
  if (!userId) redirect('/login');

  const folder = await db.folder.findUnique({ where: { id: params.folderId } });
  if (!folder || folder.ownerId !== userId || folder.deletedAt) notFound();

  const [subs, pages] = await Promise.all([
    db.folder.findMany({ where: { ownerId: userId, parentFolderId: folder.id, deletedAt: null }, orderBy: { name: 'asc' } }),
    db.page.findMany({ where: { ownerId: userId, folderId: folder.id, deletedAt: null }, orderBy: { updatedAt: 'desc' } }),
  ]);

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold">{folder.name}</h1>
        <div className="flex gap-2">
          <NewFolderDialog parentFolderId={folder.id} />
          <NewPageButton folderId={folder.id} />
        </div>
      </div>

      {subs.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold mb-3">Folders</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
            {subs.map(f => <FolderCard key={f.id} id={f.id} name={f.name} />)}
          </div>
        </section>
      )}

      <section>
        <h2 className="text-sm font-semibold mb-3">Pages</h2>
        {pages.length === 0 ? <p className="text-sm text-muted-foreground">Empty.</p> : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {pages.map(p => (
              <PageCard key={p.id} id={p.id} title={p.title}
                thumbnailDataUrl={p.thumbnailDataUrl} isPublic={p.isPublic} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
```

- [ ] **Step 9: Manual smoke test**

```bash
npm run dev
```

Sign in, create a folder, create a sub-folder, create a page, navigate around.

- [ ] **Step 10: Commit**

```bash
git add src/app/ src/components/
git commit -m "feat(ui): dashboard + folder view + nav scaffolding"
```

---

## Phase 5 — Editor + autosave

Goal: Opening `/pages/[id]` mounts an Excalidraw canvas with the saved scene. Edits debounce-save to the server. Save status visible.

### Task 5.1: Snapshot lib + save endpoint — TDD

**Files:** `src/lib/snapshots.ts`, `tests/unit/snapshots.test.ts`, `src/app/api/pages/[id]/save/route.ts`.

- [ ] **Step 1: Test snapshot pruning**

```ts
import { describe, it, expect } from 'vitest';
import { saveSceneAndSnapshot, SNAPSHOT_RETENTION } from '@/lib/snapshots';
import { getPrisma } from '../helpers/db';
import { makeUser, makePage } from '../helpers/factories';

describe('saveSceneAndSnapshot', () => {
  it('updates currentSceneJson and creates a snapshot', async () => {
    const me = await makeUser();
    const p = await makePage(me.id);
    const scene = { elements: [{ id: 'a' }], appState: {}, files: {} };
    await saveSceneAndSnapshot(getPrisma(), p.id, me.id, scene);
    const after = await getPrisma().page.findUnique({ where: { id: p.id } });
    expect((after?.currentSceneJson as any).elements[0].id).toBe('a');
    const snaps = await getPrisma().drawingSnapshot.findMany({ where: { pageId: p.id } });
    expect(snaps).toHaveLength(1);
  });

  it('prunes snapshots beyond retention', async () => {
    const me = await makeUser();
    const p = await makePage(me.id);
    for (let i = 0; i < SNAPSHOT_RETENTION + 5; i++) {
      await saveSceneAndSnapshot(getPrisma(), p.id, me.id, { elements: [{ id: `e${i}` }], appState: {}, files: {} });
    }
    const snaps = await getPrisma().drawingSnapshot.findMany({ where: { pageId: p.id } });
    expect(snaps.length).toBe(SNAPSHOT_RETENTION);
  });
});
```

- [ ] **Step 2: Implement `src/lib/snapshots.ts`**

```ts
import type { PrismaClient, Prisma } from '@prisma/client';

export const SNAPSHOT_RETENTION = 20;

export async function saveSceneAndSnapshot(
  db: PrismaClient,
  pageId: string,
  userId: string,
  sceneJson: Prisma.InputJsonValue,
  thumbnailDataUrl?: string | null,
) {
  await db.page.update({
    where: { id: pageId },
    data: { currentSceneJson: sceneJson, ...(thumbnailDataUrl !== undefined && { thumbnailDataUrl }) },
  });
  await db.drawingSnapshot.create({
    data: { pageId, sceneJson, createdByUserId: userId },
  });
  const all = await db.drawingSnapshot.findMany({
    where: { pageId }, orderBy: { createdAt: 'desc' }, select: { id: true },
  });
  const toDelete = all.slice(SNAPSHOT_RETENTION).map(s => s.id);
  if (toDelete.length) await db.drawingSnapshot.deleteMany({ where: { id: { in: toDelete } } });
}
```

- [ ] **Step 3: Run + commit**

```bash
npm test -- snapshots
git add src/lib/snapshots.ts tests/unit/snapshots.test.ts
git commit -m "feat(snapshots): persist + prune (TDD)"
```

- [ ] **Step 4: Implement save route `src/app/api/pages/[id]/save/route.ts`**

> Lock check is added in Phase 9. For now any user with `canEdit` can save.

```ts
import { z } from 'zod';
import { db } from '@/lib/db';
import { handle, ok, parseBody, requireUserId } from '@/lib/api-helpers';
import { assertPagePermission } from '@/lib/permissions';
import { saveSceneAndSnapshot } from '@/lib/snapshots';

const Save = z.object({
  sceneJson: z.any(),
  thumbnailDataUrl: z.string().nullable().optional(),
});

export const POST = handle(async (req, { params }: { params: { id: string } }) => {
  const userId = await requireUserId();
  await assertPagePermission(db, params.id, userId, 'canEdit');
  const { sceneJson, thumbnailDataUrl } = await parseBody(req, Save);
  await saveSceneAndSnapshot(db, params.id, userId, sceneJson, thumbnailDataUrl ?? undefined);
  return ok({ savedAt: new Date().toISOString() });
});
```

- [ ] **Step 5: Commit**

```bash
git add src/app/api/pages/
git commit -m "feat(pages): autosave endpoint"
```

### Task 5.2: Excalidraw canvas component

**Files:** `src/components/editor/ExcalidrawCanvas.tsx`, `src/hooks/useAutosave.ts`.

- [ ] **Step 1: `src/hooks/useAutosave.ts`**

```ts
'use client';
import { useEffect, useRef, useState } from 'react';

type Status = 'idle' | 'saving' | 'saved' | 'error';

export function useAutosave<T>(value: T, save: (v: T) => Promise<void>, delayMs = 2000) {
  const [status, setStatus] = useState<Status>('idle');
  const timer = useRef<NodeJS.Timeout | null>(null);
  const latest = useRef<T>(value);
  latest.current = value;

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      setStatus('saving');
      try { await save(latest.current); setStatus('saved'); }
      catch { setStatus('error'); }
    }, delayMs);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [value, delayMs]);

  return status;
}
```

- [ ] **Step 2: `src/components/editor/ExcalidrawCanvas.tsx`**

```tsx
'use client';
import dynamic from 'next/dynamic';
import { useState, useCallback } from 'react';
import { useAutosave } from '@/hooks/useAutosave';

const Excalidraw = dynamic(
  async () => (await import('@excalidraw/excalidraw')).Excalidraw,
  { ssr: false, loading: () => <div className="p-6">Loading editor...</div> },
);

type Scene = { elements: any[]; appState: any; files: any };

type Props = {
  pageId: string;
  initialScene: Scene;
  readOnly: boolean;
};

export function ExcalidrawCanvas({ pageId, initialScene, readOnly }: Props) {
  const [scene, setScene] = useState<Scene>(initialScene);

  const status = useAutosave(scene, async (s) => {
    if (readOnly) return;
    await fetch(`/api/pages/${pageId}/save`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sceneJson: s }),
    });
  });

  const onChange = useCallback((elements: any, appState: any, files: any) => {
    setScene({ elements: Array.from(elements), appState, files });
  }, []);

  return (
    <div className="relative h-[calc(100vh-3.5rem)]">
      <div className="absolute top-2 right-2 z-10 text-xs px-2 py-1 bg-background border rounded">
        {status === 'saving' ? 'Saving…' : status === 'saved' ? 'Saved' : status === 'error' ? 'Save failed' : ''}
      </div>
      <Excalidraw
        initialData={initialScene as any}
        onChange={onChange}
        viewModeEnabled={readOnly}
      />
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/editor/ src/hooks/useAutosave.ts
git commit -m "feat(editor): excalidraw canvas + autosave hook"
```

### Task 5.3: Editor route + EditorChrome

**Files:** `src/app/(app)/pages/[pageId]/page.tsx`, `src/components/editor/EditorChrome.tsx`.

- [ ] **Step 1: `src/components/editor/EditorChrome.tsx`** (top bar with title, history, share buttons — share/history wired in later phases)

```tsx
'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export function EditorChrome({ pageId, title, canManage }: { pageId: string; title: string; canManage: boolean }) {
  const [t, setT] = useState(title);
  async function save() {
    await fetch(`/api/pages/${pageId}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: t }),
    });
  }
  return (
    <header className="border-b px-4 h-12 flex items-center gap-3">
      <Link href="/" className="text-sm">← Back</Link>
      <input
        className="bg-transparent flex-1 outline-none text-sm font-medium"
        value={t}
        onChange={e => setT(e.target.value)}
        onBlur={save}
        readOnly={!canManage}
      />
      {/* History + Share buttons added in Phase 6 / 7 */}
    </header>
  );
}
```

- [ ] **Step 2: Editor page `src/app/(app)/pages/[pageId]/page.tsx`**

```tsx
import { db } from '@/lib/db';
import { auth } from '@/lib/auth';
import { redirect, notFound } from 'next/navigation';
import { resolvePagePermission } from '@/lib/permissions';
import { ExcalidrawCanvas } from '@/components/editor/ExcalidrawCanvas';
import { EditorChrome } from '@/components/editor/EditorChrome';

export default async function EditorPage({ params }: { params: { pageId: string } }) {
  const session = await auth();
  const userId = (session?.user as { id?: string })?.id;
  if (!userId) redirect('/login');

  const perm = await resolvePagePermission(db, params.pageId, userId);
  if (!perm.canView) notFound();

  const page = await db.page.findUnique({ where: { id: params.pageId } });
  if (!page) notFound();

  return (
    <div className="-m-6 -mt-0">
      <EditorChrome pageId={page.id} title={page.title} canManage={perm.canManage} />
      <ExcalidrawCanvas
        pageId={page.id}
        initialScene={page.currentSceneJson as any}
        readOnly={!perm.canEdit}
      />
    </div>
  );
}
```

- [ ] **Step 3: Manual test**

```bash
npm run dev
```

Open a page, draw something, wait 2s — see "Saved". Refresh — drawing persists.

- [ ] **Step 4: Commit**

```bash
git add src/app/(app)/pages/ src/components/editor/EditorChrome.tsx
git commit -m "feat(editor): editor route with chrome + canvas"
```

---

## Phase 6 — Versioning

Goal: List snapshots, preview them in read-only canvas, restore one (which writes a new snapshot from the old scene).

### Task 6.1: Snapshots list + restore endpoints

**Files:** `src/app/api/pages/[id]/snapshots/route.ts`, `src/app/api/pages/[id]/restore/route.ts`, `tests/integration/snapshots.test.ts`.

- [ ] **Step 1: Test**

```ts
import { describe, it, expect, vi } from 'vitest';
import { getPrisma } from '../helpers/db';
import { makeUser, makePage } from '../helpers/factories';
import { saveSceneAndSnapshot } from '@/lib/snapshots';

vi.mock('@/lib/auth', () => ({ auth: vi.fn(), signIn: vi.fn(), signOut: vi.fn(), handlers: {} }));
vi.mock('@/lib/db', () => ({ db: (globalThis as any).__prisma }));
import { auth } from '@/lib/auth';
import { GET as LIST } from '@/app/api/pages/[id]/snapshots/route';
import { POST as RESTORE } from '@/app/api/pages/[id]/restore/route';

const u = (id: string | null) => (auth as any).mockResolvedValue(id ? { user: { id } } : null);

describe('snapshots api', () => {
  it('lists snapshots newest first', async () => {
    const me = await makeUser();
    const p = await makePage(me.id);
    await saveSceneAndSnapshot(getPrisma(), p.id, me.id, { elements: [{ id: 'a' }], appState: {}, files: {} });
    await saveSceneAndSnapshot(getPrisma(), p.id, me.id, { elements: [{ id: 'b' }], appState: {}, files: {} });
    u(me.id);
    const res = await LIST(new Request('http://x'), { params: { id: p.id } });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json[0].sceneJson.elements[0].id).toBe('b');
    expect(json[1].sceneJson.elements[0].id).toBe('a');
  });

  it('restore creates a new snapshot from the old scene', async () => {
    const me = await makeUser();
    const p = await makePage(me.id);
    await saveSceneAndSnapshot(getPrisma(), p.id, me.id, { elements: [{ id: 'OLD' }], appState: {}, files: {} });
    await saveSceneAndSnapshot(getPrisma(), p.id, me.id, { elements: [{ id: 'NEW' }], appState: {}, files: {} });
    const snaps = await getPrisma().drawingSnapshot.findMany({ where: { pageId: p.id }, orderBy: { createdAt: 'asc' } });
    const oldId = snaps[0].id;
    u(me.id);
    const res = await RESTORE(
      new Request('http://x', { method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ snapshotId: oldId }) }),
      { params: { id: p.id } }
    );
    expect(res.status).toBe(200);
    const after = await getPrisma().page.findUnique({ where: { id: p.id } });
    expect((after?.currentSceneJson as any).elements[0].id).toBe('OLD');
    const total = await getPrisma().drawingSnapshot.count({ where: { pageId: p.id } });
    expect(total).toBe(3);
  });
});
```

- [ ] **Step 2: `src/app/api/pages/[id]/snapshots/route.ts`**

```ts
import { db } from '@/lib/db';
import { handle, ok, requireUserId } from '@/lib/api-helpers';
import { assertPagePermission } from '@/lib/permissions';

export const GET = handle(async (_req, { params }: { params: { id: string } }) => {
  const userId = await requireUserId();
  await assertPagePermission(db, params.id, userId, 'canView');
  const snaps = await db.drawingSnapshot.findMany({
    where: { pageId: params.id },
    orderBy: { createdAt: 'desc' },
    include: { },
  });
  const withUser = await Promise.all(snaps.map(async s => {
    const u = await db.user.findUnique({ where: { id: s.createdByUserId }, select: { name: true, image: true } });
    return { ...s, author: u };
  }));
  return ok(withUser);
});
```

- [ ] **Step 3: `src/app/api/pages/[id]/restore/route.ts`**

```ts
import { z } from 'zod';
import { db } from '@/lib/db';
import { handle, ok, parseBody, requireUserId, ResponseError } from '@/lib/api-helpers';
import { assertPagePermission } from '@/lib/permissions';
import { saveSceneAndSnapshot } from '@/lib/snapshots';

const Restore = z.object({ snapshotId: z.string() });

export const POST = handle(async (req, { params }: { params: { id: string } }) => {
  const userId = await requireUserId();
  await assertPagePermission(db, params.id, userId, 'canEdit');
  const { snapshotId } = await parseBody(req, Restore);
  const snap = await db.drawingSnapshot.findUnique({ where: { id: snapshotId } });
  if (!snap || snap.pageId !== params.id) throw new ResponseError(404, 'Snapshot not found');
  await saveSceneAndSnapshot(db, params.id, userId, snap.sceneJson as any);
  return ok({ ok: true });
});
```

- [ ] **Step 4: Run + commit**

```bash
npm test -- snapshots
git add src/app/api/pages/ tests/integration/snapshots.test.ts
git commit -m "feat(versioning): list + restore snapshots api"
```

### Task 6.2: History drawer UI

**Files:** `src/components/editor/HistoryDrawer.tsx`, modify `src/components/editor/EditorChrome.tsx`.

- [ ] **Step 1: Implement drawer**

```tsx
'use client';
import { useEffect, useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';

type Snapshot = {
  id: string; createdAt: string;
  author: { name: string | null; image: string | null } | null;
};

export function HistoryDrawer({ pageId, canEdit, onPreview, onRestore }: {
  pageId: string;
  canEdit: boolean;
  onPreview: (snapshotId: string) => void;
  onRestore: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Snapshot[]>([]);

  useEffect(() => {
    if (!open) return;
    fetch(`/api/pages/${pageId}/snapshots`).then(r => r.json()).then(setItems);
  }, [open, pageId]);

  async function restore(snapshotId: string) {
    await fetch(`/api/pages/${pageId}/restore`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ snapshotId }),
    });
    setOpen(false);
    onRestore();
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild><Button size="sm" variant="outline">History</Button></SheetTrigger>
      <SheetContent>
        <SheetHeader><SheetTitle>Version history</SheetTitle></SheetHeader>
        <ul className="mt-4 space-y-2">
          {items.map(s => (
            <li key={s.id} className="border rounded p-3 flex justify-between items-center">
              <div>
                <div className="text-sm">{new Date(s.createdAt).toLocaleString()}</div>
                <div className="text-xs text-muted-foreground">{s.author?.name ?? 'Unknown'}</div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" onClick={() => onPreview(s.id)}>Preview</Button>
                {canEdit && <Button size="sm" onClick={() => restore(s.id)}>Restore</Button>}
              </div>
            </li>
          ))}
          {items.length === 0 && <li className="text-sm text-muted-foreground">No history yet.</li>}
        </ul>
      </SheetContent>
    </Sheet>
  );
}
```

- [ ] **Step 2: Wire into EditorChrome**

Replace `src/components/editor/EditorChrome.tsx` body to accept and render the drawer/share buttons. For now stub the preview/restore callbacks (will be wired into ExcalidrawCanvas next):

```tsx
'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { HistoryDrawer } from './HistoryDrawer';
import { useRouter } from 'next/navigation';

export function EditorChrome({ pageId, title, canManage, canEdit }: {
  pageId: string; title: string; canManage: boolean; canEdit: boolean;
}) {
  const [t, setT] = useState(title);
  const router = useRouter();

  async function save() {
    await fetch(`/api/pages/${pageId}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: t }),
    });
  }

  return (
    <header className="border-b px-4 h-12 flex items-center gap-3">
      <Link href="/" className="text-sm">← Back</Link>
      <input
        className="bg-transparent flex-1 outline-none text-sm font-medium"
        value={t}
        onChange={e => setT(e.target.value)}
        onBlur={save}
        readOnly={!canManage}
      />
      <HistoryDrawer
        pageId={pageId}
        canEdit={canEdit}
        onPreview={(id) => router.push(`/pages/${pageId}?preview=${id}`)}
        onRestore={() => router.refresh()}
      />
      {/* Share button added in Phase 7 */}
    </header>
  );
}
```

- [ ] **Step 3: Update editor page to pass `canEdit` and to load preview snapshot when `?preview=` set**

Replace the `Page` body in `src/app/(app)/pages/[pageId]/page.tsx`:

```tsx
import { db } from '@/lib/db';
import { auth } from '@/lib/auth';
import { redirect, notFound } from 'next/navigation';
import { resolvePagePermission } from '@/lib/permissions';
import { ExcalidrawCanvas } from '@/components/editor/ExcalidrawCanvas';
import { EditorChrome } from '@/components/editor/EditorChrome';

export default async function EditorPage({
  params, searchParams,
}: { params: { pageId: string }, searchParams: { preview?: string } }) {
  const session = await auth();
  const userId = (session?.user as { id?: string })?.id;
  if (!userId) redirect('/login');

  const perm = await resolvePagePermission(db, params.pageId, userId);
  if (!perm.canView) notFound();

  const page = await db.page.findUnique({ where: { id: params.pageId } });
  if (!page) notFound();

  let scene = page.currentSceneJson as any;
  let previewing = false;
  if (searchParams.preview) {
    const snap = await db.drawingSnapshot.findUnique({ where: { id: searchParams.preview } });
    if (snap?.pageId === page.id) { scene = snap.sceneJson as any; previewing = true; }
  }

  return (
    <div className="-m-6 -mt-0">
      <EditorChrome pageId={page.id} title={page.title} canManage={perm.canManage} canEdit={perm.canEdit} />
      {previewing && (
        <div className="bg-yellow-100 px-4 py-2 text-sm">
          Previewing a previous version (read-only). <a href={`/pages/${page.id}`} className="underline">Exit preview</a>
        </div>
      )}
      <ExcalidrawCanvas
        pageId={page.id}
        initialScene={scene}
        readOnly={previewing || !perm.canEdit}
      />
    </div>
  );
}
```

- [ ] **Step 4: Manual test**

Open editor, draw, wait for save, draw again, wait for save. Open History → see two entries → click Preview → URL updates and canvas shows old state → click Restore → URL clears, canvas shows old state restored.

- [ ] **Step 5: Commit**

```bash
git add src/app/(app)/pages/ src/components/editor/
git commit -m "feat(versioning): history drawer + preview/restore UI"
```

---

## Phase 7 — Public link sharing

Goal: Owner toggles "Public link" → page gets a `publicSlug`. URL `/p/<slug>` renders read-only viewer for anyone (no auth needed). Toggle off invalidates the slug.

### Task 7.1: Share endpoint (public toggle) — TDD

**Files:** `src/app/api/pages/[id]/share/route.ts`, `tests/integration/sharing.test.ts`.

- [ ] **Step 1: Test**

```ts
import { describe, it, expect, vi } from 'vitest';
import { getPrisma } from '../helpers/db';
import { makeUser, makePage } from '../helpers/factories';

vi.mock('@/lib/auth', () => ({ auth: vi.fn(), signIn: vi.fn(), signOut: vi.fn(), handlers: {} }));
vi.mock('@/lib/db', () => ({ db: (globalThis as any).__prisma }));
import { auth } from '@/lib/auth';
import { GET, PATCH } from '@/app/api/pages/[id]/share/route';

const u = (id: string | null) => (auth as any).mockResolvedValue(id ? { user: { id } } : null);
const j = (body: object) => new Request('http://x', { method: 'PATCH',
  headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

describe('share api', () => {
  it('PATCH isPublic=true generates slug', async () => {
    const me = await makeUser();
    const p = await makePage(me.id);
    u(me.id);
    const res = await PATCH(j({ isPublic: true }), { params: { id: p.id } });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.publicSlug).toMatch(/^[A-Za-z0-9_-]{8}$/);
    expect(json.isPublic).toBe(true);
  });

  it('PATCH isPublic=false clears slug', async () => {
    const me = await makeUser();
    const p = await makePage(me.id);
    u(me.id);
    await PATCH(j({ isPublic: true }), { params: { id: p.id } });
    const res = await PATCH(j({ isPublic: false }), { params: { id: p.id } });
    const json = await res.json();
    expect(json.isPublic).toBe(false);
    expect(json.publicSlug).toBeNull();
  });

  it('toggling on twice rotates slug', async () => {
    const me = await makeUser();
    const p = await makePage(me.id);
    u(me.id);
    const r1 = await (await PATCH(j({ isPublic: true }), { params: { id: p.id } })).json();
    await PATCH(j({ isPublic: false }), { params: { id: p.id } });
    const r2 = await (await PATCH(j({ isPublic: true }), { params: { id: p.id } })).json();
    expect(r1.publicSlug).not.toBe(r2.publicSlug);
  });

  it('non-owner cannot share', async () => {
    const me = await makeUser();
    const stranger = await makeUser();
    const p = await makePage(me.id);
    u(stranger.id);
    const res = await PATCH(j({ isPublic: true }), { params: { id: p.id } });
    expect(res.status).toBe(403);
  });
});
```

- [ ] **Step 2: Implement `src/app/api/pages/[id]/share/route.ts`**

```ts
import { z } from 'zod';
import { db } from '@/lib/db';
import { handle, ok, parseBody, requireUserId } from '@/lib/api-helpers';
import { assertPagePermission } from '@/lib/permissions';
import { newPublicSlug } from '@/lib/ids';

const Patch = z.object({
  isPublic: z.boolean().optional(),
});

export const GET = handle(async (_req, { params }: { params: { id: string } }) => {
  const userId = await requireUserId();
  await assertPagePermission(db, params.id, userId, 'canManage');
  const page = await db.page.findUnique({ where: { id: params.id },
    select: { isPublic: true, publicSlug: true } });
  const collabs = await db.collaborator.findMany({ where: { pageId: params.id } });
  return ok({ ...page, collaborators: collabs });
});

export const PATCH = handle(async (req, { params }: { params: { id: string } }) => {
  const userId = await requireUserId();
  await assertPagePermission(db, params.id, userId, 'canManage');
  const { isPublic } = await parseBody(req, Patch);
  const data: any = {};
  if (isPublic === true)  { data.isPublic = true;  data.publicSlug = newPublicSlug(); }
  if (isPublic === false) { data.isPublic = false; data.publicSlug = null; }
  const updated = await db.page.update({ where: { id: params.id }, data,
    select: { id: true, isPublic: true, publicSlug: true } });
  return ok(updated);
});
```

- [ ] **Step 3: Run + commit**

```bash
npm test -- sharing
git add src/app/api/pages/ tests/integration/sharing.test.ts
git commit -m "feat(sharing): public toggle with slug rotation (TDD)"
```

### Task 7.2: Share dialog UI

**Files:** `src/components/editor/ShareDialog.tsx`, modify `EditorChrome`.

- [ ] **Step 1: Implement `src/components/editor/ShareDialog.tsx`**

```tsx
'use client';
import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

export function ShareDialog({ pageId }: { pageId: string }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<{ isPublic: boolean; publicSlug: string | null } | null>(null);

  useEffect(() => {
    if (!open) return;
    fetch(`/api/pages/${pageId}/share`).then(r => r.json()).then(setData);
  }, [open, pageId]);

  async function toggle(next: boolean) {
    const r = await fetch(`/api/pages/${pageId}/share`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ isPublic: next }),
    });
    setData(await r.json());
  }

  const url = data?.publicSlug
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/p/${data.publicSlug}`
    : '';

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm">Share</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Share this page</DialogTitle></DialogHeader>
        <section className="space-y-3">
          <div className="flex justify-between items-center">
            <div>
              <div className="font-medium">Public link</div>
              <div className="text-sm text-muted-foreground">Anyone with the link can view.</div>
            </div>
            <Button variant={data?.isPublic ? 'default' : 'outline'}
                    onClick={() => toggle(!data?.isPublic)}>
              {data?.isPublic ? 'On' : 'Off'}
            </Button>
          </div>
          {data?.isPublic && (
            <div className="flex gap-2">
              <input readOnly value={url} className="flex-1 border rounded px-2 py-1 text-sm" />
              <Button size="sm" onClick={() => navigator.clipboard.writeText(url)}>Copy</Button>
            </div>
          )}
          {/* Collaborators section added in Phase 8 */}
        </section>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Add `<ShareDialog>` to EditorChrome (only when `canManage`)**

In `src/components/editor/EditorChrome.tsx`, after the HistoryDrawer:

```tsx
{canManage && <ShareDialog pageId={pageId} />}
```

And import: `import { ShareDialog } from './ShareDialog';`

- [ ] **Step 3: Public viewer page `src/app/p/[publicSlug]/page.tsx`**

```tsx
import { db } from '@/lib/db';
import { notFound } from 'next/navigation';
import { ExcalidrawCanvas } from '@/components/editor/ExcalidrawCanvas';

export default async function PublicViewer({ params }: { params: { publicSlug: string } }) {
  const page = await db.page.findUnique({ where: { publicSlug: params.publicSlug } });
  if (!page || !page.isPublic || page.deletedAt) notFound();

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b px-4 h-12 flex items-center text-sm font-medium">
        {page.title} <span className="ml-2 text-xs text-muted-foreground">(read only)</span>
      </header>
      <ExcalidrawCanvas pageId={page.id} initialScene={page.currentSceneJson as any} readOnly />
    </div>
  );
}
```

- [ ] **Step 4: Manual test**

Toggle public on a page, copy URL, open in incognito → drawing renders read-only.

- [ ] **Step 5: Commit**

```bash
git add src/components/editor/ShareDialog.tsx src/components/editor/EditorChrome.tsx src/app/p/
git commit -m "feat(sharing): share dialog + public viewer route"
```

---

## Phase 8 — Collaborators

Goal: Owner invites collaborators by email with role. Existing users get linked immediately; unknown emails are stored and back-linked on first Google login. Notifications fire (Phase 11 wires them; for now we just create the row).

### Task 8.1: Invite back-link helper — TDD

**Files:** `src/lib/invites.ts`, `tests/unit/invites.test.ts`.

- [ ] **Step 1: Test**

```ts
import { describe, it, expect } from 'vitest';
import { backLinkInvitesForUser } from '@/lib/invites';
import { getPrisma } from '../helpers/db';
import { makeUser, makePage } from '../helpers/factories';

describe('backLinkInvitesForUser', () => {
  it('links unlinked collaborator rows by email and returns linked pageIds', async () => {
    const inviter = await makeUser();
    const p1 = await makePage(inviter.id);
    const p2 = await makePage(inviter.id);
    const db = getPrisma();
    await db.collaborator.create({ data: { pageId: p1.id, email: 'new@example.com',
      role: 'AUTHOR', invitedByUserId: inviter.id } });
    await db.collaborator.create({ data: { pageId: p2.id, email: 'new@example.com',
      role: 'VIEWER', invitedByUserId: inviter.id } });

    const newUser = await makeUser({ email: 'new@example.com' });
    const linked = await backLinkInvitesForUser(db, newUser.id, newUser.email);
    expect(linked.sort()).toEqual([p1.id, p2.id].sort());

    const rows = await db.collaborator.findMany({ where: { email: 'new@example.com' } });
    expect(rows.every(r => r.userId === newUser.id)).toBe(true);
  });

  it('does nothing if no pending invites', async () => {
    const u = await makeUser({ email: 'fresh@example.com' });
    const linked = await backLinkInvitesForUser(getPrisma(), u.id, u.email);
    expect(linked).toEqual([]);
  });
});
```

- [ ] **Step 2: Implement**

```ts
import type { PrismaClient } from '@prisma/client';

export async function backLinkInvitesForUser(
  db: PrismaClient,
  userId: string,
  email: string,
): Promise<string[]> {
  const pending = await db.collaborator.findMany({ where: { email, userId: null } });
  if (pending.length === 0) return [];
  await db.collaborator.updateMany({ where: { email, userId: null }, data: { userId } });
  return pending.map(p => p.pageId);
}
```

- [ ] **Step 3: Wire into Auth.js signIn callback — modify `src/lib/auth.ts`**

Add to the NextAuth options:

```ts
events: {
  async signIn({ user }) {
    if (user.id && user.email) {
      const { backLinkInvitesForUser } = await import('@/lib/invites');
      await backLinkInvitesForUser(db, user.id, user.email);
    }
  },
},
```

- [ ] **Step 4: Run + commit**

```bash
npm test -- invites
git add src/lib/invites.ts src/lib/auth.ts tests/unit/invites.test.ts
git commit -m "feat(invites): back-link pending collaborators on first login (TDD)"
```

### Task 8.2: Collaborator endpoints

**Files:** Modify `src/app/api/pages/[id]/share/route.ts`; add invite + revoke verbs.

- [ ] **Step 1: Test add + revoke `tests/integration/collaborators.test.ts`**

```ts
import { describe, it, expect, vi } from 'vitest';
import { getPrisma } from '../helpers/db';
import { makeUser, makePage } from '../helpers/factories';

vi.mock('@/lib/auth', () => ({ auth: vi.fn(), signIn: vi.fn(), signOut: vi.fn(), handlers: {} }));
vi.mock('@/lib/db', () => ({ db: (globalThis as any).__prisma }));
import { auth } from '@/lib/auth';
import { POST, DELETE } from '@/app/api/pages/[id]/share/collaborators/route';

const u = (id: string | null) => (auth as any).mockResolvedValue(id ? { user: { id } } : null);
const j = (body: object, m = 'POST') => new Request('http://x', { method: m,
  headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

describe('collaborators api', () => {
  it('POST adds existing user immediately', async () => {
    const me = await makeUser();
    const friend = await makeUser({ email: 'friend@example.com' });
    const p = await makePage(me.id);
    u(me.id);
    const res = await POST(j({ email: 'friend@example.com', role: 'AUTHOR' }), { params: { id: p.id } });
    expect(res.status).toBe(200);
    const row = await getPrisma().collaborator.findFirst({ where: { pageId: p.id } });
    expect(row?.userId).toBe(friend.id);
  });

  it('POST adds unknown email as pending (userId null)', async () => {
    const me = await makeUser();
    const p = await makePage(me.id);
    u(me.id);
    await POST(j({ email: 'pending@example.com', role: 'VIEWER' }), { params: { id: p.id } });
    const row = await getPrisma().collaborator.findFirst({ where: { pageId: p.id } });
    expect(row?.userId).toBeNull();
    expect(row?.email).toBe('pending@example.com');
  });

  it('DELETE revokes a collaborator', async () => {
    const me = await makeUser();
    const friend = await makeUser({ email: 'friend@example.com' });
    const p = await makePage(me.id);
    u(me.id);
    await POST(j({ email: 'friend@example.com', role: 'AUTHOR' }), { params: { id: p.id } });
    const row = await getPrisma().collaborator.findFirst({ where: { pageId: p.id } });
    const res = await DELETE(j({ collaboratorId: row!.id }, 'DELETE'), { params: { id: p.id } });
    expect(res.status).toBe(200);
    expect(await getPrisma().collaborator.count({ where: { pageId: p.id } })).toBe(0);
  });
});
```

- [ ] **Step 2: Implement `src/app/api/pages/[id]/share/collaborators/route.ts`**

```ts
import { z } from 'zod';
import { db } from '@/lib/db';
import { handle, ok, parseBody, requireUserId, ResponseError } from '@/lib/api-helpers';
import { assertPagePermission } from '@/lib/permissions';

const AddBody = z.object({
  email: z.string().email(),
  role: z.enum(['AUTHOR', 'VIEWER']),
});
const RemoveBody = z.object({ collaboratorId: z.string() });

export const POST = handle(async (req, { params }: { params: { id: string } }) => {
  const userId = await requireUserId();
  await assertPagePermission(db, params.id, userId, 'canManage');
  const { email, role } = await parseBody(req, AddBody);

  const existing = await db.user.findUnique({ where: { email } });
  const collab = await db.collaborator.upsert({
    where: { pageId_email: { pageId: params.id, email } },
    create: { pageId: params.id, email, role, invitedByUserId: userId,
              userId: existing?.id ?? null },
    update: { role, userId: existing?.id ?? null },
  });

  if (existing) {
    // Phase 11 will dispatch notification here.
  }

  return ok(collab);
});

export const DELETE = handle(async (req, { params }: { params: { id: string } }) => {
  const userId = await requireUserId();
  await assertPagePermission(db, params.id, userId, 'canManage');
  const { collaboratorId } = await parseBody(req, RemoveBody);
  const c = await db.collaborator.findUnique({ where: { id: collaboratorId } });
  if (!c || c.pageId !== params.id) throw new ResponseError(404, 'Collaborator not found');
  await db.collaborator.delete({ where: { id: collaboratorId } });
  return ok({ ok: true });
});
```

- [ ] **Step 3: Run + commit**

```bash
npm test -- collaborators
git add src/app/api/pages/ tests/integration/collaborators.test.ts
git commit -m "feat(collaborators): invite (with deferred link) + revoke"
```

### Task 8.3: Collaborator UI in ShareDialog

**Files:** Modify `src/components/editor/ShareDialog.tsx`.

- [ ] **Step 1: Add Collaborators section**

Replace the `// Collaborators section added in Phase 8` comment with:

```tsx
<CollaboratorsSection pageId={pageId} />
```

And add at the bottom of the file:

```tsx
type Collab = { id: string; email: string; role: 'AUTHOR'|'VIEWER'; userId: string | null };

function CollaboratorsSection({ pageId }: { pageId: string }) {
  const [list, setList] = useState<Collab[]>([]);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'AUTHOR'|'VIEWER'>('AUTHOR');

  async function refresh() {
    const r = await fetch(`/api/pages/${pageId}/share`);
    const j = await r.json();
    setList(j.collaborators ?? []);
  }
  useEffect(() => { refresh(); }, [pageId]);

  async function add() {
    if (!email.trim()) return;
    await fetch(`/api/pages/${pageId}/share/collaborators`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, role }),
    });
    setEmail(''); refresh();
  }
  async function remove(id: string) {
    await fetch(`/api/pages/${pageId}/share/collaborators`, {
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ collaboratorId: id }),
    });
    refresh();
  }

  return (
    <div className="space-y-3 border-t pt-3">
      <div className="font-medium">Collaborators</div>
      <div className="flex gap-2">
        <input value={email} onChange={e => setEmail(e.target.value)} placeholder="email@example.com"
          className="flex-1 border rounded px-2 py-1 text-sm" />
        <select value={role} onChange={e => setRole(e.target.value as any)} className="border rounded text-sm px-2">
          <option value="AUTHOR">Author</option>
          <option value="VIEWER">Viewer</option>
        </select>
        <Button size="sm" onClick={add}>Add</Button>
      </div>
      <ul className="space-y-1">
        {list.map(c => (
          <li key={c.id} className="flex justify-between items-center text-sm">
            <span>{c.email} <span className="text-xs text-muted-foreground">({c.role.toLowerCase()}{c.userId ? '' : ', pending'})</span></span>
            <Button size="sm" variant="ghost" onClick={() => remove(c.id)}>Remove</Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 2: Manual test**

Open Share dialog, invite a real Google email + a fake one. Sign in as the real user → should see page in `/shared` (built in Phase 14 polish — for now access by visiting the page URL).

- [ ] **Step 3: Commit**

```bash
git add src/components/editor/ShareDialog.tsx
git commit -m "feat(collaborators): UI in share dialog"
```

---

## Phase 9 — Lock (turn-based collaboration)

Goal: Editor acquires a lock on open. Heartbeat refreshes it. Save endpoints reject saves from non-holders. Other users see "X is editing" with countdown.

### Task 9.1: Lock state machine — TDD

**Files:** `src/lib/lock.ts`, `tests/unit/lock.test.ts`.

- [ ] **Step 1: Test**

```ts
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

  it('heartbeat extends own lock', async () => {
    const me = await makeUser();
    const p = await makePage(me.id);
    await acquireLock(getPrisma(), p.id, me.id);
    const before = (await getPrisma().page.findUnique({ where: { id: p.id } }))!.editingExpiresAt!;
    await new Promise(r => setTimeout(r, 50));
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

  it('release clears lock', async () => {
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

  it('TTL is at least 5 minutes', () => {
    expect(LOCK_TTL_MS).toBeGreaterThanOrEqual(5 * 60 * 1000);
  });
});
```

- [ ] **Step 2: Implement `src/lib/lock.ts`**

```ts
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

export async function acquireLock(db: PrismaClient, pageId: string, userId: string): Promise<LockResult> {
  const state = await getLockState(db, pageId);
  if (state.holderUserId && state.holderUserId !== userId) {
    return { granted: false, holderUserId: state.holderUserId, expiresAt: state.expiresAt };
  }
  const expiresAt = new Date(Date.now() + LOCK_TTL_MS);
  await db.page.update({ where: { id: pageId },
    data: { editingUserId: userId, editingExpiresAt: expiresAt } });
  return { granted: true, holderUserId: userId, expiresAt };
}

export async function heartbeat(db: PrismaClient, pageId: string, userId: string): Promise<LockResult> {
  const p = await db.page.findUnique({ where: { id: pageId },
    select: { editingUserId: true, editingExpiresAt: true } });
  if (!p || p.editingUserId !== userId) {
    return { granted: false, holderUserId: p?.editingUserId ?? null, expiresAt: p?.editingExpiresAt ?? null };
  }
  const expiresAt = new Date(Date.now() + LOCK_TTL_MS);
  await db.page.update({ where: { id: pageId },
    data: { editingExpiresAt: expiresAt } });
  return { granted: true, holderUserId: userId, expiresAt };
}

export async function releaseLock(db: PrismaClient, pageId: string, userId: string): Promise<void> {
  const p = await db.page.findUnique({ where: { id: pageId }, select: { editingUserId: true } });
  if (!p || p.editingUserId !== userId) return;
  await db.page.update({ where: { id: pageId },
    data: { editingUserId: null, editingExpiresAt: null } });
}
```

- [ ] **Step 3: Run + commit**

```bash
npm test -- lock
git add src/lib/lock.ts tests/unit/lock.test.ts
git commit -m "feat(lock): turn-based lock state machine (TDD)"
```

### Task 9.2: Lock endpoints

**Files:** `src/app/api/pages/[id]/lock/{acquire,heartbeat,release}/route.ts`.

- [ ] **Step 1: Acquire `src/app/api/pages/[id]/lock/acquire/route.ts`**

```ts
import { db } from '@/lib/db';
import { handle, ok, requireUserId } from '@/lib/api-helpers';
import { assertPagePermission } from '@/lib/permissions';
import { acquireLock } from '@/lib/lock';

export const POST = handle(async (_req, { params }: { params: { id: string } }) => {
  const userId = await requireUserId();
  await assertPagePermission(db, params.id, userId, 'canEdit');
  const r = await acquireLock(db, params.id, userId);
  return ok(r, r.granted ? 200 : 409);
});
```

- [ ] **Step 2: Heartbeat `src/app/api/pages/[id]/lock/heartbeat/route.ts`**

```ts
import { db } from '@/lib/db';
import { handle, ok, requireUserId } from '@/lib/api-helpers';
import { assertPagePermission } from '@/lib/permissions';
import { heartbeat } from '@/lib/lock';

export const POST = handle(async (_req, { params }: { params: { id: string } }) => {
  const userId = await requireUserId();
  await assertPagePermission(db, params.id, userId, 'canEdit');
  const r = await heartbeat(db, params.id, userId);
  return ok(r, r.granted ? 200 : 409);
});
```

- [ ] **Step 3: Release `src/app/api/pages/[id]/lock/release/route.ts`**

```ts
import { db } from '@/lib/db';
import { handle, ok, requireUserId } from '@/lib/api-helpers';
import { releaseLock } from '@/lib/lock';

export const POST = handle(async (_req, { params }: { params: { id: string } }) => {
  const userId = await requireUserId();
  await releaseLock(db, params.id, userId);
  return ok({ ok: true });
});
```

- [ ] **Step 4: Update `save` endpoint to require lock**

In `src/app/api/pages/[id]/save/route.ts`, after the `assertPagePermission(...,'canEdit')` line:

```ts
const page = await db.page.findUnique({ where: { id: params.id },
  select: { editingUserId: true, editingExpiresAt: true } });
if (page?.editingUserId !== userId ||
    !page.editingExpiresAt || page.editingExpiresAt.getTime() < Date.now()) {
  return new Response(JSON.stringify({ error: 'You do not hold the edit lock' }), { status: 409 });
}
```

- [ ] **Step 5: Commit**

```bash
git add src/app/api/pages/
git commit -m "feat(lock): acquire/heartbeat/release endpoints; save requires lock"
```

### Task 9.3: Lock UI — banner + heartbeat + release on unload

**Files:** `src/components/editor/LockBanner.tsx`, `src/hooks/useLockHeartbeat.ts`, modify editor page + canvas.

- [ ] **Step 1: `src/hooks/useLockHeartbeat.ts`**

```ts
'use client';
import { useEffect, useState } from 'react';

export type LockState = { granted: boolean; holderUserId: string | null; expiresAt: string | null };

export function useLockHeartbeat(pageId: string, enabled: boolean) {
  const [state, setState] = useState<LockState | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let alive = true;

    async function acquire() {
      const r = await fetch(`/api/pages/${pageId}/lock/acquire`, { method: 'POST' });
      const j = await r.json();
      if (alive) setState(j);
      return j as LockState;
    }
    async function beat() {
      const r = await fetch(`/api/pages/${pageId}/lock/heartbeat`, { method: 'POST' });
      const j = await r.json();
      if (alive) setState(j);
    }

    acquire();
    const iv = setInterval(beat, 60_000);

    const onUnload = () => {
      navigator.sendBeacon?.(`/api/pages/${pageId}/lock/release`, new Blob());
    };
    window.addEventListener('beforeunload', onUnload);

    return () => {
      alive = false;
      clearInterval(iv);
      window.removeEventListener('beforeunload', onUnload);
      onUnload();
    };
  }, [pageId, enabled]);

  return state;
}
```

- [ ] **Step 2: `src/components/editor/LockBanner.tsx`**

```tsx
'use client';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';

export function LockBanner({ pageId, holderName, expiresAt, onTakeover }: {
  pageId: string;
  holderName: string;
  expiresAt: string;
  onTakeover: () => void;
}) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const i = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(i); }, []);
  const remaining = Math.max(0, new Date(expiresAt).getTime() - now);
  const m = Math.floor(remaining / 60000);
  const s = Math.floor((remaining % 60000) / 1000).toString().padStart(2, '0');
  const expired = remaining <= 0;

  return (
    <div className="bg-yellow-100 px-4 py-2 text-sm flex justify-between items-center">
      <span>
        {expired
          ? `Lock expired (was held by ${holderName})`
          : `${holderName} is currently editing — read-only. Take over in ${m}:${s}.`}
      </span>
      {expired && <Button size="sm" onClick={onTakeover}>Take over</Button>}
    </div>
  );
}
```

- [ ] **Step 3: Refactor editor page to delegate to a client wrapper**

Replace `src/app/(app)/pages/[pageId]/page.tsx` so the server page only does auth/permission/loading and delegates rendering to `<EditorClient>` (which renders its own chrome, lock banner, canvas, comments). Remove the direct `<EditorChrome>` and `<ExcalidrawCanvas>` references — `EditorClient` owns them now.

```tsx
import { db } from '@/lib/db';
import { auth } from '@/lib/auth';
import { redirect, notFound } from 'next/navigation';
import { resolvePagePermission } from '@/lib/permissions';
import { EditorClient } from '@/components/editor/EditorClient';

export default async function EditorPage({
  params, searchParams,
}: { params: { pageId: string }, searchParams: { preview?: string } }) {
  const session = await auth();
  const userId = (session?.user as { id?: string })?.id;
  if (!userId) redirect('/login');

  const perm = await resolvePagePermission(db, params.pageId, userId);
  if (!perm.canView) notFound();

  const page = await db.page.findUnique({ where: { id: params.pageId } });
  if (!page) notFound();

  let scene = page.currentSceneJson as any;
  let previewing = false;
  if (searchParams.preview) {
    const snap = await db.drawingSnapshot.findUnique({ where: { id: searchParams.preview } });
    if (snap?.pageId === page.id) { scene = snap.sceneJson as any; previewing = true; }
  }

  return (
    <div className="-m-6 -mt-0">
      <EditorClient
        pageId={page.id}
        title={page.title}
        canManage={perm.canManage}
        canEdit={perm.canEdit}
        canComment={perm.canComment}
        currentUserId={userId}
        initialScene={scene}
        previewing={previewing}
      />
    </div>
  );
}
```

- [ ] **Step 4: Create `src/components/editor/EditorClient.tsx`**

```tsx
'use client';
import { useState, useEffect } from 'react';
import { EditorChrome } from './EditorChrome';
import { ExcalidrawCanvas } from './ExcalidrawCanvas';
import { LockBanner } from './LockBanner';
import { useLockHeartbeat } from '@/hooks/useLockHeartbeat';

export function EditorClient({ pageId, title, canManage, canEdit, canComment, currentUserId, initialScene, previewing }: {
  pageId: string; title: string;
  canManage: boolean; canEdit: boolean; canComment: boolean;
  currentUserId: string;
  initialScene: any; previewing: boolean;
}) {
  const lock = useLockHeartbeat(pageId, canEdit && !previewing);
  const [holderName, setHolderName] = useState('Someone');

  const someoneElseHoldsLock = lock?.granted === false && lock.holderUserId !== null;

  useEffect(() => {
    if (someoneElseHoldsLock && lock?.holderUserId) {
      fetch(`/api/users/${lock.holderUserId}`).then(r => r.json()).then(u => setHolderName(u.name ?? 'Someone'));
    }
  }, [lock?.holderUserId, someoneElseHoldsLock]);

  async function takeover() {
    await fetch(`/api/pages/${pageId}/lock/acquire`, { method: 'POST' });
    window.location.reload();
  }

  const readOnly = previewing || !canEdit || someoneElseHoldsLock;

  return (
    <>
      <EditorChrome pageId={pageId} title={title} canManage={canManage} canEdit={canEdit} />
      {someoneElseHoldsLock && lock?.expiresAt && (
        <LockBanner pageId={pageId} holderName={holderName} expiresAt={lock.expiresAt} onTakeover={takeover} />
      )}
      <ExcalidrawCanvas pageId={pageId} initialScene={initialScene} readOnly={readOnly} />
    </>
  );
}
```

- [ ] **Step 5: Add tiny `/api/users/[id]/route.ts`** (used by LockBanner to resolve name)

```ts
import { db } from '@/lib/db';
import { handle, ok, requireUserId } from '@/lib/api-helpers';

export const GET = handle(async (_req, { params }: { params: { id: string } }) => {
  await requireUserId();
  const u = await db.user.findUnique({ where: { id: params.id }, select: { name: true, image: true } });
  return ok(u ?? { name: null, image: null });
});
```

- [ ] **Step 6: Manual two-browser test**

Open page in browser A (logged in as user A). In browser B (logged in as user B who is an AUTHOR collab on the page), open the same page → should see "User A is currently editing" banner. Close browser A → wait < 60s for next heartbeat to fail expiry → in B, banner shows "Take over". Click → become editor.

- [ ] **Step 7: Commit**

```bash
git add src/components/editor/ src/hooks/useLockHeartbeat.ts src/app/api/users/ src/app/(app)/pages/
git commit -m "feat(lock): heartbeat hook + banner + take-over flow"
```

---

## Phase 10 — Comments + rate limit

Goal: Comments panel on editor and public viewer. Logged-in users post; 10/user/24h cap globally.

### Task 10.1: Rate limit helper — TDD

**Files:** `src/lib/rate-limit.ts`, `tests/unit/rate-limit.test.ts`.

- [ ] **Step 1: Test**

```ts
import { describe, it, expect } from 'vitest';
import { commentRateLimit, COMMENT_LIMIT, COMMENT_WINDOW_MS } from '@/lib/rate-limit';
import { getPrisma } from '../helpers/db';
import { makeUser, makePage } from '../helpers/factories';

describe('commentRateLimit', () => {
  it('returns ok when under the cap', async () => {
    const u = await makeUser();
    const r = await commentRateLimit(getPrisma(), u.id);
    expect(r.allowed).toBe(true);
    expect(r.remaining).toBe(COMMENT_LIMIT);
  });

  it('blocks at the cap', async () => {
    const u = await makeUser();
    const p = await makePage(u.id);
    for (let i = 0; i < COMMENT_LIMIT; i++) {
      await getPrisma().comment.create({ data: { pageId: p.id, userId: u.id, body: 'x' } });
    }
    const r = await commentRateLimit(getPrisma(), u.id);
    expect(r.allowed).toBe(false);
    expect(r.remaining).toBe(0);
  });

  it('does not count comments older than the window', async () => {
    const u = await makeUser();
    const p = await makePage(u.id);
    const old = new Date(Date.now() - COMMENT_WINDOW_MS - 1000);
    for (let i = 0; i < COMMENT_LIMIT; i++) {
      await getPrisma().comment.create({ data: { pageId: p.id, userId: u.id, body: 'x', createdAt: old } });
    }
    const r = await commentRateLimit(getPrisma(), u.id);
    expect(r.allowed).toBe(true);
  });

  it('counts across all pages', async () => {
    const u = await makeUser();
    const p1 = await makePage(u.id);
    const p2 = await makePage(u.id);
    for (let i = 0; i < COMMENT_LIMIT - 1; i++) {
      await getPrisma().comment.create({ data: { pageId: p1.id, userId: u.id, body: 'a' } });
    }
    await getPrisma().comment.create({ data: { pageId: p2.id, userId: u.id, body: 'b' } });
    const r = await commentRateLimit(getPrisma(), u.id);
    expect(r.allowed).toBe(false);
  });
});
```

- [ ] **Step 2: Implement**

```ts
import type { PrismaClient } from '@prisma/client';

export const COMMENT_LIMIT = 10;
export const COMMENT_WINDOW_MS = 24 * 60 * 60 * 1000;

export async function commentRateLimit(db: PrismaClient, userId: string): Promise<{ allowed: boolean; remaining: number }> {
  const since = new Date(Date.now() - COMMENT_WINDOW_MS);
  const count = await db.comment.count({
    where: { userId, createdAt: { gte: since } },
  });
  const remaining = Math.max(0, COMMENT_LIMIT - count);
  return { allowed: count < COMMENT_LIMIT, remaining };
}
```

- [ ] **Step 3: Run + commit**

```bash
npm test -- rate-limit
git add src/lib/rate-limit.ts tests/unit/rate-limit.test.ts
git commit -m "feat(rate-limit): 10 comments/user/24h (TDD)"
```

### Task 10.2: Comments endpoints

**Files:** `src/app/api/pages/[id]/comments/route.ts`, `src/app/api/comments/[id]/route.ts`, `tests/integration/comments.test.ts`.

- [ ] **Step 1: Test**

```ts
import { describe, it, expect, vi } from 'vitest';
import { getPrisma } from '../helpers/db';
import { makeUser, makePage } from '../helpers/factories';

vi.mock('@/lib/auth', () => ({ auth: vi.fn(), signIn: vi.fn(), signOut: vi.fn(), handlers: {} }));
vi.mock('@/lib/db', () => ({ db: (globalThis as any).__prisma }));
import { auth } from '@/lib/auth';
import { POST as POST_C, GET as GET_C } from '@/app/api/pages/[id]/comments/route';
import { DELETE as DEL_C } from '@/app/api/comments/[id]/route';

const u = (id: string | null) => (auth as any).mockResolvedValue(id ? { user: { id } } : null);
const j = (body?: object, m = 'POST') => new Request('http://x', { method: m,
  headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });

describe('comments api', () => {
  it('owner can post on own page', async () => {
    const me = await makeUser();
    const p = await makePage(me.id);
    u(me.id);
    const res = await POST_C(j({ body: 'hi' }), { params: { id: p.id } });
    expect(res.status).toBe(200);
  });

  it('public-link visitor (logged in) can comment', async () => {
    const owner = await makeUser();
    const visitor = await makeUser();
    const p = await makePage(owner.id);
    await getPrisma().page.update({ where: { id: p.id }, data: { isPublic: true, publicSlug: 'abcd1234' } });
    u(visitor.id);
    const res = await POST_C(j({ body: 'public hi' }), { params: { id: p.id } });
    expect(res.status).toBe(200);
  });

  it('returns 429 when over rate limit', async () => {
    const me = await makeUser();
    const p = await makePage(me.id);
    for (let i = 0; i < 10; i++) {
      await getPrisma().comment.create({ data: { pageId: p.id, userId: me.id, body: `${i}` } });
    }
    u(me.id);
    const res = await POST_C(j({ body: 'overflow' }), { params: { id: p.id } });
    expect(res.status).toBe(429);
  });

  it('comment author can delete own comment', async () => {
    const me = await makeUser();
    const p = await makePage(me.id);
    const c = await getPrisma().comment.create({ data: { pageId: p.id, userId: me.id, body: 'x' } });
    u(me.id);
    const res = await DEL_C(j(undefined, 'DELETE'), { params: { id: c.id } });
    expect(res.status).toBe(200);
    const after = await getPrisma().comment.findUnique({ where: { id: c.id } });
    expect(after?.deletedAt).toBeTruthy();
  });

  it('GET lists non-deleted comments', async () => {
    const me = await makeUser();
    const p = await makePage(me.id);
    const c1 = await getPrisma().comment.create({ data: { pageId: p.id, userId: me.id, body: 'one' } });
    const c2 = await getPrisma().comment.create({ data: { pageId: p.id, userId: me.id, body: 'two' } });
    await getPrisma().comment.update({ where: { id: c1.id }, data: { deletedAt: new Date() } });
    u(me.id);
    const res = await GET_C(j(undefined, 'GET'), { params: { id: p.id } });
    const json = await res.json();
    expect(json.map((c: any) => c.body)).toEqual(['two']);
  });
});
```

- [ ] **Step 2: Implement `src/app/api/pages/[id]/comments/route.ts`**

```ts
import { z } from 'zod';
import { db } from '@/lib/db';
import { handle, ok, fail, parseBody, requireUserId } from '@/lib/api-helpers';
import { assertPagePermission } from '@/lib/permissions';
import { commentRateLimit } from '@/lib/rate-limit';
import { enqueueCommentNotification } from '@/lib/notifications';

const Post = z.object({ body: z.string().min(1).max(2000) });

export const POST = handle(async (req, { params }: { params: { id: string } }) => {
  const userId = await requireUserId();
  await assertPagePermission(db, params.id, userId, 'canComment');
  const limit = await commentRateLimit(db, userId);
  if (!limit.allowed) return fail(429, 'Comment rate limit exceeded (10 / 24h)');
  const { body } = await parseBody(req, Post);
  const c = await db.comment.create({ data: { pageId: params.id, userId, body } });
  await enqueueCommentNotification(db, params.id, userId, c.id);
  return ok(c);
});

export const GET = handle(async (_req, { params }: { params: { id: string } }) => {
  const userId = await requireUserId();
  await assertPagePermission(db, params.id, userId, 'canView');
  const comments = await db.comment.findMany({
    where: { pageId: params.id, deletedAt: null },
    orderBy: { createdAt: 'asc' },
  });
  const withUser = await Promise.all(comments.map(async c => {
    const user = await db.user.findUnique({ where: { id: c.userId },
      select: { name: true, image: true } });
    return { ...c, user };
  }));
  return ok(withUser);
});
```

- [ ] **Step 3: Implement `src/app/api/comments/[id]/route.ts`**

```ts
import { db } from '@/lib/db';
import { handle, ok, requireUserId, ResponseError } from '@/lib/api-helpers';

export const DELETE = handle(async (_req, { params }: { params: { id: string } }) => {
  const userId = await requireUserId();
  const c = await db.comment.findUnique({ where: { id: params.id } });
  if (!c) throw new ResponseError(404, 'Comment not found');
  const page = await db.page.findUnique({ where: { id: c.pageId }, select: { ownerId: true } });
  if (c.userId !== userId && page?.ownerId !== userId) throw new ResponseError(403, 'Forbidden');
  await db.comment.update({ where: { id: c.id }, data: { deletedAt: new Date() } });
  return ok({ ok: true });
});
```

- [ ] **Step 4: Stub `src/lib/notifications.ts`** (full impl in Phase 11)

```ts
import type { PrismaClient } from '@prisma/client';

export async function enqueueCommentNotification(db: PrismaClient, pageId: string,
    actorUserId: string, commentId: string) {
  const page = await db.page.findUnique({ where: { id: pageId }, select: { ownerId: true } });
  if (!page || page.ownerId === actorUserId) return;
  await db.notification.create({
    data: { recipientUserId: page.ownerId, type: 'COMMENT', actorUserId, pageId, commentId },
  });
}

export async function enqueueInviteNotification(db: PrismaClient, recipientUserId: string,
    actorUserId: string, pageId: string) {
  if (recipientUserId === actorUserId) return;
  await db.notification.create({
    data: { recipientUserId, type: 'INVITED', actorUserId, pageId },
  });
}
```

- [ ] **Step 5: Wire invite notification in collaborators POST**

In `src/app/api/pages/[id]/share/collaborators/route.ts`, replace the `// Phase 11 will dispatch notification here.` line with:

```ts
if (existing) await enqueueInviteNotification(db, existing.id, userId, params.id);
```

And import: `import { enqueueInviteNotification } from '@/lib/notifications';`

- [ ] **Step 6: Run + commit**

```bash
npm test -- comments
git add src/app/api/ src/lib/notifications.ts
git commit -m "feat(comments): post/list/delete with rate limit + notification enqueue"
```

### Task 10.3: Comments panel UI

**Files:** `src/components/editor/CommentsPanel.tsx`. Mount in EditorClient and PublicViewer.

- [ ] **Step 1: Implement**

```tsx
'use client';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';

type Comment = {
  id: string; body: string; createdAt: string;
  user: { name: string | null; image: string | null } | null;
  userId: string;
};

export function CommentsPanel({ pageId, canComment, currentUserId, isOwner }: {
  pageId: string; canComment: boolean; currentUserId: string | null; isOwner: boolean;
}) {
  const [list, setList] = useState<Comment[]>([]);
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    const r = await fetch(`/api/pages/${pageId}/comments`);
    if (r.ok) setList(await r.json());
  }
  useEffect(() => { refresh(); }, [pageId]);

  async function post() {
    if (!body.trim()) return;
    const r = await fetch(`/api/pages/${pageId}/comments`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ body }),
    });
    if (r.status === 429) { setError('You hit your daily comment limit (10/24h).'); return; }
    if (!r.ok) { setError('Failed to post.'); return; }
    setBody(''); setError(null); refresh();
  }

  async function remove(id: string) {
    await fetch(`/api/comments/${id}`, { method: 'DELETE' });
    refresh();
  }

  return (
    <div className="border-l w-80 p-4 flex flex-col h-full">
      <h3 className="font-semibold mb-3">Comments</h3>
      <ul className="flex-1 overflow-auto space-y-3">
        {list.map(c => (
          <li key={c.id} className="text-sm">
            <div className="flex justify-between">
              <span className="font-medium">{c.user?.name ?? 'User'}</span>
              <span className="text-xs text-muted-foreground">{new Date(c.createdAt).toLocaleString()}</span>
            </div>
            <p>{c.body}</p>
            {(c.userId === currentUserId || isOwner) && (
              <button onClick={() => remove(c.id)} className="text-xs text-red-600">Delete</button>
            )}
          </li>
        ))}
        {list.length === 0 && <li className="text-sm text-muted-foreground">No comments yet.</li>}
      </ul>
      {canComment && (
        <div className="mt-3 space-y-2">
          <textarea value={body} onChange={e => setBody(e.target.value)}
            className="w-full border rounded p-2 text-sm" rows={3} placeholder="Add a comment…" />
          <Button size="sm" onClick={post}>Post</Button>
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Mount in `EditorClient`**

Wrap the canvas area in a flex row with the panel:

```tsx
<div className="flex h-[calc(100vh-3.5rem-2rem)]">
  <div className="flex-1">
    <ExcalidrawCanvas .../>
  </div>
  <CommentsPanel pageId={pageId} canComment={!previewing /* require login server-side */}
    currentUserId={currentUserId} isOwner={canManage} />
</div>
```

(EditorClient now needs a `currentUserId` prop — pass from server page using session.)

- [ ] **Step 3: Mount in PublicViewer (`src/app/p/[publicSlug]/page.tsx`)**

Add comments panel to the side. For login state, use `auth()` server-side.

- [ ] **Step 4: Manual test**

Post a comment as owner. Sign out, visit public link, try to comment → see disabled state. Sign in as different user, comment 11 times → 11th gets rate-limited.

- [ ] **Step 5: Commit**

```bash
git add src/components/editor/CommentsPanel.tsx src/app/(app)/pages/ src/app/p/ src/components/editor/EditorClient.tsx
git commit -m "feat(comments): panel mounted in editor + public viewer"
```

---

## Phase 11 — Notifications

Goal: Bell icon polls unread count. Drawer lists last 30 with avatars + links. Mark-read on open.

### Task 11.1: Notifications endpoints

**Files:** `src/app/api/notifications/route.ts`, `src/app/api/notifications/read/route.ts`, `tests/integration/notifications.test.ts`.

- [ ] **Step 1: Test**

```ts
import { describe, it, expect, vi } from 'vitest';
import { getPrisma } from '../helpers/db';
import { makeUser, makePage } from '../helpers/factories';
import { enqueueCommentNotification, enqueueInviteNotification } from '@/lib/notifications';

vi.mock('@/lib/auth', () => ({ auth: vi.fn(), signIn: vi.fn(), signOut: vi.fn(), handlers: {} }));
vi.mock('@/lib/db', () => ({ db: (globalThis as any).__prisma }));
import { auth } from '@/lib/auth';
import { GET } from '@/app/api/notifications/route';
import { POST as MARK_READ } from '@/app/api/notifications/read/route';

const u = (id: string | null) => (auth as any).mockResolvedValue(id ? { user: { id } } : null);

describe('notifications api', () => {
  it('GET returns own notifications, newest first', async () => {
    const owner = await makeUser();
    const actor = await makeUser();
    const p = await makePage(owner.id);
    const c = await getPrisma().comment.create({ data: { pageId: p.id, userId: actor.id, body: 'x' } });
    await enqueueCommentNotification(getPrisma(), p.id, actor.id, c.id);
    u(owner.id);
    const res = await GET(new Request('http://x'));
    const json = await res.json();
    expect(json).toHaveLength(1);
    expect(json[0].type).toBe('COMMENT');
  });

  it('GET ?unread=1 returns count', async () => {
    const owner = await makeUser();
    const actor = await makeUser();
    const p = await makePage(owner.id);
    const c = await getPrisma().comment.create({ data: { pageId: p.id, userId: actor.id, body: 'x' } });
    await enqueueCommentNotification(getPrisma(), p.id, actor.id, c.id);
    u(owner.id);
    const res = await GET(new Request('http://x/?unread=1'));
    const json = await res.json();
    expect(json.unread).toBe(1);
  });

  it('comment by self does not notify self', async () => {
    const me = await makeUser();
    const p = await makePage(me.id);
    const c = await getPrisma().comment.create({ data: { pageId: p.id, userId: me.id, body: 'x' } });
    await enqueueCommentNotification(getPrisma(), p.id, me.id, c.id);
    expect(await getPrisma().notification.count()).toBe(0);
  });

  it('mark-read updates readAt', async () => {
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
```

- [ ] **Step 2: Implement `src/app/api/notifications/route.ts`**

```ts
import { db } from '@/lib/db';
import { handle, ok, requireUserId } from '@/lib/api-helpers';

export const GET = handle(async (req) => {
  const userId = await requireUserId();
  const url = new URL(req.url);
  if (url.searchParams.get('unread') === '1') {
    const count = await db.notification.count({ where: { recipientUserId: userId, readAt: null } });
    return ok({ unread: count });
  }
  const items = await db.notification.findMany({
    where: { recipientUserId: userId },
    orderBy: { createdAt: 'desc' },
    take: 30,
  });
  const enriched = await Promise.all(items.map(async n => {
    const actor = await db.user.findUnique({ where: { id: n.actorUserId },
      select: { name: true, image: true } });
    const page = n.pageId
      ? await db.page.findUnique({ where: { id: n.pageId }, select: { title: true } })
      : null;
    return { ...n, actor, page };
  }));
  return ok(enriched);
});
```

- [ ] **Step 3: Implement `src/app/api/notifications/read/route.ts`**

```ts
import { db } from '@/lib/db';
import { handle, ok, requireUserId } from '@/lib/api-helpers';

export const POST = handle(async () => {
  const userId = await requireUserId();
  await db.notification.updateMany({
    where: { recipientUserId: userId, readAt: null },
    data: { readAt: new Date() },
  });
  return ok({ ok: true });
});
```

- [ ] **Step 4: Run + commit**

```bash
npm test -- notifications
git add src/app/api/notifications/ tests/integration/notifications.test.ts
git commit -m "feat(notifications): list/unread/mark-read endpoints"
```

### Task 11.2: Bell menu UI

**Files:** `src/components/navigation/BellMenu.tsx`, `src/hooks/useNotifications.ts`. Mount in TopNav.

- [ ] **Step 1: `src/hooks/useNotifications.ts`**

```ts
'use client';
import { usePolling } from './usePolling';

export function useUnreadCount() {
  return usePolling(async () => {
    const r = await fetch('/api/notifications?unread=1');
    return (await r.json()).unread as number;
  }, 30_000);
}
```

- [ ] **Step 2: `src/components/navigation/BellMenu.tsx`**

```tsx
'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { useUnreadCount } from '@/hooks/useNotifications';

type N = {
  id: string; type: 'COMMENT'|'INVITED'; createdAt: string; readAt: string | null;
  pageId: string | null;
  actor: { name: string | null; image: string | null } | null;
  page: { title: string } | null;
};

export function BellMenu() {
  const unread = useUnreadCount() ?? 0;
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<N[]>([]);

  async function load() {
    const r = await fetch('/api/notifications');
    setItems(await r.json());
    await fetch('/api/notifications/read', { method: 'POST' });
  }

  return (
    <Sheet open={open} onOpenChange={(v) => { setOpen(v); if (v) load(); }}>
      <SheetTrigger asChild>
        <button className="relative px-2">
          🔔
          {unread > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-600 text-white text-xs rounded-full px-1">
              {unread}
            </span>
          )}
        </button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader><SheetTitle>Notifications</SheetTitle></SheetHeader>
        <ul className="mt-4 space-y-2">
          {items.map(n => (
            <li key={n.id} className={`text-sm border rounded p-2 ${n.readAt ? 'opacity-70' : ''}`}>
              <div className="font-medium">{n.actor?.name ?? 'Someone'}</div>
              <div>
                {n.type === 'COMMENT' && <>commented on <Link className="underline" href={`/pages/${n.pageId}`}>{n.page?.title ?? 'a page'}</Link></>}
                {n.type === 'INVITED' && <>invited you to <Link className="underline" href={`/pages/${n.pageId}`}>{n.page?.title ?? 'a page'}</Link></>}
              </div>
              <div className="text-xs text-muted-foreground">{new Date(n.createdAt).toLocaleString()}</div>
            </li>
          ))}
          {items.length === 0 && <li className="text-sm text-muted-foreground">Nothing yet.</li>}
        </ul>
      </SheetContent>
    </Sheet>
  );
}
```

- [ ] **Step 3: Mount BellMenu in TopNav**

In `src/components/navigation/TopNav.tsx`, before the `<Link href="/shared">` add:

```tsx
<BellMenu />
```

And import `import { BellMenu } from './BellMenu';`. (TopNav is a server component but BellMenu is `use client` — works fine.)

- [ ] **Step 4: Manual test**

User A comments on User B's page → User B's bell shows "1" within 30s → click → drawer with the notification → counter clears.

- [ ] **Step 5: Commit**

```bash
git add src/components/navigation/ src/hooks/useNotifications.ts
git commit -m "feat(notifications): bell menu + polling"
```

---

## Phase 12 — Trash + cron purge

Goal: Soft-deleted folders/pages appear in `/trash`. Restore clears deletedAt. Daily Vercel Cron hard-deletes things older than 30 days.

### Task 12.1: Trash lib + restore endpoint — TDD

**Files:** `src/lib/trash.ts` (extend), `tests/unit/trash.test.ts`, `src/app/api/folders/[id]/restore/route.ts`, `src/app/api/pages/[id]/restore-trash/route.ts`.

- [ ] **Step 1: Test cascade soft-delete + purge**

```ts
import { describe, it, expect } from 'vitest';
import { cascadeSoftDeleteFolder, purgeExpiredTrash, TRASH_TTL_MS } from '@/lib/trash';
import { getPrisma } from '../helpers/db';
import { makeUser, makeFolder, makePage } from '../helpers/factories';

describe('trash', () => {
  it('cascade soft-deletes nested folders and their pages', async () => {
    const me = await makeUser();
    const root = await makeFolder(me.id);
    const child = await makeFolder(me.id, root.id);
    const p1 = await makePage(me.id, root.id);
    const p2 = await makePage(me.id, child.id);
    await cascadeSoftDeleteFolder(getPrisma(), root.id);
    const all = await getPrisma().folder.findMany({});
    expect(all.every(f => f.deletedAt !== null)).toBe(true);
    const pages = await getPrisma().page.findMany({});
    expect(pages.every(p => p.deletedAt !== null)).toBe(true);
  });

  it('purgeExpiredTrash hard-deletes only items older than TTL', async () => {
    const me = await makeUser();
    const old = await makePage(me.id);
    const fresh = await makePage(me.id);
    await getPrisma().page.update({ where: { id: old.id },
      data: { deletedAt: new Date(Date.now() - TRASH_TTL_MS - 1000) } });
    await getPrisma().page.update({ where: { id: fresh.id },
      data: { deletedAt: new Date() } });
    await purgeExpiredTrash(getPrisma());
    const after = await getPrisma().page.findMany({});
    expect(after.map(p => p.id)).toEqual([fresh.id]);
  });
});
```

- [ ] **Step 2: Extend `src/lib/trash.ts`**

```ts
import type { PrismaClient } from '@prisma/client';

export const TRASH_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export async function cascadeSoftDeleteFolder(db: PrismaClient, folderId: string) {
  const now = new Date();
  await db.folder.update({ where: { id: folderId }, data: { deletedAt: now } });
  const children = await db.folder.findMany({ where: { parentFolderId: folderId, deletedAt: null } });
  for (const c of children) await cascadeSoftDeleteFolder(db, c.id);
  await db.page.updateMany({ where: { folderId, deletedAt: null }, data: { deletedAt: now } });
}

export async function restoreFolder(db: PrismaClient, folderId: string) {
  await db.folder.update({ where: { id: folderId }, data: { deletedAt: null } });
}
export async function restorePage(db: PrismaClient, pageId: string) {
  await db.page.update({ where: { id: pageId }, data: { deletedAt: null } });
}

export async function purgeExpiredTrash(db: PrismaClient) {
  const cutoff = new Date(Date.now() - TRASH_TTL_MS);
  // hard delete pages first (cascade their children)
  const oldPages = await db.page.findMany({ where: { deletedAt: { lt: cutoff } }, select: { id: true } });
  const pageIds = oldPages.map(p => p.id);
  if (pageIds.length) {
    await db.drawingSnapshot.deleteMany({ where: { pageId: { in: pageIds } } });
    await db.collaborator.deleteMany({ where: { pageId: { in: pageIds } } });
    await db.comment.deleteMany({ where: { pageId: { in: pageIds } } });
    await db.notification.deleteMany({ where: { pageId: { in: pageIds } } });
    await db.page.deleteMany({ where: { id: { in: pageIds } } });
  }
  // then folders
  await db.folder.deleteMany({ where: { deletedAt: { lt: cutoff } } });
}
```

- [ ] **Step 3: Run + commit**

```bash
npm test -- trash
git add src/lib/trash.ts tests/unit/trash.test.ts
git commit -m "feat(trash): cascade delete + purge (TDD)"
```

### Task 12.2: Restore endpoints + Trash UI

**Files:** `src/app/api/folders/[id]/restore/route.ts`, `src/app/api/pages/[id]/restore-trash/route.ts`, `src/app/(app)/trash/page.tsx`.

- [ ] **Step 1: Folder restore endpoint**

```ts
import { db } from '@/lib/db';
import { handle, ok, requireUserId } from '@/lib/api-helpers';
import { assertFolderOwner } from '@/lib/folders';
import { restoreFolder } from '@/lib/trash';

export const POST = handle(async (_req, { params }: { params: { id: string } }) => {
  const userId = await requireUserId();
  await assertFolderOwner(db, params.id, userId);
  await restoreFolder(db, params.id);
  return ok({ ok: true });
});
```

- [ ] **Step 2: Page restore endpoint** at `src/app/api/pages/[id]/restore-trash/route.ts` (separate path from version-restore in Phase 6)

```ts
import { db } from '@/lib/db';
import { handle, ok, requireUserId, ResponseError } from '@/lib/api-helpers';
import { restorePage } from '@/lib/trash';

export const POST = handle(async (_req, { params }: { params: { id: string } }) => {
  const userId = await requireUserId();
  const p = await db.page.findUnique({ where: { id: params.id } });
  if (!p || p.ownerId !== userId) throw new ResponseError(403, 'Forbidden');
  await restorePage(db, params.id);
  return ok({ ok: true });
});
```

- [ ] **Step 3: Trash UI `src/app/(app)/trash/page.tsx`**

```tsx
import { db } from '@/lib/db';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { TrashRow } from '@/components/folders/TrashRow';

export default async function TrashView() {
  const session = await auth();
  const userId = (session?.user as { id?: string })?.id;
  if (!userId) redirect('/login');

  const [folders, pages] = await Promise.all([
    db.folder.findMany({ where: { ownerId: userId, deletedAt: { not: null } }, orderBy: { deletedAt: 'desc' } }),
    db.page.findMany({ where: { ownerId: userId, deletedAt: { not: null } }, orderBy: { deletedAt: 'desc' } }),
  ]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Trash</h1>
      <p className="text-sm text-muted-foreground">Items are permanently deleted after 30 days.</p>
      <ul className="divide-y border rounded">
        {folders.map(f => <TrashRow key={f.id} kind="folder" id={f.id} title={f.name} deletedAt={f.deletedAt!.toISOString()} />)}
        {pages.map(p =>   <TrashRow key={p.id} kind="page"   id={p.id} title={p.title} deletedAt={p.deletedAt!.toISOString()} />)}
        {folders.length === 0 && pages.length === 0 && (
          <li className="p-4 text-sm text-muted-foreground">Trash is empty.</li>
        )}
      </ul>
    </div>
  );
}
```

- [ ] **Step 4: `src/components/folders/TrashRow.tsx`**

```tsx
'use client';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';

export function TrashRow({ kind, id, title, deletedAt }: {
  kind: 'folder'|'page'; id: string; title: string; deletedAt: string;
}) {
  const router = useRouter();
  async function restore() {
    const url = kind === 'folder' ? `/api/folders/${id}/restore` : `/api/pages/${id}/restore-trash`;
    await fetch(url, { method: 'POST' });
    router.refresh();
  }
  return (
    <li className="flex justify-between items-center p-3">
      <div>
        <span className="mr-2">{kind === 'folder' ? '📁' : '🖼️'}</span>
        <span className="font-medium">{title}</span>
        <span className="ml-2 text-xs text-muted-foreground">deleted {new Date(deletedAt).toLocaleDateString()}</span>
      </div>
      <Button size="sm" variant="outline" onClick={restore}>Restore</Button>
    </li>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add src/app/api/folders/ src/app/api/pages/ src/app/(app)/trash/ src/components/folders/TrashRow.tsx
git commit -m "feat(trash): restore endpoints + /trash UI"
```

### Task 12.3: Cron purge endpoint + Vercel config

**Files:** `src/app/api/cron/purge-trash/route.ts`, `vercel.json`.

- [ ] **Step 1: Implement cron handler**

```ts
import { db } from '@/lib/db';
import { ok, fail } from '@/lib/api-helpers';
import { purgeExpiredTrash } from '@/lib/trash';

export async function GET(req: Request) {
  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) return fail(401, 'Unauthorized');
  await purgeExpiredTrash(db);
  return ok({ ok: true });
}
```

- [ ] **Step 2: Create `vercel.json`**

```json
{
  "crons": [
    { "path": "/api/cron/purge-trash", "schedule": "0 3 * * *" }
  ]
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/cron/ vercel.json
git commit -m "feat(trash): daily cron to purge expired trash"
```

---

## Phase 13 — Search

Goal: Top-bar search box → `/search?q=` shows folders + pages I can access (owned or collaborator).

### Task 13.1: Search query builder + endpoint

**Files:** `src/lib/search.ts`, `src/app/api/search/route.ts`, `tests/integration/search.test.ts`.

- [ ] **Step 1: Test**

```ts
import { describe, it, expect, vi } from 'vitest';
import { getPrisma } from '../helpers/db';
import { makeUser, makeFolder, makePage, makeCollab } from '../helpers/factories';

vi.mock('@/lib/auth', () => ({ auth: vi.fn(), signIn: vi.fn(), signOut: vi.fn(), handlers: {} }));
vi.mock('@/lib/db', () => ({ db: (globalThis as any).__prisma }));
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

  it('excludes deleted', async () => {
    const me = await makeUser();
    const p = await makePage(me.id, null, 'Gone');
    await getPrisma().page.update({ where: { id: p.id }, data: { deletedAt: new Date() } });
    u(me.id);
    const res = await GET(new Request('http://x?q=gone'));
    const json = await res.json();
    expect(json.pages).toHaveLength(0);
  });

  it('empty q returns empty', async () => {
    const me = await makeUser();
    u(me.id);
    const res = await GET(new Request('http://x?q='));
    const json = await res.json();
    expect(json.folders).toEqual([]);
    expect(json.pages).toEqual([]);
  });
});
```

- [ ] **Step 2: Implement `src/lib/search.ts`**

```ts
import type { PrismaClient } from '@prisma/client';

export async function searchAll(db: PrismaClient, userId: string, q: string) {
  if (!q.trim()) return { folders: [], pages: [] };
  const collabPageIds = (await db.collaborator.findMany({
    where: { userId }, select: { pageId: true },
  })).map(c => c.pageId);

  const [folders, pages] = await Promise.all([
    db.folder.findMany({
      where: { ownerId: userId, deletedAt: null, name: { contains: q, mode: 'insensitive' } },
      take: 10, orderBy: { name: 'asc' },
    }),
    db.page.findMany({
      where: {
        deletedAt: null,
        title: { contains: q, mode: 'insensitive' },
        OR: [{ ownerId: userId }, { id: { in: collabPageIds } }],
      },
      take: 20, orderBy: { updatedAt: 'desc' },
      select: { id: true, title: true, updatedAt: true, isPublic: true, thumbnailDataUrl: true },
    }),
  ]);
  return { folders, pages };
}
```

- [ ] **Step 3: `src/app/api/search/route.ts`**

```ts
import { db } from '@/lib/db';
import { handle, ok, requireUserId } from '@/lib/api-helpers';
import { searchAll } from '@/lib/search';

export const GET = handle(async (req) => {
  const userId = await requireUserId();
  const url = new URL(req.url);
  const q = url.searchParams.get('q') ?? '';
  const result = await searchAll(db, userId, q);
  return ok(result);
});
```

- [ ] **Step 4: Run + commit**

```bash
npm test -- search
git add src/lib/search.ts src/app/api/search/ tests/integration/search.test.ts
git commit -m "feat(search): title-only search across owned + shared"
```

### Task 13.2: Search box + results page

**Files:** `src/components/navigation/SearchBox.tsx`, `src/app/(app)/search/page.tsx`. Mount in TopNav.

- [ ] **Step 1: `src/components/navigation/SearchBox.tsx`**

```tsx
'use client';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useEffect } from 'react';

export function SearchBox() {
  const router = useRouter();
  const sp = useSearchParams();
  const [q, setQ] = useState(sp.get('q') ?? '');

  function submit(e: React.FormEvent) {
    e.preventDefault();
    router.push(`/search?q=${encodeURIComponent(q)}`);
  }
  useEffect(() => { setQ(sp.get('q') ?? ''); }, [sp]);

  return (
    <form onSubmit={submit} className="flex-1 max-w-md">
      <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search…"
        className="w-full border rounded px-2 py-1 text-sm" />
    </form>
  );
}
```

- [ ] **Step 2: Mount in TopNav**

In `src/components/navigation/TopNav.tsx`, between the brand link and the right-side group, add:

```tsx
<SearchBox />
```

And import `import { SearchBox } from './SearchBox';`.

- [ ] **Step 3: Results page `src/app/(app)/search/page.tsx`**

```tsx
import { db } from '@/lib/db';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { searchAll } from '@/lib/search';
import { FolderCard } from '@/components/folders/FolderCard';
import { PageCard } from '@/components/pages/PageCard';

export default async function Search({ searchParams }: { searchParams: { q?: string } }) {
  const session = await auth();
  const userId = (session?.user as { id?: string })?.id;
  if (!userId) redirect('/login');

  const q = searchParams.q ?? '';
  const { folders, pages } = await searchAll(db, userId, q);

  return (
    <div className="space-y-6">
      <h1 className="text-xl">Results for &quot;{q}&quot;</h1>
      {folders.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold mb-2">Folders</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
            {folders.map(f => <FolderCard key={f.id} id={f.id} name={f.name} />)}
          </div>
        </section>
      )}
      {pages.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold mb-2">Pages</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {pages.map(p => <PageCard key={p.id} id={p.id} title={p.title}
              thumbnailDataUrl={p.thumbnailDataUrl} isPublic={p.isPublic} />)}
          </div>
        </section>
      )}
      {folders.length === 0 && pages.length === 0 && (
        <p className="text-sm text-muted-foreground">No results.</p>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/navigation/SearchBox.tsx src/app/(app)/search/ src/components/navigation/TopNav.tsx
git commit -m "feat(search): search box in nav + results page"
```

---

## Phase 14 — Polish + deploy

Goal: `/shared` view, empty/loading states, README, deploy to Vercel.

### Task 14.1: `/shared` view

**Files:** `src/app/(app)/shared/page.tsx`.

- [ ] **Step 1: Implement**

```tsx
import { db } from '@/lib/db';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { PageCard } from '@/components/pages/PageCard';

export default async function SharedView() {
  const session = await auth();
  const userId = (session?.user as { id?: string })?.id;
  if (!userId) redirect('/login');

  const collabs = await db.collaborator.findMany({ where: { userId }, select: { pageId: true } });
  const pages = await db.page.findMany({
    where: { id: { in: collabs.map(c => c.pageId) }, deletedAt: null },
    orderBy: { updatedAt: 'desc' },
    select: { id: true, title: true, isPublic: true, thumbnailDataUrl: true },
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Shared with me</h1>
      {pages.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing yet.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {pages.map(p => <PageCard key={p.id} id={p.id} title={p.title}
            thumbnailDataUrl={p.thumbnailDataUrl} isPublic={p.isPublic} />)}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/(app)/shared/
git commit -m "feat: /shared view"
```

### Task 14.2: Loading + error boundaries

**Files:** Add `loading.tsx` and `error.tsx` next to each route group.

- [ ] **Step 1: `src/app/(app)/loading.tsx`**

```tsx
export default function Loading() {
  return <div className="p-8 text-sm text-muted-foreground">Loading…</div>;
}
```

- [ ] **Step 2: `src/app/(app)/error.tsx`**

```tsx
'use client';
export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="p-8 space-y-3">
      <h2 className="text-lg font-semibold">Something went wrong</h2>
      <p className="text-sm text-muted-foreground">{error.message}</p>
      <button onClick={reset} className="text-sm underline">Try again</button>
    </div>
  );
}
```

- [ ] **Step 3: `src/app/p/[publicSlug]/not-found.tsx`**

```tsx
export default function NotFound() {
  return <div className="p-8 text-center text-sm">This link is no longer available.</div>;
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/
git commit -m "polish: loading + error boundaries"
```

### Task 14.3: README + deployment notes

**Files:** `README.md`.

- [ ] **Step 1: Write README**

```md
# Mock Excalidraw

Self-hosted Excalidraw-style app: Google login, nested folders, public sharing, per-page collaborators (turn-based locking), comments with rate limiting, in-app notifications, version history, soft-delete with auto-purge.

## Stack

Next.js 14 · TypeScript · Auth.js v5 (Google) · Prisma + MongoDB · @excalidraw/excalidraw · Tailwind + shadcn/ui · Vitest + mongodb-memory-server · Vercel + Vercel Cron.

## Local setup

1. `cp .env.example .env.local` and fill in:
   - `DATABASE_URL` — MongoDB Atlas connection string
   - `AUTH_SECRET` — `openssl rand -base64 32`
   - `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` — from Google Cloud Console (OAuth 2.0 Client ID, type Web; redirect URI `http://localhost:3000/api/auth/callback/google`)
   - `NEXTAUTH_URL` — `http://localhost:3000`
   - `CRON_SECRET` — random string used by Vercel Cron
2. `npm install`
3. `npx prisma db push` (creates collections)
4. `npm run dev`

## Tests

`npm test` runs the Vitest suite against an in-memory MongoDB replica set.

## Deploy

Push to GitHub, import in Vercel:
- Add the same env vars in Project → Settings → Environment Variables.
- Update Google OAuth redirect URI to `https://<your-domain>/api/auth/callback/google`.
- `vercel.json` already declares the daily trash-purge cron (03:00 UTC).
- Set `NEXTAUTH_URL` to your Vercel URL.

## Architecture

See [docs/superpowers/specs/2026-05-13-mock-excalidraw-design.md](docs/superpowers/specs/2026-05-13-mock-excalidraw-design.md).
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: README"
```

### Task 14.4: Deploy to Vercel

- [ ] **Step 1: Push to GitHub**

```bash
git remote add origin <your-repo-url>
git branch -M main
git push -u origin main
```

- [ ] **Step 2: In Vercel UI**, import the repo. Add env vars from `.env.example` (with your real values). Update `NEXTAUTH_URL` to the deployed URL.

- [ ] **Step 3: Update Google Console**

Add `https://<vercel-domain>/api/auth/callback/google` as an authorized redirect URI.

- [ ] **Step 4: Smoke test**

Sign in on the deployed URL. Create a folder + page. Draw. Refresh. Share. Comment. Check bell.

- [ ] **Step 5: Tag release**

```bash
git tag v0.1.0
git push --tags
```

---

## Self-review checklist (run before kicking off implementation)

After writing the plan, audit:

- [ ] **Spec coverage** — every feature in the spec maps to a phase/task.
- [ ] **Placeholder scan** — search for `TBD`, `TODO`, `…`, `etc.`. None remain.
- [ ] **Type consistency** — function names match across phases (`saveSceneAndSnapshot`, `acquireLock`, `cascadeSoftDeleteFolder`, `enqueueCommentNotification`, `enqueueInviteNotification`, `searchAll`, `backLinkInvitesForUser`).
- [ ] **Defaults from spec applied** — snapshot retention 20, lock TTL 5m, heartbeat 60s, trash TTL 30d, comment limit 10/24h, slug length 8.

If a check fails, fix inline and move on.
