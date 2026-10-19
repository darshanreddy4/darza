# Production guide: what to ship, how to launch, how to configure

A single-page guide for putting this shop live on a server. It covers which folders and files matter in production, the exact steps and commands to launch, the settings to fill in, and how to update, back up and fix things afterwards.

For more detail on any step, see the chapters in [`setup-guide/`](setup-guide/README.md). This page is the short, ordered version.

---

## 1. How the production setup fits together

```
Browser ──https──> Caddy (proxy) ──> web  (Next.js, port 3000)   www.yourshop.com
                          │
                          └────────> api  (NestJS,  port 4000)   api.yourshop.com
                                       │
                                       ├── db     (PostgreSQL 17)       volume: pgdata
                                       ├── cache  (Redis 7)             volume: redisdata
                                       ├── search (Meilisearch, optional)
                                       └── uploads (pictures and videos) volume: uploads, or an S3-compatible bucket
```

- Everything runs in Docker with **one file**: [`deploy/docker-compose.yml`](deploy/docker-compose.yml).
- All settings live in **one file on the server**: `deploy/.env` (never committed to git).
- The API applies new database migrations by itself every time it starts.
- Caddy gets and renews the https certificates by itself.

---

## 2. Which folders and files matter

### Needed on the production server (via `git clone` / `git pull`)

| Path | Why |
|---|---|
| `apps/api/` (all of it except what git ignores) | The API image is built from it. Includes `src/`, `prisma/schema.prisma`, **every folder in `prisma/migrations/`**, `package.json`, `package-lock.json`, `tsconfig.json`, `Dockerfile`, `docker-entrypoint.sh` |
| `apps/web/` (all of it except what git ignores) | The web image is built from it. Includes `src/`, `public/`, `package.json`, `package-lock.json`, `next.config.ts`, `tsconfig.json`, `Dockerfile` |
| `deploy/docker-compose.yml` | The production stack |
| `deploy/Caddyfile` | The https proxy rules |
| `deploy/.env.example` | Template for your real `deploy/.env` |
| `deploy/backup.sh`, `deploy/restore.sh` | Backup and restore |

> Every new migration folder under `apps/api/prisma/migrations/` must be committed. A migration that is only on your laptop never reaches production, and the app will fail against the old database.

### Keep in git, but not used by the running server

| Path | What it is |
|---|---|
| `e2e/` | Browser tests, run by CI |
| `.github/workflows/ci.yml` | The CI pipeline (type-check, unit tests, lint, build, Docker builds, browser tests) |
| `business-docs/`, `setup-guide/`, `README.md`, this file | Documentation |
| `docker-compose.yml` in the repo root | The **local development** stack (not the production one) |

### Not needed in production (and mostly not in git)

| Path | Note |
|---|---|
| `node_modules/`, `dist/`, `.next/`, `*.tsbuildinfo`, `.DS_Store` | Build output. Ignored by git. Docker builds them fresh |
| `apps/api/uploads/` | Pictures you uploaded while developing. Ignored by git. Do not copy it to production |
| `.env`, `.env.local` | Ignored by git. Create a new `deploy/.env` on the server |
| `e2e/.auth/`, `e2e/test-results/`, `e2e/playwright-report/` | Test output. Ignored |
| `design/` | Source artwork (banner images). Not referenced by the code. Not needed on the server |
| `.vscode/` | Editor settings only |

### Things that exist only on your laptop

Your local database (test products, coupons such as `DIWALI60`, test orders, customers) does not go to production. Create the real catalogue, coupons and settings in the production admin. If you want to bring products across, use **Admin → Products → export/import (CSV)**, then upload the product pictures again (or copy the uploads, see section 9).

---

## 3. Before you start

