# Mock Excalidraw — Design Spec

**Date:** 2026-05-13
**Status:** Draft v1, approved by user 2026-05-13

A self-hostable web app inspired by Excalidraw: users sign in with Google, organize drawings into nested folders, and share pages publicly or with named collaborators. Comments, in-app notifications, version history, soft-delete, and turn-based collaborative editing are in scope. Real-time multi-cursor editing and payments are out of scope for v1.

## Tech stack

- **Next.js 14** (App Router, TypeScript) — single deployable; server actions for mutations, route handlers for APIs.
- **Auth.js v5** (NextAuth successor) with Google provider only.
- **Prisma ORM** → **MongoDB Atlas**.
- **@excalidraw/excalidraw** as the canvas, loaded via dynamic import with `ssr: false` (it touches `window`).
- **Tailwind CSS + shadcn/ui** for UI primitives.
- **Zod** for input validation at API boundaries.
- **Vercel** for hosting, **Vercel Cron** for the daily trash purge job.
- No Redis — comment rate limiting is implemented as a MongoDB count query.

## Roles and permissions

There is no global role on a User. Permissions are computed per-resource from `Page.ownerId`, the matching `Collaborator` row, and `Page.isPublic`.

| Actor | View | Edit | Comment | Manage sharing | Delete |
|---|---|---|---|---|---|
| Owner (`Page.ownerId == me`) | yes | yes (must hold lock) | yes | yes | yes |
| Collaborator AUTHOR | yes | yes (must hold lock) | yes | no | no |
| Collaborator VIEWER | yes | no | yes | no | no |
| Public visitor (logged in) | yes if `isPublic` | no | yes (rate limited) | no | no |
| Public visitor (anonymous) | yes if `isPublic` | no | no (must log in) | no | no |

A single helper `assertPagePermission(pageId, userId, action)` runs at the top of every API handler and server action.

## Data model (Prisma + MongoDB)

```prisma
// Auth.js standard models — abridged
model User {
  id        String    @id @default(auto()) @map("_id") @db.ObjectId
  email     String    @unique
  name      String?
  image     String?
  createdAt DateTime  @default(now())
  // relations: ownedFolders, ownedPages, collaborators, comments, notifications
}
model Account { /* Auth.js standard */ }
model Session { /* Auth.js standard */ }

model Folder {
  id              String    @id @default(auto()) @map("_id") @db.ObjectId
  name            String
  ownerId         String    @db.ObjectId
  parentFolderId  String?   @db.ObjectId   // null = root
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  deletedAt       DateTime?                  // soft delete
  @@index([ownerId, parentFolderId])
  @@index([ownerId, deletedAt])
}

model Page {
  id                 String    @id @default(auto()) @map("_id") @db.ObjectId
  title              String
  ownerId            String    @db.ObjectId
  folderId           String?   @db.ObjectId   // null = root
  currentSceneJson   Json                       // latest Excalidraw scene
  thumbnailDataUrl   String?                    // small inline preview
  isPublic           Boolean   @default(false)
  publicSlug         String?   @unique          // 8-char nanoid when public
  editingUserId      String?   @db.ObjectId     // current lock holder
  editingExpiresAt   DateTime?                  // lock auto-expiry
  createdAt          DateTime  @default(now())
  updatedAt          DateTime  @updatedAt
  deletedAt          DateTime?
  @@index([ownerId, folderId, deletedAt])
  @@index([publicSlug])
  @@index([title])                              // for v1 regex title search
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
  id              String   @id @default(auto()) @map("_id") @db.ObjectId
  pageId          String   @db.ObjectId
  email           String                          // always set
  userId          String?  @db.ObjectId           // back-filled on first login
  role            CollabRole                      // AUTHOR | VIEWER
  invitedByUserId String   @db.ObjectId
  invitedAt       DateTime @default(now())
  @@unique([pageId, email])
  @@index([userId])
  @@index([email])
}
enum CollabRole { AUTHOR VIEWER }

model Comment {
  id        String    @id @default(auto()) @map("_id") @db.ObjectId
  pageId    String    @db.ObjectId
  userId    String    @db.ObjectId
  body      String
  createdAt DateTime  @default(now())
  deletedAt DateTime?
  @@index([pageId, createdAt])
  @@index([userId, createdAt])                 // for rate-limit count query
}

model Notification {
  id              String    @id @default(auto()) @map("_id") @db.ObjectId
  recipientUserId String    @db.ObjectId
  type            NotifType                    // COMMENT | INVITED
  actorUserId     String    @db.ObjectId
  pageId          String?   @db.ObjectId
  commentId       String?   @db.ObjectId
  readAt          DateTime?
  createdAt       DateTime  @default(now())
  @@index([recipientUserId, readAt, createdAt])
}
enum NotifType { COMMENT INVITED }
```

**Cascade rules.**

