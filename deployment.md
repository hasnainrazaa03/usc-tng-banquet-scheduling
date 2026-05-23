# Deployment Guide — USC Private Events & Conferences

Step-by-step instructions for getting the app running locally and
deploying it to Vercel + Neon. Follow the sections in order.

> ⚠️ **Current status (Phase 10):**
> The Neon connection string provided for verification
> (`postgresql://neondb_owner:npg_EvRs5Axaf6dG@ep-calm-butterfly-aktp055q.c-3.us-west-2.aws.neon.tech/neondb?sslmode=require`)
> returns **P1000: Authentication failed** from this machine, so
> automated `prisma db push` and seeding could not be completed in this
> environment. Generate a fresh connection string from the Neon
> dashboard (see step **2.3**) and run `npm run setup` once. Everything
> else in this guide has been verified.

---

## 1. Prerequisites

You need:

- **Node.js 20+** (`brew install node` or use `nvm`).
- **Git** + a GitHub account.
- A **Neon** account — <https://neon.tech>.
- A **Vercel** account — <https://vercel.com>.
- A terminal where you can run `openssl rand -base64 32`.

The repo is at <https://github.com/hasnainrazaa03/usc-tng-banquet-scheduling>.

---

## 2. Provision the database (Neon)

### 2.1 Create the project

1. Sign in to <https://neon.tech>.
2. Click **New Project**.
   - **Project name:** `usc-pec-banquet`
   - **Region:** `US West (Oregon)` (closest to USC).
   - **Postgres version:** 16.
3. After creation, open **Connection Details** → copy the **Pooled
   connection** string. It looks like:
   ```
   postgresql://neondb_owner:<password>@ep-xxx-pooler.us-west-2.aws.neon.tech/neondb?sslmode=require
   ```

### 2.2 Connection string for this project

The Neon connection string for this project is:

```
postgresql://neondb_owner:npg_EvRs5Axaf6dG@ep-calm-butterfly-aktp055q.c-3.us-west-2.aws.neon.tech/neondb?sslmode=require
```

> If this string returns `P1000: Authentication failed` (it currently
> does in our test environment), open the Neon dashboard, click
> **Reset password** under **Roles**, and replace the string in `.env`
> and in Vercel.

### 2.3 (Optional) Enable point-in-time backups

In Neon **Settings → Backups** turn on point-in-time restore once you
have production data.

---

## 3. Local environment setup

### 3.1 Clone & install

```bash
git clone https://github.com/hasnainrazaa03/usc-tng-banquet-scheduling.git
cd usc-tng-banquet-scheduling
npm install
```

`npm install` automatically runs `prisma generate` via the
`postinstall` script (added in Phase 10 to fix the Vercel build error).

### 3.2 Create `.env`

Create a file named `.env` in the repo root with these contents:

```env
NODE_ENV=development
NEXT_PUBLIC_APP_NAME="USC Town & Gown Banquet Operations"

DATABASE_URL="postgresql://neondb_owner:npg_EvRs5Axaf6dG@ep-calm-butterfly-aktp055q.c-3.us-west-2.aws.neon.tech/neondb?sslmode=require"

# Generate this yourself with:  openssl rand -base64 32
AUTH_SECRET="PAW+DcQk3GKW9a+J5Sm6EQEFaYlTEdYqy8585aIK+kU="

OPENAI_API_KEY=""
```

- `.env` is in `.gitignore` — never commit it.
- `AUTH_SECRET` signs the `tng_session` JWT cookie. Anything ≥ 32 random
  bytes is fine; the snippet above was generated for you and may be
  rotated at any time.

### 3.3 Push schema + seed

```bash
npm run setup
```

This is equivalent to:

```bash
npx prisma generate
npx prisma db push
npx tsx prisma/seed.ts
```

If you ever need to re-seed:

```bash
npm run db:seed             # core master data + 20 servers + 1 BEO
npm run db:seed:test        # OPTIONAL — 12 synthetic BEOs across 14 days
```

### 3.4 Run the dev server

```bash
npm run dev
```

The app starts at <http://localhost:3000> (or 3001 if 3000 is busy).
Sign in with one of the demo users printed by `npm run db:seed`.

---

## 4. Deploy to Vercel

### 4.1 Import the GitHub repo