| You need | Notes |
|---|---|
| A Linux server | Ubuntu 22.04 or 24.04, at least 2 vCPU and **4 GB RAM** (the web build needs memory), 20 GB disk |
| A domain | Two names: `www.yourshop.com` (shop) and `api.yourshop.com` (API). They must share the same parent domain so the login cookie works |
| Open ports | 22 (your access), 80 and 443. Nothing else needs to be public |
| An email service | Any SMTP provider (Brevo, Mailgun, Zoho, Postmark, Gmail app password) or Amazon SES |
| Optional | Razorpay keys (online payments), Twilio (phone sign-in codes), WhatsApp Business, Google sign-in, S3/R2 bucket (uploads), Meilisearch (search) |

---

## 4. Step-by-step launch

### Step 1: point the domains at the server

At your DNS provider create two **A records** with the server's public IP:

| Name | Type | Value |
|---|---|---|
| `www` | A | server IP |
| `api` | A | server IP |

Wait until `ping www.yourshop.com` shows the server's IP.

### Step 2: install Docker on the server

```bash
ssh <user>@<server-ip>
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER        # then log out and back in
docker compose version                # must print a version
```

Open the firewall for ports 22, 80 and 443 (for example `sudo ufw allow 22,80,443/tcp && sudo ufw enable`).

### Step 3: put the code on the server

On your **laptop**, make sure everything is committed and pushed (see section 8, "Before you push").

On the **server**:

```bash
git clone <your-repository-url> shop
cd shop/deploy
```

### Step 4: create the settings file

```bash
cp .env.example .env
nano .env
```

Fill in at least the values in section 5. Generate secrets with:

```bash
openssl rand -base64 24     # POSTGRES_PASSWORD
openssl rand -base64 48     # JWT_SECRET
```

### Step 5: build and start everything

```bash
docker compose up -d --build
docker compose ps             # every service should be "running" or "healthy"
```

The first build takes several minutes. On first start the API creates all database tables by running every migration.

### Step 6: create the admin login

```bash
docker compose run --rm api npm run admin:create
```

It uses `ADMIN_EMAIL` and `ADMIN_PASSWORD` from `.env` and adds no sample products. Run it again to reset that admin's password.

### Step 7: check that it works

1. Open `https://www.yourshop.com`. The empty shop appears with a padlock (the certificate arrives within a minute of the first visit).
2. Open `https://api.yourshop.com/health/ready`. It should show `{"status":"ok","checks":{"database":"ok","storage":"ok"}}`.
3. Open `https://www.yourshop.com/admin` and sign in.
4. If anything fails: `docker compose logs api`, `docker compose logs web`, `docker compose logs proxy`.

### Step 8: set up backups straight away

```bash
cd ~/shop/deploy
./backup.sh                                   # try it once
crontab -e
# add this line (nightly at 02:00):
0 2 * * *  cd /home/<user>/shop/deploy && ./backup.sh >> backup.log 2>&1
```

Copy the `backups/` folder to another machine or a bucket as well. A backup on the same disk is not a backup. Test one restore on a spare server before taking real orders.

---

## 5. Configuration: `deploy/.env`

### Required

| Setting | Example | Notes |
|---|---|---|
| `WEB_DOMAIN` | `www.yourshop.com` | Shop address (no `https://`) |
| `API_DOMAIN` | `api.yourshop.com` | API address (no `https://`) |
| `NEXT_PUBLIC_SITE_URL` | `https://www.yourshop.com` | Built into the pages |
| `NEXT_PUBLIC_API_URL` | `https://api.yourshop.com` | Built into the pages |
| `WEB_ORIGIN` | `https://www.yourshop.com` | The API only accepts requests from this origin |
| `COOKIE_DOMAIN` | `.yourshop.com` | Parent domain with a leading dot, so www and api share the login cookie |
| `POSTGRES_PASSWORD` | long random | Database password |
| `JWT_SECRET` | 48+ random characters | The API refuses to start in production with an unsafe value |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | you@yourshop.com, 12+ characters | First admin account |
| `MAIL_FROM` and `SMTP_URL` (or `AWS_REGION` for SES) | `"Your Shop <orders@yourshop.com>"` | Needed for verification, password reset and order emails |
| `TRUST_PROXY` | `1` (or `2` behind Cloudflare) | How many proxies sit in front of the API; without it rate limits see every visitor as one |