- Deleting a Folder soft-deletes all descendant Folders and Pages (recursive `deletedAt = now()` traversal).
- Deleting a Page hard-deletes its DrawingSnapshots, Collaborators, Comments, and Notifications referencing it (only on the daily Vercel Cron purge — soft-deleted pages keep their children intact in case of restore).
- A User cannot be deleted in v1.

## Routes

### Pages
- `/` — dashboard: your root folders + recent pages.
- `/folders/[folderId]` — folder contents (subfolders + pages).
- `/pages/[pageId]` — editor (auth required, permission checked).
- `/p/[publicSlug]` — public viewer (no auth required to view).
- `/shared` — pages shared with me.
- `/trash` — soft-deleted folders and pages, with restore.
- `/search?q=...` — title-only results across folders + pages I can access.
- `/login` — Google sign-in.

### API (route handlers)
- `/api/auth/[...nextauth]` — Auth.js endpoints.
- `/api/folders` `[POST/GET]`, `/api/folders/[id]` `[PATCH/DELETE]`.
- `/api/pages` `[POST/GET]`, `/api/pages/[id]` `[GET/PATCH/DELETE]`.
- `/api/pages/[id]/save` `[POST]` — debounced autosave; writes snapshot + `currentSceneJson`; requires lock.
- `/api/pages/[id]/snapshots` `[GET]`, `/api/pages/[id]/restore` `[POST]`.
- `/api/pages/[id]/share` `[GET/PATCH]` — toggle public, invalidate slug, manage collaborators.
- `/api/pages/[id]/lock/acquire` `[POST]`, `/lock/release` `[POST]`, `/lock/heartbeat` `[POST]`.
- `/api/pages/[id]/comments` `[GET/POST]`, `/api/comments/[id]` `[DELETE]`.
- `/api/notifications` `[GET]`, `/api/notifications/read` `[POST]`.
- `/api/search?q=`.
- `/api/cron/purge-trash` — Vercel Cron, daily; hard-deletes anything with `deletedAt < now - 30d`.
- `/api/p/[slug]` — public viewer data fetch (no auth, returns scene + comments).
- `/api/p/[slug]/comments` `[POST]` — public-link commenting (login required, rate limited).

## Key flows

### Editor autosave + versioning
Excalidraw's `onChange` is debounced ~2 seconds. On flush the editor POSTs to `/api/pages/:id/save`. The server:

1. Verifies the caller holds the lock (`page.editingUserId == me && page.editingExpiresAt > now`). Returns 409 if not.
2. Updates `currentSceneJson` and `updatedAt` on the page.
3. Inserts a new `DrawingSnapshot`.
4. Prunes snapshots beyond the 20 most recent for the page.

UI shows "Saved 2s ago" / "Saving…" / "Save failed — retrying" states.

### Turn-based collaboration lock
On opening the editor:

1. Client calls `/api/pages/:id/lock/acquire`.
   - Granted if no current lock or `editingExpiresAt < now`. Sets `editingUserId = me`, `editingExpiresAt = now + 5min`.
   - Denied (409) otherwise — response includes the holder's name and remaining time.
2. If granted, the client renders Excalidraw in edit mode and starts a 60s heartbeat (`/lock/heartbeat`) that bumps `editingExpiresAt`.
3. If denied, the client renders Excalidraw with `viewModeEnabled = true` and polls `/api/pages/:id` every 10s. A banner shows "Alice is editing — Take over (available in 4:32)" with a countdown.
4. On `beforeunload`, the editor fires `navigator.sendBeacon('/lock/release')`.
5. After expiry, any user with edit rights can take over by re-acquiring.

### Sharing
Share dialog has two sections.

*Public link.* A toggle. Turning on generates a random `publicSlug` (8-char nanoid) and shows the URL `/p/<slug>` with a copy button. Turning off sets `isPublic = false` and clears the slug, invalidating any in-the-wild URLs. Re-toggling on issues a brand-new slug.

*Invite people.* Email input + role dropdown (Author / Viewer). On submit:

1. Server creates a `Collaborator` row with the email and role.
2. If a User with that email already exists, the row's `userId` is set immediately and a `Notification(type=INVITED)` is enqueued for them.
3. Otherwise the row stays unlinked. On the invitee's first Google login, a post-signin hook scans `Collaborator.email = me && userId IS NULL` and back-fills `userId`, then inserts the deferred notifications.

The owner can revoke a collaborator from the same dialog (deletes the row).

### Comments + rate limit
POST `/api/pages/:id/comments` requires Google login (Q5). Before insert:

```ts
const count = await db.comment.count({
  where: { userId: me.id, createdAt: { gte: new Date(Date.now() - 24*60*60*1000) } }
});
if (count >= 10) return 429;
```

This is a *global* per-user 24h rolling limit, not per-page (Q6 = B). On success: insert the comment, then insert a `Notification(recipient = page.ownerId, type = COMMENT)` if `commenter !== owner`. Comment authors and the page owner can soft-delete a comment; everyone else cannot.

