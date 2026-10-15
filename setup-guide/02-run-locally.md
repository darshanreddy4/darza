# 2. Run it on your computer

Use this to try the store, to preview changes, or to develop. Nothing here touches a live site.

## Step 1: get the code

```bash
git clone <your repository> shop
cd shop
```

## Step 2: start the helper services (database, cache, search)

```bash
docker compose up -d
```

This starts PostgreSQL on port 5432, Redis on 6379 and Meilisearch on 7700, with development passwords. Check they are up:

```bash
docker compose ps
```

## Step 3: start the API

```bash
cd apps/api
cp .env.example .env          # the defaults already match the helper services
npm install
npx prisma migrate dev        # creates all database tables
npm run db:seed               # creates the admin user and a few sample products
npm run dev                   # API on http://localhost:4000
```

Check it: open <http://localhost:4000/health/ready>. You should see `{"status":"ok","checks":{"database":"ok","storage":"ok"}}`.

The admin login is the `ADMIN_EMAIL` and `ADMIN_PASSWORD` written in `apps/api/.env`.

## Step 4: start the web app

Open a second terminal:

```bash
cd apps/web
cp .env.example .env.local
npm install
npm run dev                   # shop on http://localhost:3000
```

Open <http://localhost:3000> for the shop and <http://localhost:3000/admin> for the admin area (log in with the admin account).

## What works without any accounts

| Feature | Local behaviour |
|---|---|
| Emails (verification, order updates) | Printed in the API terminal instead of being sent |
| Phone sign-in codes | The code is printed in the API terminal |
| Online payment | Hidden; only cash on delivery is offered |
| Google sign-in | Hidden |
| WhatsApp updates | Message printed in the API terminal |
| Uploads | Saved in `apps/api/uploads` |

So you can sign up, verify by copying the link from the API terminal, order, and run the whole admin flow without connecting anything.

## Everyday commands

| Task | Command (from the folder shown) |
|---|---|
| Start API in development | `apps/api`: `npm run dev` |
| Start web in development | `apps/web`: `npm run dev` |
| Type-check the API | `apps/api`: `npx tsc --noEmit` |
| Run API unit tests | `apps/api`: `npm test` |
| Lint the web app | `apps/web`: `npm run lint` |
| Production build of the web app | `apps/web`: `npm run build` |
| Add a database change | edit `apps/api/prisma/schema.prisma`, then `npx prisma migrate dev --name what_changed` |
| Look at the data | `apps/api`: `npx prisma studio` |
| Stop the helper services | repository root: `docker compose down` (add `-v` to also erase their data) |

## Run the automated browser tests

These run against their own throwaway database, so your data is safe.

```bash
# once: a database for tests
docker compose exec db psql -U dmg -d postgres -c "CREATE DATABASE dmg_e2e"
export E2E_DATABASE_URL=postgresql://dmg:dmg@localhost:5432/dmg_e2e
export E2E_REDIS_URL=redis://localhost:6379/1

(cd apps/api && DATABASE_URL=$E2E_DATABASE_URL npx prisma migrate deploy && DATABASE_URL=$E2E_DATABASE_URL npm run db:seed:e2e && npm run build)
(cd apps/web && NEXT_PUBLIC_API_URL=http://localhost:4100 NEXT_PUBLIC_SITE_URL=http://localhost:3100 npx next build)

cd e2e
npm install
npx playwright install chromium
npx playwright test
```

Run `npm run db:seed:e2e` again before a second run so stock and prices start from the same place. The full suite takes about six minutes.

## Common local problems

| Symptom | Fix |
|---|---|
| `port 5432 is already allocated` | Another PostgreSQL is running. Stop it, or change the port in `docker-compose.yml` and in `DATABASE_URL` |
| `Can't reach database server` | `docker compose ps` — is `db` running? Is `DATABASE_URL` correct? |
| Web shows "Loading…" forever or network errors | The API is not running, or `NEXT_PUBLIC_API_URL` in `apps/web/.env.local` is wrong |
| Logged in but still treated as signed out | `WEB_ORIGIN` in `apps/api/.env` must be exactly the address in your browser (`http://localhost:3000`) |
| After pulling new code, errors about missing columns | Run `npx prisma migrate dev` again in `apps/api` |
| `SELF_SIGNED_CERT_IN_CHAIN` during install | Your network inspects https. Use a normal network, or `npm config set cafile <company-cert.pem>` |
