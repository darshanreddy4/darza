# 9. Running it day to day

## Backups

What must be saved: the **database** (all orders, customers, products) and, if uploads are on the server disk, the **uploads**. Files in a bucket are kept by the bucket provider (enable its versioning for extra safety).

### With the one-server setup

```bash
cd shop/deploy
./backup.sh                 # writes backups/db-<time>.dump (+ uploads-<time>.tar) and removes old ones
```

Schedule it every night:

```bash
crontab -e
# add:
0 2 * * *  cd /home/<user>/shop/deploy && ./backup.sh >> backup.log 2>&1
```

`BACKUP_KEEP_DAYS` in `.env` (default 14) controls how long copies are kept.

**Copy backups off the server** (another machine, or a bucket): for example `rclone copy backups remote:shop-backups` from cron after `backup.sh`. A backup on the same disk is not a backup.

### With a managed database

Turn on the provider's automated backups and point-in-time recovery, and also take your own periodic dump:

```bash
pg_dump -Fc "$DATABASE_URL" > shop-$(date +%F).dump
```

### Restore

```bash
cd shop/deploy
./restore.sh backups/db-20261020-020000.dump      # asks you to type YES; replaces the database
```

For managed databases: `pg_restore --clean --if-exists --no-owner -d "$DATABASE_URL" shop.dump`.

Restore uploads (disk mode) with: `docker compose exec -T api tar -C /app -xf - < backups/uploads-<time>.tar`.

**Test a restore on a spare server at least monthly.** A backup you have never restored is a hope, not a backup.

## Updating

Releases are safe to apply on a running store: database changes are applied automatically when the API starts, and the API finishes in-flight requests before stopping.

```bash
cd shop
git pull
cd deploy
./backup.sh                          # always take a backup first
docker compose up -d --build         # rebuilds changed images, restarts them
docker compose ps                    # all healthy?
```

If anything is wrong, go back: `git checkout <previous version>` then `docker compose up -d --build`. Database changes are additive; if a release changed the database in a way the old version cannot use, restore the backup you just took.

In CI (`.github/workflows/ci.yml`) every push runs type checks, unit tests, lint, web build, Docker image builds and the full browser test suite. Deploy only from a green build.

## Monitoring

| What | How |
|---|---|
| Is it up? | Uptime monitor on `GET https://<api>/health` and `https://<web>/health` (UptimeRobot, Better Stack, a cloud load balancer health check...) |
| Is it healthy? | `GET https://<api>/health/ready` returns 503 with the failing part when the database or storage cannot be reached |
| Errors | `ERROR_WEBHOOK_URL` for instant alerts; `LOG_FORMAT=json` and ship logs to any log tool |
| Business | Admin → Analytics, Attention, Abandoned carts, Stock alerts; the scheduled sales-report email |
| Security trail | Admin → Audit log shows every change made in the admin area and who made it |

Docker keeps logs per container: `docker compose logs -f api`, `docker compose logs --since 1h api`.

## Routine tasks

| Frequency | Task |
|---|---|
| Daily | Process orders (Staff); check returns and COD payouts due (Admin → Returns → Payouts due); answer questions |
| Weekly | Review low-stock and attention lists; read the sales report |
| Monthly | Restore test; update the server (`apt upgrade`, reboot at a quiet hour); review users and roles; rotate any shared passwords |
| Yearly | Renew the domain; review policy pages and tax settings |

## Security habits

- Keep the server's operating system updated and use SSH keys, not passwords.
- Never commit `.env` files (they are ignored by git). Store secrets in a password manager.
- Give people the lowest role they need: **Staff** for daily work, **Admin** only for owners.
- If a staff member leaves, change their role to Customer in Admin → Users and use "sign out everywhere" on their row.
- Five wrong passwords lock an account for 15 minutes; a password reset clears the lock.

## Troubleshooting

| Symptom | Likely cause and fix |
|---|---|
| Site shows a certificate warning right after setup | DNS does not point at the server yet, or ports 80/443 are closed. Check with `docker compose logs proxy` |
| API container keeps restarting | `docker compose logs api`. The message after "Unsafe production configuration" lists exactly which settings to fix |
| Login works but the customer is signed out on the next page | `WEB_ORIGIN` does not exactly match the shop address, or `COOKIE_DOMAIN` is not the shared parent domain with a leading dot, or the shop is not on https |
| Everyone seems to share one rate limit, or "Too many requests" for normal use | `TRUST_PROXY` is not set to the number of proxies |
| Pictures missing after a redeploy | Uploads were on a disk that was wiped. Mount a persistent volume or use a bucket, and restore from backup |
| `/health/ready` says storage failed | Bucket name, region, endpoint or keys are wrong, or the key lacks permission |
| Emails not arriving | `docker compose logs api` for `Failed to send`; check SMTP URL encoding, SPF/DKIM, and the spam folder |
| Online payment succeeded but the order is not Paid | Webhook not reaching the API. Check the Razorpay webhook delivery log and `RAZORPAY_WEBHOOK_SECRET` |
| "Phone sign-in is not available" | Twilio settings missing (production hides the option when SMS cannot be sent) |
| Web shows old addresses after changing `NEXT_PUBLIC_*` | They are fixed at build time. Rebuild: `docker compose up -d --build web` |
| Docker build fails with `SELF_SIGNED_CERT_IN_CHAIN` | Your network inspects https. Build elsewhere, or add `--build-arg NODE_TLS_REJECT_UNAUTHORIZED=0 --build-arg NPM_CONFIG_STRICT_SSL=false` (weakens security during the build only) |
| Search finds nothing new | Admin → Overview → Rebuild search index, or empty `MEILI_URL` to use database search |
| Locked out of admin | `docker compose run --rm api npm run admin:create` resets the password and clears any lock |

## Command cheat sheet

```bash
# one-server setup, from shop/deploy
docker compose up -d --build            # start / update everything
docker compose ps                       # status
docker compose logs -f api              # live API log
docker compose restart api              # restart after editing .env
docker compose down                     # stop (data kept)
docker compose run --rm api npm run admin:create
./backup.sh      ./restore.sh <file>

# development, from the repository root
docker compose up -d                    # database, cache, search for local work
(cd apps/api && npm run dev)            # API on :4000
(cd apps/web && npm run dev)            # shop on :3000
(cd apps/api && npm test)               # unit tests
(cd e2e && npx playwright test)         # browser tests (see guide 2)
```