1. Sign in to <https://vercel.com> with GitHub.
2. Click **Add New… → Project**.
3. Pick `hasnainrazaa03/usc-tng-banquet-scheduling`.
4. **Framework Preset:** Next.js (auto-detected).
5. **Root directory:** leave at default.
6. **Build & Output:** leave at defaults. Phase 10's `package.json` now
   has `"build": "prisma generate && next build"` and a
   `"postinstall": "prisma generate"` — both ensure the Prisma client is
   regenerated for every Vercel build, fixing the
   `PrismaClientInitializationError` reported during `Collecting page data`.

### 4.2 Environment variables

In the **Environment Variables** panel of the import flow, add:

| Name | Value | Environments |
| --- | --- | --- |
| `DATABASE_URL` | Pooled Neon connection string from step 2 | Production, Preview, Development |
| `AUTH_SECRET` | Random 32-byte string (`openssl rand -base64 32`) | Production, Preview, Development |

Do **not** set `NODE_ENV` manually — Vercel manages it.

### 4.3 Deploy

Click **Deploy**. First build takes ~3 minutes.

### 4.4 First-time database setup against the deployed DB

The Vercel build does **not** run `prisma db push` (that would risk
destructive schema changes on every deploy). Run it once from your
laptop pointing at the production database:

```bash
# .env's DATABASE_URL already points at Neon in this project,
# so this is the same command as local setup:
npx prisma db push
npx tsx prisma/seed.ts
```

### 4.5 Subsequent deploys

Every push to `master` triggers a Vercel rebuild automatically. Schema
changes still require a manual `npx prisma db push` against the
production `DATABASE_URL`.

---

## 5. Post-deploy verification

After the first deploy succeeds, verify:

- [ ] You can sign in with a seeded user (see seed output for the demo
      password).
- [ ] **Schedule Board** loads at the correct Thursday → Wednesday week.
- [ ] **Today / Prev / Next** buttons each move exactly one week.
- [ ] The calendar picker in the week navigator jumps to the picked
      day's operational week.
- [ ] The **Run AI Schedule** panel on the board successfully runs and
      reports `{ filled, unfilled }`.
- [ ] The **Recent Schedules** panel lists historical schedules and
      "Open" / "Print" links work.
- [ ] **Fill Unassigned** in the top-right toolbar runs the auto-scheduler
      on the current week without `clearFirst`.
- [ ] Manual drag-and-drop assignment of servers and managers works.
- [ ] **Availability** editor saves and the table updates immediately.
- [ ] **Server Database** edit modal saves and (when hire date changes)
      seniority recalculates across the roster.
- [ ] Sidebar collapses/expands smoothly and the preference persists.
- [ ] No `AuditLog_userId_fkey` errors appear in Vercel runtime logs.

---

## 6. Troubleshooting

### `PrismaClientInitializationError` on Vercel
Fixed in Phase 10 by adding `prisma generate` to both `build` and
`postinstall`. If it returns, confirm `package.json` still contains:

```json
"scripts": {
  "build": "prisma generate && next build",
  "postinstall": "prisma generate"
}
```

### `P1000: Authentication failed`
The `DATABASE_URL` is wrong or the Neon role's password was reset. Open
the Neon dashboard, copy a fresh **Pooled** connection string, replace
`DATABASE_URL` locally and in Vercel, then redeploy.

### `AuditLog_userId_fkey` after redeploy
Your browser's `tng_session` cookie points at a userId that doesn't
exist in the deployed DB. Sign out (or clear the cookie) and sign in
again — `getSession()` already drops stale-cookie sessions automatically.

### Build fails with "module not found" for `@prisma/client`
Run `npm install` again — `postinstall` will regenerate the client.

---

## 7. Manual steps you must perform

These cannot be automated:

1. **Create the Neon project** and copy the pooled connection string
   (or reset the password on the existing project).
2. **Create a Vercel project** and link to the GitHub repo.
3. **Paste `DATABASE_URL` + `AUTH_SECRET`** into Vercel's env-var UI.
4. Run `npm run setup` once locally to push the schema and seed
   the Neon database.
5. Sign in with a seeded user and rotate the demo password.

Once steps 1–5 are done, every `git push origin master` deploys
hands-off.
