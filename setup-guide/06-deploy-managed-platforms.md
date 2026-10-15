# 6. Deploy on managed platforms (separate web, API, database, storage)

Use this when you want each piece on its own service. The recipe is the same on every platform; only the buttons differ. Decide the two addresses first (for example `www.myshop.com` for the shop and `api.myshop.com` for the API) because they appear in several places.

```mermaid
flowchart LR
  subgraph "1. Data"
    DB[(Managed PostgreSQL)]
    FILES[(Bucket: S3 / R2 / Spaces / B2)]
    REDIS[(Managed Redis - optional)]
  end
  subgraph "2. API service  api.myshop.com"
    API[Docker image apps/api]
  end
  subgraph "3. Web service  www.myshop.com"
    WEB[Docker image apps/web<br/>or Next.js host]
  end
  API --> DB
  API --> FILES
  API --> REDIS
  WEB -->|NEXT_PUBLIC_API_URL| API
```

## Step 1: create the data services

1. **PostgreSQL** (14+). Note the connection string. Make sure the API's platform can reach it (allow its outbound IPs, or use a private network). Typical form: `postgresql://user:password@host:5432/dbname?sslmode=require`.
2. **Bucket for uploads.** Create a private bucket and an access key limited to it. Follow the provider table in [guide 7](07-storage-email-sms-payments.md#files-pictures-and-videos).
3. **Redis** (optional). Note its `redis://` or `rediss://` address.

## Step 2: deploy the API

The API is a container built from [`apps/api/Dockerfile`](../apps/api/Dockerfile).

| Platform setting | Value |
|---|---|
| Source / build | Repository, root directory `apps/api`, Dockerfile build |
| Port | 4000 |
| Health check path | `/health/ready` (or `/health` for a plain liveness check) |
| Instances | 1 to start; more only with `STORAGE_DRIVER=s3` |
| Custom domain | `api.myshop.com` (the platform issues the certificate) |

Environment variables (all in [configuration](03-configuration.md)):

```text
NODE_ENV=production
DATABASE_URL=<from step 1>
JWT_SECRET=<openssl rand -base64 48>
WEB_ORIGIN=https://www.myshop.com
COOKIE_DOMAIN=.myshop.com
TRUST_PROXY=1
MAIL_FROM="My Shop <orders@myshop.com>"
SMTP_URL=smtps://user:password@smtp.provider.com:465
STORAGE_DRIVER=s3
S3_BUCKET=...  S3_REGION=...  S3_ENDPOINT=...  S3_ACCESS_KEY_ID=...  S3_SECRET_ACCESS_KEY=...
REDIS_URL=<optional>
LOG_FORMAT=json
```

The container applies database migrations itself when it starts. Then create the first admin once. Use your platform's "run a one-off command" or "shell" feature:

```bash
ADMIN_EMAIL=you@myshop.com ADMIN_PASSWORD='a long password' npm run admin:create
```

(On a platform without a shell, run the same command from your own computer with `DATABASE_URL` pointing at the managed database: `cd apps/api && npm install && npx prisma generate && npm run build && ADMIN_EMAIL=... ADMIN_PASSWORD=... DATABASE_URL=... npm run admin:create`.)

Check `https://api.myshop.com/health/ready`.

## Step 3: deploy the web app

Two ways; pick one.

**Option 1: the Docker image** (works on any container platform):

```bash
docker build -t shop-web \
  --build-arg NEXT_PUBLIC_API_URL=https://api.myshop.com \
  --build-arg NEXT_PUBLIC_SITE_URL=https://www.myshop.com \
  apps/web
```

Run it with port 3000 and health check `/health`. Most platforms can build this for you from the repository; add the two values as **build arguments**.

**Option 2: a Next.js host** (Vercel, Netlify, Cloudflare, Amplify). Import the repository, set the root directory to `apps/web`, and add `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_SITE_URL` as environment variables for the build. Attach `www.myshop.com`.

Either way, set both domains' DNS records as the platform instructs.

## Step 4: connect the pieces (checklist)

| Check | Where |
|---|---|
| `WEB_ORIGIN` on the API equals the shop address, with `https://` and no trailing slash | API settings |
| `NEXT_PUBLIC_API_URL` on the web equals the API address | Web build settings |
| `COOKIE_DOMAIN` is the shared parent domain with a leading dot | API settings |
| Browser can open `https://api.myshop.com/health` | Any browser |
| Log in at `https://www.myshop.com/login` and stay logged in after a refresh | Browser |
| Upload a product picture in Admin and see it on the shop | Admin → Products |

## Step 5: payments and webhooks

In the Razorpay dashboard create a webhook to `https://api.myshop.com/payments/razorpay/webhook` for the `payment.captured` event, with the same secret as `RAZORPAY_WEBHOOK_SECRET`.

## Platform notes

| Platform | Tip |
|---|---|
| Render / Railway / Fly.io | Create a web service from `apps/api` with the Dockerfile. Add a managed Postgres and copy its URL into `DATABASE_URL` |
| AWS | API on ECS Fargate or App Runner behind an Application Load Balancer, RDS for PostgreSQL, S3 for files (leave `S3_ENDPOINT` empty and give the task role access, then leave the keys empty), SES for email |
| Google Cloud | API on Cloud Run (set minimum instances to 1 to avoid slow first requests), Cloud SQL for PostgreSQL, a bucket with HMAC keys through S3 interoperability |
| Azure | Container Apps for both images, Azure Database for PostgreSQL, a MinIO or S3-compatible bucket for files |
| DigitalOcean | App Platform from the Dockerfiles, Managed PostgreSQL, Spaces for files |
| Vercel / Netlify (web only) | Set the two `NEXT_PUBLIC_*` variables, root directory `apps/web` |

## When something looks wrong

See [troubleshooting](09-operations.md#troubleshooting). The two most common causes on managed platforms are a `WEB_ORIGIN` that does not match the browser address (login does not stick) and uploads kept on a disk that is wiped on every deploy (use a bucket).
