# Setup guide: from zero to a live store

This folder explains, step by step, how to run the store on your own computer, how to configure it, and how to put it on any server or cloud. You do not need to have chosen a host yet: everything here works the same on a cheap VPS, AWS, Google Cloud, Azure, DigitalOcean, Render, Railway, Fly.io or your own machine.

## Read in this order

| # | Guide | Read it when |
|---|---|---|
| 1 | [Requirements and dependencies](01-requirements.md) | You want to know what must be installed and which accounts you need |
| 2 | [Run it on your computer](02-run-locally.md) | You want to try or develop the store locally |
| 3 | [Configuration reference](03-configuration.md) | You need to know what every setting does |
| 4 | [Choose where to host](04-choose-hosting.md) | You have not decided where to host yet |
| 5 | [Deploy on one server (Docker)](05-deploy-one-server.md) | You want the simplest, fully scripted production setup |
| 6 | [Deploy on managed platforms](06-deploy-managed-platforms.md) | You want web, API, database and storage on separate services |
| 7 | [Storage, email, SMS and payments](07-storage-email-sms-payments.md) | You are connecting uploads, email, phone codes or Razorpay |
| 8 | [Go-live checklist](08-go-live-checklist.md) | The site works and you are about to open it to customers |
| 9 | [Running it day to day](09-operations.md) | Backups, updates, monitoring, restoring, troubleshooting |
| 10 | [Changing the database safely](10-database-changes.md) | You add or change a field, set up another laptop from scratch, or ship a release with a database change |

## What you are deploying

```mermaid
flowchart LR
  Customer([Customer browser]) -->|https| Web[Web app<br/>Next.js<br/>storefront + admin]
  Customer -->|https, login cookie| API[API<br/>NestJS]
  Web -->|server-side requests| API
  API --> DB[(PostgreSQL<br/>orders, products, users)]
  API -.optional.-> Cache[(Redis<br/>cache)]
  API -.optional.-> Search[(Meilisearch<br/>fast search)]
  API --> Files[(File storage<br/>disk or S3 bucket<br/>product pictures, videos)]
  API --> Mail[Email<br/>SMTP or Amazon SES]
  API -.optional.-> SMS[SMS<br/>Twilio]
  API -.optional.-> WA[WhatsApp<br/>Meta Cloud API]
  API -.optional.-> Pay[Razorpay<br/>online payments]
  Pay -->|webhook| API
```

Only two things are built by us: the **web app** (`apps/web`) and the **API** (`apps/api`). Everything else is a standard service you can run yourself or rent.

| Piece | Required? | What it does |
|---|---|---|
| Web app | Yes | The shop customers see and the `/admin` area staff use |
| API | Yes | All business rules: catalogue, cart pricing, orders, payments, accounts, emails |
| PostgreSQL 14+ | Yes | The only place real data lives (products, orders, customers) |
| File storage | Yes | Pictures and videos. Server disk or any S3-compatible bucket |
| Email | Yes in production | Verification, password reset, order updates. Any SMTP provider or Amazon SES |
| Redis | Recommended | Speeds up the home page, banners, categories and product lists. The shop works without it |
| Meilisearch | Optional | Faster, typo-friendly search. Without it, search uses the database |
| Twilio | Optional | Phone-number sign-in codes and text-message order updates |
| WhatsApp Cloud API | Optional | Order updates on WhatsApp |
| Razorpay | Optional | Card, UPI and net-banking payments. Without it the shop offers cash on delivery only |
| Google sign-in | Optional | "Continue with Google" button |

## How the pieces are linked (the three addresses that matter)

Everything connects through three web addresses and one secret. Get these right and the rest follows.

| Setting | Where it is set | Meaning | Example |
|---|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | Web app (build time) | The public address of the shop | `https://www.myshop.com` |
| `NEXT_PUBLIC_API_URL` | Web app (build time) | The public address of the API | `https://api.myshop.com` |
| `WEB_ORIGIN` | API | The shop address the API trusts (must match `NEXT_PUBLIC_SITE_URL`, `https://` in production) | `https://www.myshop.com` |
| `COOKIE_DOMAIN` | API | Parent domain so the login cookie works on both www and api | `.myshop.com` |
| `DATABASE_URL` | API | How the API reaches PostgreSQL | `postgresql://user:pass@host:5432/db` |
| `JWT_SECRET` | API | Secret that signs login sessions (32+ random characters) | generated |

Important rules:

1. **Web and API must share a parent domain** (for example `www.myshop.com` and `api.myshop.com`). The login cookie is private to that domain, which is what keeps customers signed in securely.
2. **`NEXT_PUBLIC_*` values are baked into the web app when it is built.** If you change them, rebuild the web app. Change the API settings and only restart the API.
3. Only the API ever talks to the database, the storage, email, SMS and payments. The web app talks only to the API.

## Folder map

```
Ecommers website/
├── apps/
│   ├── api/                 the API (NestJS + Prisma). Dockerfile inside
│   └── web/                 the shop and admin (Next.js). Dockerfile inside
├── deploy/                  ready-made one-server production setup
│   ├── docker-compose.yml   database + cache + API + web + https proxy
│   ├── Caddyfile            https certificates and routing
│   ├── .env.example         the ONE file you fill in
│   ├── backup.sh            saves database (and uploads)
│   └── restore.sh           puts a backup back
├── docker-compose.yml       development only: database, cache, search on your laptop
├── e2e/                     automated browser tests
├── setup-guide/             this folder
├── business-docs/           how the business side works (for owners, staff, admins)
└── .github/workflows/ci.yml automatic checks on every push
```

## The 10-minute version (one server)

If you already have a Linux server with Docker, a domain, and two DNS records pointing at the server:

```bash
git clone <your repository> shop && cd shop/deploy
cp .env.example .env            # fill in the domains, secrets and email settings
docker compose up -d --build    # builds and starts everything, https included
docker compose run --rm api npm run admin:create   # creates your admin login
```

Then open `https://<your web domain>/admin`. The full explanation is in [Deploy on one server](05-deploy-one-server.md).
