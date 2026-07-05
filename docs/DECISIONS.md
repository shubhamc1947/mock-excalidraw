# Design decisions

Notes on the non-obvious choices in this codebase and why I made them.

## Turn-based editing instead of real-time CRDT sync

Excalidraw ships collaborative sync (excalidraw-room), and CRDTs are the
fashionable answer, but both solve a problem this app doesn't have. Diagrams
here are edited by small groups where simultaneous editing is rare; what
actually matters is that two people never silently overwrite each other.

A turn-based lock gives that guarantee with a fraction of the moving parts:
no websocket infrastructure, no conflict resolution, no divergent-state bugs.
One editor holds the lock, everyone else sees a read-only banner with live
"who's editing" state. The trade-off — you wait for your turn — is acceptable
for diagramming and honest about it in the UI.

## Lock implementation: atomic conditional update, 5-minute TTL, 60s heartbeat

The lock is a single MongoDB `updateMany` with the acquire conditions in the
`where` clause (free, expired, or already mine), so acquire is atomic and
there's no check-then-set race (see `src/lib/lock.ts` and the TOCTOU fix in
the git history).

- **5-minute TTL** — long enough that a flaky connection doesn't lose the
  lock mid-drawing, short enough that an abandoned tab doesn't block
  collaborators for long.
- **60s heartbeat** — keeps an active session's lock alive with 4 renewal
  chances before expiry; cheap enough to not matter on the free tier.
- Expired locks are stolen only on explicit user action, never by the
  polling endpoint — polling that mutates state was a bug I fixed
  (`fix(lock): read-only poll endpoint`).

## MongoDB instead of Postgres

Drawing snapshots are large, deeply nested JSON blobs that are always read
and written whole — a document store fits them natively, with no JSONB
column pretending to be a document. Atlas free tier + Prisma keeps the
schema typed anyway. The relational parts (folders, collaborators,
notifications) are shallow enough that application-level integrity plus
compound indexes cover them.

## Soft-delete with 30-day purge

Trash is a `deletedAt` timestamp, not a row delete — restoring a folder tree
must be possible because accidental deletes of nested folders are the most
destructive user mistake in the app. A Vercel cron hard-deletes anything
older than 30 days so the collection doesn't grow forever. Restore is
recursive (descendant folders and pages come back with the parent).

## Version history: last 20 snapshots, restore-creates-snapshot

Snapshots are capped at 20 per page to bound storage. Restoring an old
version pushes a *new* snapshot rather than rewinding history — you can
always undo a restore, and history stays append-only.

## Rate limiting in Mongo, not Redis

Comment rate limiting (10/user/24h) is a `count` query on an indexed
collection. Redis would be faster and the conventional answer, but adding a
second datastore to rate-limit *comments on a diagram app* is complexity
with no payoff at this scale. If this needed per-request limits, I'd revisit.

## Tests: mongodb-memory-server over mocks

Integration tests (125 across 21 files) run against a real in-process
MongoDB instead of mocking Prisma. Slower per-test, but the lock atomicity,
cascading trash operations, and permission checks are exactly the things
mocks would lie about.
