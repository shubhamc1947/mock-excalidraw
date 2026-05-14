# Mock Excalidraw

A focused, opinionated app for drawing and sharing diagrams — Google sign-in, nested folders, public links, per-page collaborators with turn-based editing, comments with rate limiting, in-app notifications, version history, soft-delete with auto-purge.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4 · shadcn/ui (on `@base-ui/react`) · Auth.js v5 (Google, JWT) · Prisma 6 · MongoDB Atlas · `@excalidraw/excalidraw` · framer-motion · next-themes · Vitest + mongodb-memory-server.

## Local setup

1. Clone and install:

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env.local` and fill in:

   - `DATABASE_URL` — MongoDB Atlas connection string (cluster needs replica set; Atlas free tier works)
   - `AUTH_SECRET` — generate with `openssl rand -base64 32`
   - `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET` — from [Google Cloud Console](https://console.cloud.google.com/apis/credentials) → Create OAuth 2.0 Client ID, type **Web application**, add `http://localhost:3000/api/auth/callback/google` to authorized redirect URIs
   - `NEXTAUTH_URL` — `http://localhost:3000` for local; your production URL on Vercel
   - `CRON_SECRET` — random string used by the daily trash-purge cron (only matters in production)

3. Push schema to your database (Mongo doesn't use migrations):

   ```bash
   npx prisma db push
   ```

4. Run dev server:

   ```bash
   npm run dev
   ```

   Open `http://localhost:3000` and sign in with Google.

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Local dev with hot reload |
| `npm run build` | Production build |
| `npm start` | Run the production build |
| `npm test` | Run the Vitest suite (uses mongodb-memory-server, ~4 min) |
| `npm run test:watch` | Watch mode |
| `npx prisma db push` | Sync Prisma schema to MongoDB |
| `npx prisma studio` | Browse the database in a UI |

## Tests

The Vitest suite spins up a real MongoDB replica set in-process via `mongodb-memory-server` (first run downloads the mongod binary). Tests run sequentially (`fileParallelism: false`) to avoid resource contention.

```bash
npm test
```

117 tests across permissions, folders, pages, snapshots, sharing, collaborators, lock, comments, notifications, trash, search.

## Deployment (Vercel)

1. Push to GitHub.
2. Import the repo in Vercel.
3. Add the same environment variables in **Project → Settings → Environment Variables**.
4. Update Google OAuth redirect URI to `https://<your-domain>/api/auth/callback/google`.
5. `vercel.json` already declares the daily trash-purge cron at 03:00 UTC.

## Architecture

See [`docs/superpowers/specs/2026-05-13-mock-excalidraw-design.md`](docs/superpowers/specs/2026-05-13-mock-excalidraw-design.md) for the full spec.

Key decisions:

- **Permissions** are computed per-resource at request time from `Page.ownerId`, `Collaborator.role`, and `Page.isPublic`. No global user role.
- **Editing** is turn-based: a 5-minute lock with 60s heartbeat. The save endpoint refuses writes from non-holders. Other viewers see a banner and can take over after expiry.
- **Public links** rotate the slug on every toggle (on or off) — toggling off serves as a hard kill switch on the URL.
- **Comments** are globally rate-limited at 10/user/24h.
- **Trash** retains items for 30 days; a daily Vercel Cron at `/api/cron/purge-trash` hard-deletes expired ones (cascading snapshots, comments, collaborators, notifications).
- **Versioning** keeps the last 20 snapshots per page; restore writes a new snapshot.
- **Auth.js** is split: `src/auth.config.ts` is edge-safe (used by middleware); `src/lib/auth.ts` adds the Prisma adapter. Sessions are JWT to keep middleware on the edge runtime.

## License

MIT.