### Notifications
Bell icon in the top nav polls `/api/notifications?unread=1` every 30 seconds for the unread count. Click → drawer with the last 30 notifications, sorted newest first, with the actor's avatar and a clickable link to the relevant page. Opening the drawer marks the listed notifications as read (`readAt = now()`).

Triggers in v1:
- `COMMENT` — fires when someone other than the page owner posts a comment on a page the owner owns.
- `INVITED` — fires when a user is added as a Collaborator (or when an unregistered invite resolves on first login).

Lock-taken notifications are explicitly out of v1 (too noisy).

### Versioning UI
Editor toolbar has a "History" button → side drawer lists snapshots with timestamp + author avatar (newest first). Click a snapshot to preview it in read-only mode in the canvas. A "Restore this version" button writes the selected `sceneJson` as a *new* snapshot (so restore is itself versioned and reversible).

### Trash
Delete sets `deletedAt = now()` on the folder or page.

- Deleting a folder recursively soft-deletes its descendant folders and pages in a single transaction.
- The trash view (`/trash`) lists items where `deletedAt != null && ownerId == me`, with a Restore button (clears `deletedAt`) and a Delete-Forever button (hard-delete, also cascades to children/snapshots/comments/collaborators).
- A daily Vercel Cron at `/api/cron/purge-trash` hard-deletes anything where `deletedAt < now() - 30d`.

### Search
Top-bar input with debounce → `/search?q=` → server runs case-insensitive regex queries on `Folder.name` and `Page.title`, scoped to items where `ownerId == me` OR the user is a Collaborator. Results section: Folders (top 10) + Pages (top 20). v1 uses MongoDB `$regex` with `$options: 'i'`. Upgrade path: MongoDB Atlas Search index.

## Defaults locked without explicit user input

| Default | Value | Rationale |
|---|---|---|
| Notification triggers | COMMENT + INVITED only | Lock-taken would be noisy; user picked "in-app only" but did not specify triggers. |
| Email invite for non-registered users | Allowed; row back-linked on first login | Better UX than rejecting unknown emails. |
| Snapshot retention per page | 20 | Balances history utility against MongoDB document growth. |
| Lock TTL | 5 minutes | Long enough for a meaningful edit, short enough that abandoned tabs unblock fast. |
| Lock heartbeat interval | 60 seconds | 5× safety margin under TTL. |
| Trash retention | 30 days | Standard SaaS default. |
| Comment rate-limit window | Rolling 24h, global per user | Matches Q6 = B. |
| Public-link slug | 8-char nanoid | ~218 trillion possibilities — safe against enumeration. |
| Public-link toggle off | Invalidates slug | Owner gets a hard kill switch on the URL. |
| Search scope | Title only, case-insensitive regex | Q11 = B. v1 simple, indexable. |
| Mobile | Desktop-first, responsive nav, canvas not optimized for touch | Q12 = A. |

## Out of scope for v1

- Real-time multi-cursor / live presence (the Q1 "Excel-like" requirement was explicitly downgraded to turn-based locking).
- Email notifications.
- Full-text search inside drawings.
- Payments / billing / quotas.
- Mobile-optimized canvas interactions.
- Workspace / team / org constructs (v1 is per-user only).
- Per-page link permissions beyond the public toggle (no "anyone with link can edit").
- Custom domains / branding.

## Project structure (target)

```
mock-excalidraw/
  src/
    app/
      (auth)/login/page.tsx
      (app)/
        layout.tsx                  // top-nav, bell icon, search box
        page.tsx                    // dashboard
        folders/[folderId]/page.tsx
        pages/[pageId]/page.tsx     // editor
        shared/page.tsx
        trash/page.tsx
        search/page.tsx
      p/[publicSlug]/page.tsx       // public viewer (no auth shell)
      api/
        auth/[...nextauth]/route.ts
        folders/...
        pages/...
        comments/[id]/route.ts
        notifications/...
        search/route.ts
        cron/purge-trash/route.ts
        p/[slug]/...
    components/
      editor/                       // Excalidraw wrapper, history drawer, lock banner
      sharing/                      // share dialog, collaborators list
      comments/                     // comments panel
      navigation/                   // sidebar tree, breadcrumbs, bell
      ui/                           // shadcn primitives
    lib/
      auth.ts                       // Auth.js config
      db.ts                         // Prisma client singleton
      permissions.ts                // assertPagePermission()
      rate-limit.ts                 // comment rate limit helper
      lock.ts                       // acquire/release/heartbeat helpers
      notifications.ts              // enqueue helpers
      ids.ts                        // nanoid wrappers
    server/                         // server actions
  prisma/
    schema.prisma
  docs/superpowers/specs/           // this file
```

## Open items to confirm before plan

None. All Q1–Q12 answered, all defaults flagged above.
