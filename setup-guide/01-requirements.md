# 1. Requirements and dependencies

## Software

| Software | Version | Needed for | Notes |
|---|---|---|---|
| Node.js | 22 or newer | Running the API and web app without Docker, running tests | Check with `node -v` |
| npm | 10+ (comes with Node 22) | Installing packages | |
| Docker + Docker Compose | Docker 24+ / Compose v2 | Local database, and all production deployment methods in this guide | Check with `docker compose version` |
| Git | any | Getting and updating the code | |
| PostgreSQL | 14+ (17 recommended) | The database | Provided by Docker locally; may be a managed database in production |
| Redis | 6+ (7 recommended) | Optional cache | Provided by Docker |
| Meilisearch | 1.12 | Optional search | Provided by Docker |

You do **not** need to install PostgreSQL, Redis or Meilisearch yourself if you use Docker.

## Libraries the code uses (installed automatically by `npm install`)

You never install these by hand. They are listed so you know what the project relies on.

| Area | Main packages |
|---|---|
| API | NestJS 11, Prisma 6 (database), class-validator (input checks), bcryptjs (passwords), jsonwebtoken via `@nestjs/jwt`, helmet (security headers), `@nestjs/throttler` (rate limits), sharp (image resizing), ioredis (cache), nodemailer and AWS SES SDK (email), AWS S3 SDK (bucket storage) |
| Web | Next.js 16, React 19, Tailwind CSS 4 |
| Tests | Playwright, axe (accessibility) |

## Accounts you may need (all optional until you want that feature)

| Feature | Account | Cost | What you get from it |
|---|---|---|---|
| Domain name | Any registrar | yearly | `www.` and `api.` addresses |
| Server or cloud | Any host (see [choose hosting](04-choose-hosting.md)) | monthly | Where it runs |
| Email sending | Any SMTP service (Brevo, Mailgun, Zoho, Postmark, Gmail app password) **or** Amazon SES | free tiers exist | `SMTP_URL` or AWS keys |
| Online payments | Razorpay | per transaction | Key id, key secret, webhook secret |
| Phone codes / SMS | Twilio | per message | Account SID, auth token, sender number |
| WhatsApp updates | Meta Business (WhatsApp Cloud API) | per conversation | Token, phone number id, approved template |
| Google sign-in | Google Cloud Console | free | OAuth client id |
| Pictures and videos | Any S3-compatible bucket (optional) | per GB | Bucket name and keys |
| Error alerts | Slack, Discord or any JSON webhook (optional) | free | Webhook address |

## Server size guide

| Store size | Suggested server | Notes |
|---|---|---|
| Trying it out, a few hundred visitors a day | 2 vCPU, 4 GB RAM, 40 GB disk | Runs everything in this guide on one machine |
| Growing store | 4 vCPU, 8 GB RAM, plus a managed PostgreSQL | Keep Redis on; consider Meilisearch |
| Large | Several API and web containers behind a load balancer, managed PostgreSQL and Redis, bucket storage | Use [managed platforms](06-deploy-managed-platforms.md); uploads must be in a bucket |

Disk matters if uploads are kept on the server: plan for the size of all product pictures and videos plus database growth, and keep backups elsewhere.

## Network requirements

- Ports **80** and **443** open to the internet (the bundled proxy gets free https certificates automatically).
- Two DNS records, both pointing to the server: the web address and the API address (for example `www.myshop.com` and `api.myshop.com`).
- The server must be able to reach out to: your email provider, Razorpay, Twilio, WhatsApp (if used), Google (if sign-in is used).
- Building the web app downloads the shop's fonts from Google Fonts, so the **build** machine needs internet access.
- On company networks that inspect https traffic with their own certificate, Docker builds can fail with `SELF_SIGNED_CERT_IN_CHAIN`. Build on a normal network, or ask your network team for the root certificate.