> `NEXT_PUBLIC_*` values are written into the web pages **at build time**. After changing any of them, rebuild: `docker compose up -d --build web`.

### Optional features

| Feature | Settings | After changing |
|---|---|---|
| Online payments (Razorpay) | `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`. In the Razorpay dashboard add a webhook for `payment.captured` pointing at `https://api.yourshop.com/payments/razorpay/webhook` with the same secret | `docker compose up -d api` |
| Uploads in a bucket | `STORAGE_DRIVER=s3`, `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, plus `S3_ENDPOINT` for R2, Spaces or B2 (and optionally `STORAGE_PUBLIC_URL`) | `docker compose up -d api` |
| Meilisearch search | `MEILI_URL=http://search:7700`, `MEILI_MASTER_KEY=<24+ random>`; start with `docker compose --profile search up -d`; then Admin → Overview → Rebuild once | |
| Phone sign-in by SMS | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM` | `docker compose up -d api` |
| Google sign-in | `GOOGLE_CLIENT_ID` | `docker compose up -d api` |
| WhatsApp order updates | `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_TEMPLATE`, `WHATSAPP_TEMPLATE_LANG` | `docker compose up -d api` |
| PIN code lookup | Works out of the box through the India Post service (falls back to a built-in check). Set `PINCODE_LOOKUP=off` to disable the network lookup | `docker compose up -d api` |
| Error alerts | `ERROR_WEBHOOK_URL` (Slack, Discord, any webhook taking a JSON `text` field) | `docker compose up -d api` |
| Managed database or Redis | Set `DATABASE_URL` or `REDIS_URL` and remove the matching `db` or `cache` service from `docker-compose.yml` | |
| Business details on policy pages | `NEXT_PUBLIC_BUSINESS_NAME`, `NEXT_PUBLIC_LEGAL_NAME`, `NEXT_PUBLIC_SUPPORT_EMAIL`, `NEXT_PUBLIC_SUPPORT_PHONE`, `NEXT_PUBLIC_BUSINESS_ADDRESS`, `NEXT_PUBLIC_GSTIN`, `NEXT_PUBLIC_GRIEVANCE_*` (can also be set later in Admin) | `docker compose up -d --build web` |

---

## 6. Configure the store in the admin (after launch)

Sign in at `https://www.yourshop.com/admin` and set these up before opening to customers.

| Where in Admin | What to set |
|---|---|
| **Brand** | Name, logo, tagline, about, contact email, phone, address, care hours |
| **Settings → Delivery charges** | Delivery fee, free delivery over an amount, optional "free delivery on everything" amount |
| **Settings → Delivery by area** | Different fee for areas picked by the start of PIN codes (optional) |
| **Settings → Rewards for big orders** | Free gifts and percentage-off rewards shown on the cart progress bar (optional) |
| **Settings → Returns** | Return window in days (a product can override this or say "No returns") |
| **Settings → GST and invoices** | GST on or off, GSTIN, business name and address, state, invoice prefix |
| **Settings → Inventory alerts and sales report** | Low-stock level and email, weekly or monthly sales report email |
| **Products** | Categories, then products: price, stock, pictures, pack size (quantity, volume, weight), returns rule, delivery charge rule (follow store, always free, always charge) |
| **Coupons** | Codes with minimum order, limits per customer (counted by account, email and mobile number), first-order only, chosen customers, and whether the code is **shown** in carts |
| **Pages** | Terms, Privacy, Refund, Shipping and Affiliate disclosure texts (have them reviewed by a professional) |
| **Home page and Banners** | Arrange the home page, add at least one banner |
| **Users** | Give your team the **Staff** role, and use the admin account only for settings |

Then run the full rehearsal in [`setup-guide/08-go-live-checklist.md`](setup-guide/08-go-live-checklist.md): sign up, order by cash on delivery, ship and deliver, return, cancel, and (if enabled) pay and refund online.

