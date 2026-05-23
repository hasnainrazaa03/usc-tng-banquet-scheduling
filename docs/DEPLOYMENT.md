# Deploying the USC Private Events & Conferences Platform

This guide walks through deploying the Next.js app and its PostgreSQL
database to managed services. Two recommended paths are documented:

- **Path A — Vercel (app) + Neon (database)** _Recommended_. Both have
  generous free tiers and zero infrastructure to run.
- **Path B — Render (app + database)**. A single dashboard if you'd rather
  manage the database alongside the app.

> **Operational week reminder:** the app uses a Thursday → Wednesday
> operational week (`src/lib/week-config.ts`). Nothing in deployment
> changes that — it's a code-level constant.

---

## 0. What you need before starting

You will need accounts on the services below. Sign up with your USC email
if available so billing and ownership stay institutional.

| Service | Purpose | Free tier |
| ------- | ------- | --------- |
| [github.com](https://github.com) | Source of truth for the code | Yes |
| [vercel.com](https://vercel.com) | Hosts the Next.js app (Path A) | Yes |
| [neon.tech](https://neon.tech) | Managed PostgreSQL (Path A) | Yes |
| [render.com](https://render.com) | Hosts app + Postgres (Path B alt.) | Yes |

The repo is already on GitHub at
`github.com/hasnainrazaa03/usc-tng-banquet-scheduling`.

---

## 1. Provision the database (Path A — Neon)

1. Sign in to <https://neon.tech>.
2. Click **New Project**.
   - **Project name:** `usc-pec-banquet`
   - **Region:** `US West (Oregon)` (closest to USC).
   - **Postgres version:** 16 (matches local dev).
3. After the project is created, open the **Connection Details** panel.
4. Copy the **Pooled connection** string. It looks like:
   ```
   postgres://USER:PASSWORD@ep-xxx-pooler.us-west-2.aws.neon.tech/neondb?sslmode=require
   ```
5. **Save this string.** You will paste it into `DATABASE_URL` in Vercel.
6. Optional but recommended: enable **Point-in-time restore** under
   **Settings → Backups** if you'll have real production data.

### Push the schema to the new database

From your local machine, with the connection string in hand:

```bash
# Replace with the connection string from Neon
export DATABASE_URL='postgres://...neon.tech/neondb?sslmode=require'

cd "/path/to/TNG Scheduling System"

# Apply schema (no migrations folder is required for this flow)
npx prisma db push

# Generate the typed client (also done automatically by `db push`)
npx prisma generate

# Seed the database with master data, managers, servers, sample BEO, etc.
npx prisma db seed
```

You can verify the schema and seed data via Neon's built-in SQL editor or
with `npx prisma studio`.

---

## 2. Deploy the app (Path A — Vercel)

1. Sign in to <https://vercel.com> with GitHub.
2. Click **Add New… → Project** and import
   `hasnainrazaa03/usc-tng-banquet-scheduling`.
3. **Framework Preset:** Next.js (auto-detected).
4. **Root directory:** leave at default (the repo root is the project root).
5. **Build & Output settings:** keep defaults. Vercel runs `npm run build`
   which already includes `prisma generate` via Next's build pipeline.
6. **Environment variables** — add the following before the first build:

   | Name | Required | Value |
   | --- | --- | --- |
   | `DATABASE_URL` | yes | Pooled Neon connection string from step 1.4. |
   | `AUTH_SECRET` | yes | A long random string (e.g. `openssl rand -base64 32`). Used to sign JWT session cookies. |
   | `NODE_ENV` | no | `production` (Vercel sets this automatically). |

7. Click **Deploy**. The first build takes ~3 minutes.
8. After deploy, browse to the URL Vercel gives you and sign in with
   the seeded admin user (see seed output for the demo password).

### Re-deploying

Every push to `master` triggers a new Vercel deploy automatically. No
extra step is needed.

### Running migrations on the deployed database

Because we use `prisma db push` (not `prisma migrate deploy`), schema
changes are applied from your laptop against `DATABASE_URL`:

```bash
export DATABASE_URL='<production connection string>'
npx prisma db push
```

When the app moves to a stricter migration workflow, switch to
`prisma migrate dev` locally and `prisma migrate deploy` in CI.

---

## 3. Path B — Render (alternative all-in-one)

1. Sign in to <https://render.com>.
2. **New → PostgreSQL.**
   - **Name:** `usc-pec-db`
   - **Region:** `Oregon` (US West).
   - **Plan:** start on Free, upgrade later.
   - Click **Create Database**. Wait ~1 minute for provisioning.
3. Copy the **Internal Database URL** (used by app) and the **External
   Database URL** (used from your laptop for `prisma db push`).
4. **New → Web Service**, point it at the GitHub repo.
   - **Runtime:** Node.
   - **Build command:** `npm install && npx prisma generate && npm run build`
   - **Start command:** `npm start`
   - **Environment variables:**
     - `DATABASE_URL` → Internal Database URL from step 3.
     - `AUTH_SECRET` → random string (`openssl rand -base64 32`).
5. Click **Create Web Service**. First deploy takes ~5 minutes.
6. Push the schema once from your laptop using the External URL:
   ```bash
   export DATABASE_URL='<external Postgres URL from Render>'
   npx prisma db push
   npx prisma db seed
   ```
7. The Render service URL is your live app.

---

## 4. Environment variables — full reference

| Name | Where | Required | Notes |
| --- | --- | --- | --- |
| `DATABASE_URL` | local `.env`, Vercel/Render | yes | Postgres connection string. Use **pooled** for serverless (Vercel + Neon). |
| `AUTH_SECRET` | local `.env`, Vercel/Render | yes (prod) | Signs the `tng_session` JWT cookie. In dev a fallback is used. |
| `NEXTAUTH_URL` | — | no | Not used by this app's auth (custom JWT in `src/lib/auth.ts`). |
| `NODE_ENV` | host platform | auto | `production` on Vercel/Render. |

Create a `.env.local` in dev with the same `DATABASE_URL` / `AUTH_SECRET`
to match the deployed setup.

---

## 5. Post-deployment checklist

After the first deploy succeeds:

- [ ] You can sign in with a seeded user (see `prisma/seed.ts` for the
      demo password).
- [ ] The **Schedule Board** loads at the correct operational week
      (Thursday → Wednesday for today).
- [ ] Clicking **Today / Prev / Next** moves exactly one operational week.
- [ ] The calendar picker jumps to the right week.
- [ ] Creating a BEO at `/beos/new` makes the BEO appear on the board for
      its `eventDate` week.
- [ ] **Servers** drawer and **Managers** drawer both populate.
- [ ] **Availability** editor saves and the table updates immediately.
- [ ] No `AuditLog_userId_fkey` errors in the runtime logs.

If `AuditLog_userId_fkey` fires on a freshly-deployed instance, the JWT
in your browser refers to a userId that wasn't present in the deployed
database. Clear the `tng_session` cookie and sign in again — the auth
layer drops stale-cookie sessions automatically.

---

## 6. Manual steps you must complete yourself

These cannot be automated and need a human:

1. Create the Neon (or Render Postgres) account and project.
2. Create the Vercel (or Render) account and link your GitHub.
3. Paste the database connection string into the host's env-var UI.
4. Generate and paste an `AUTH_SECRET` (one-time, never commit).
5. After Path A: run `npx prisma db push` and `npx prisma db seed` once
   from your laptop pointing at the production `DATABASE_URL`.
6. Sign in once and change the seeded demo admin password.

Once you have completed steps 1–6, the next deploy will run hands-off on
every `git push origin master`.
