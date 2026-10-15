# 5. Deploy on one server (Docker)

Everything runs on one Linux machine: database, cache, API, web app and an https proxy that gets and renews certificates by itself. The files are in [`deploy/`](../deploy/).

Time needed: about 30 minutes once the server and domain exist.

## Step 1: get a server

Any provider works (DigitalOcean, Hetzner, AWS Lightsail/EC2, Google Compute Engine, Azure VM, Linode, a machine in your office). Use Ubuntu 22.04 or 24.04 with at least 2 vCPU and 4 GB RAM (see [requirements](01-requirements.md)).

Open firewall ports **22** (your access), **80** and **443**. Nothing else needs to be public.

## Step 2: point two domain names at the server

At your domain registrar or DNS provider, create two **A records** pointing to the server's public IP address:

| Name | Type | Value |
|---|---|---|
| `www` | A | server IP |
| `api` | A | server IP |

(Use any names you like, as long as both end with the same parent domain, for example `www.myshop.com` and `api.myshop.com`.) Wait until `ping www.myshop.com` shows the server's IP.

## Step 3: install Docker on the server

```bash
ssh <your user>@<server ip>
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER      # then log out and back in
docker compose version             # should print a version
```

## Step 4: get the code onto the server

```bash
git clone <your repository> shop
cd shop/deploy
```

## Step 5: fill in the settings

```bash
cp .env.example .env
nano .env
```

Fill in at least the following (every line is explained in the file itself and in [configuration](03-configuration.md)):

| Setting | What to enter |
|---|---|
| `WEB_DOMAIN`, `API_DOMAIN` | `www.myshop.com`, `api.myshop.com` |
| `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_API_URL`, `WEB_ORIGIN` | `https://www.myshop.com`, `https://api.myshop.com`, `https://www.myshop.com` |
| `COOKIE_DOMAIN` | `.myshop.com` |
| `POSTGRES_PASSWORD` | A long random password (`openssl rand -base64 24`) |
| `JWT_SECRET` | `openssl rand -base64 48` |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | Your admin login (12+ characters) |
| `MAIL_FROM` and `SMTP_URL` (or `AWS_REGION`) | Your email provider, see [guide 7](07-storage-email-sms-payments.md) |

Leave optional parts (Razorpay, Twilio, WhatsApp, Google, Meilisearch) empty for now. You can add them later and restart.

## Step 6: start everything

```bash
docker compose up -d --build
```

The first run downloads images and builds the API and web app (several minutes). When it finishes:

```bash
docker compose ps          # all services should show "running" or "healthy"
```

The API creates all database tables by itself on first start.

## Step 7: create your admin login

```bash
docker compose run --rm api npm run admin:create
```

It uses `ADMIN_EMAIL` and `ADMIN_PASSWORD` from `.env` and adds no sample products. Run it again at any time to reset that admin's password.

## Step 8: check it works

1. Open `https://www.myshop.com` — the empty shop appears. The padlock should be shown (the certificate arrives within a minute of the first visit).
2. Open `https://api.myshop.com/health/ready` — it should say `{"status":"ok","checks":{"database":"ok","storage":"ok"}}`.
3. Open `https://www.myshop.com/admin` and log in.
4. Continue with the [go-live checklist](08-go-live-checklist.md).

If something is wrong, run `docker compose logs api` or `docker compose logs proxy` (see [troubleshooting](09-operations.md#troubleshooting)).

## Optional add-ons

| Add-on | How |
|---|---|
| Meilisearch search | In `.env` set `MEILI_URL=http://search:7700` and `MEILI_MASTER_KEY=<random 24+ characters>`, then `docker compose --profile search up -d`. Use Admin → Overview → Rebuild once |
| Files in a bucket instead of the disk | Set `STORAGE_DRIVER=s3` and the `S3_*` values (see [guide 7](07-storage-email-sms-payments.md)), then `docker compose up -d` |
| A managed database | Set `DATABASE_URL` in `.env`, delete the `db` service from `docker-compose.yml` (and the `depends_on` that mentions it) |
| A managed Redis | Set `REDIS_URL`, delete the `cache` service |
| Behind Cloudflare or another CDN | Set `TRUST_PROXY=2` |

## Daily operation on this setup

| Task | Command (run in `shop/deploy`) |
|---|---|
| See what is running | `docker compose ps` |
| Follow the API log | `docker compose logs -f api` |
| Restart the API after editing `.env` | `docker compose up -d api` |
| Rebuild the web app after changing `NEXT_PUBLIC_*` | `docker compose up -d --build web` |
| Update to new code | `git pull && docker compose up -d --build` (migrations run automatically) |
| Back up now | `./backup.sh` |
| Restore a backup | `./restore.sh backups/db-<time>.dump` |
| Stop everything (data kept) | `docker compose down` |

Set up a nightly backup (see [operations](09-operations.md#backups)) before you take real orders.