---

## 7. Updating the live site (every release)

On your laptop first (section 8), then on the server:

```bash
cd ~/shop/deploy
./backup.sh                          # always back up before a release
git pull
docker compose up -d --build         # rebuilds changed images; new database migrations run automatically
docker compose ps
curl -s https://api.yourshop.com/health/ready
```

| Situation | Command (in `shop/deploy`) |
|---|---|
| Changed `.env` (not `NEXT_PUBLIC_*`) | `docker compose up -d api` |
| Changed a `NEXT_PUBLIC_*` value | `docker compose up -d --build web` |
| Follow the API log | `docker compose logs -f api` |
| Restart one service | `docker compose restart api` |
| Stop everything (data kept) | `docker compose down` |
| Restore a backup (asks for YES) | `./restore.sh backups/db-<time>.dump` |

Database change rules (see [`setup-guide/10-database-changes.md`](setup-guide/10-database-changes.md)):

- Only **add** migration folders. Never edit or delete one that has already run.
- Production uses `prisma migrate deploy` (done automatically). **Never** run `migrate dev`, `migrate reset` or `db push` against production.
- Do not run `db:seed:e2e` or `db:seed` on production. Use `admin:create` only.

If a release goes wrong: restore the backup from before it (`./restore.sh …`) and `git checkout` the previous version, then `docker compose up -d --build`.

---

## 8. Before you push (on your laptop)

Run the same checks CI runs:

```bash
# API
cd apps/api && npx tsc --noEmit && npm test

# Web
cd ../web && npx tsc --noEmit && npm run lint && npm run build

# Browser tests (needs the e2e database; see e2e/ and the CI file)
```

Then make sure nothing new is left out of git:

```bash
git status
```

- Every new file you want in production must be tracked, especially **new folders in `apps/api/prisma/migrations/`** and new files in `apps/api/src/` and `apps/web/src/`.
- Do not commit `.env` files or `uploads/`.
- Commit and push:

```bash
git add -A
git commit -m "Describe the release"
git push
```

---

## 9. Moving existing uploads (only if you need them)

Uploads from your laptop are normally not needed. If you do want them on a server that uses local storage:

```bash
# on the laptop
tar -C apps/api -cf uploads.tar uploads
scp uploads.tar <user>@<server-ip>:~/
# on the server, after the stack is running
cd ~/shop/deploy
docker compose cp ~/uploads.tar api:/tmp/uploads.tar
docker compose exec api tar -C /app -xf /tmp/uploads.tar
```

With `STORAGE_DRIVER=s3`, upload the files to the bucket instead.

---

## 10. Troubleshooting

| Symptom | Check |
|---|---|
| Shop opens without a padlock | DNS points to the server, ports 80 and 443 are open, `docker compose logs proxy` |
| `/health/ready` says database error | `docker compose logs db`, check `POSTGRES_PASSWORD` or `DATABASE_URL` |
| API container keeps restarting | `docker compose logs api`: it refuses to start with an unsafe `JWT_SECRET` or admin password, or a failed migration |
| Cannot log in, or logged out immediately | `COOKIE_DOMAIN` must be `.yourshop.com`, and `WEB_ORIGIN` must exactly match the shop address |
| Images or links point to the wrong address | `NEXT_PUBLIC_*` was changed without rebuilding the web image |
| No emails arrive | `SMTP_URL`/`MAIL_FROM` (or SES), spam folder, SPF and DKIM records |
| Online payments do not mark orders paid | Razorpay webhook URL and secret, `docker compose logs api` |
| Everything is rate limited as one person | `TRUST_PROXY` is not set to the number of proxies |
| Admin pages show an empty list or errors after an update | Make sure the API was rebuilt and restarted so it matches the database: `docker compose up -d --build api` |

More help: [`setup-guide/09-operations.md`](setup-guide/09-operations.md).
