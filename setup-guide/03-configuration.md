# 3. Configuration reference

Settings live in three places. Know which one to use.

| Where | Used for | How to change |
|---|---|---|
| **API environment** (`apps/api/.env`, or `deploy/.env` in the Docker setup) | Secrets and connections: database, email, payments, storage | Edit, then **restart the API** |
| **Web environment** (`apps/web/.env.local`, or build arguments in Docker) | The two public addresses and optional business details | Edit, then **rebuild the web app** |
| **Admin screens** (Brand, Settings, Home page, Banners, Coupons...) | Everything the business changes day to day: name, logo, delivery fee, tax, return days, banners, home layout | Change in the browser, effective immediately |

Rule of thumb: secrets and connections in environment files, business choices in the admin area.

## API environment variables

### Must be set in production

| Variable | What to put | Notes |
|---|---|---|
| `NODE_ENV` | `production` | Turns on the safety checks below |
| `DATABASE_URL` | `postgresql://user:password@host:5432/dbname?schema=public` | Add `&sslmode=require` for most managed databases |
| `JWT_SECRET` | A random string, 32+ characters | Generate: `openssl rand -base64 48`. Must not contain the words `secret`, `password` or `change-me` |
| `WEB_ORIGIN` | `https://www.myshop.com` | Comma-separate several addresses. Must be `https://` |
| `COOKIE_DOMAIN` | `.myshop.com` | Parent domain, with a leading dot |
| `MAIL_FROM` plus `SMTP_URL` **or** `AWS_REGION` | See [email](07-storage-email-sms-payments.md) | The API refuses to start in production without a mail provider |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | Your admin login (12+ characters) | Used by `npm run admin:create` |
| `TRUST_PROXY` | `1` (or `2` behind a CDN plus a proxy) | Without it, rate limits think every visitor is the proxy |

The API **refuses to start** in production if a setting is unsafe (short secret, `http://` origin, test flags left on). Its message lists exactly what to fix.

### Storage (where uploads are kept)

| Variable | Meaning |
|---|---|
| `STORAGE_DRIVER` | `local` (default, server disk) or `s3` (any S3-compatible bucket) |
| `UPLOAD_DIR` | Local only. Folder for files (default `./uploads`; `/app/uploads` in Docker) |
| `S3_BUCKET`, `S3_REGION` | Bucket name and region (`auto` for Cloudflare R2) |
| `S3_ENDPOINT` | Provider address. Leave empty for AWS S3 |
| `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | Bucket keys. Leave empty to use the server's own cloud role |
| `S3_FORCE_PATH_STYLE` | `true` for MinIO and some self-hosted buckets |
| `S3_PREFIX` | Optional folder inside the bucket |
| `STORAGE_PUBLIC_URL` | Optional public bucket or CDN address so browsers fetch originals directly |

### Optional features

| Variable(s) | Turns on |
|---|---|
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` | Online payments and automatic refunds |
| `GOOGLE_CLIENT_ID` | "Continue with Google" and linking Google to an account |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM` | Phone-number sign-in codes and text-message updates |
| `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_TEMPLATE`, `WHATSAPP_TEMPLATE_LANG` | WhatsApp order updates |
| `MEILI_URL`, `MEILI_MASTER_KEY` | Meilisearch search (key must be 24+ random characters in production) |
| `REDIS_URL` | Caching. Empty means no cache |
| `LOG_FORMAT=json` | One JSON object per log line |
| `ERROR_WEBHOOK_URL` | A message to Slack, Discord or any JSON webhook with a text field on unexpected errors (rate-limited so it cannot flood) |
| `PORT` | API port (default 4000) |

### Test-only flags (never in production)

`OTP_DEBUG_RESPONSE`, `DISABLE_RATE_LIMIT`, `OTP_RESEND_SECONDS`, `CART_REMINDER_AFTER_MINUTES` and similar are used by the automated tests. The API refuses to start in production if `OTP_DEBUG_RESPONSE` or `DISABLE_RATE_LIMIT` is set.

## Web environment variables

| Variable | Required | Meaning |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | Yes | Public address of the API |
| `NEXT_PUBLIC_SITE_URL` | Yes | Public address of the shop (links, sitemap, search-engine tags) |
| `NEXT_PUBLIC_BUSINESS_NAME`, `_LEGAL_NAME`, `_SUPPORT_EMAIL`, `_SUPPORT_PHONE`, `_BUSINESS_ADDRESS`, `_GSTIN`, `_GRIEVANCE_OFFICER`, `_GRIEVANCE_EMAIL` | No | Starting values for the policy and contact pages. Anything entered in **Admin → Brand & contact** takes over |

## What to configure in the admin area (after first login)

Do these in order on a new store. Every item is explained in the [Admin guide](../business-docs/04-admin-guide.md).

1. **Brand & contact:** store name, website address, logo, tagline, about text, email, phone, address, care hours, social links, WhatsApp button.
2. **Settings:** delivery fee and free-delivery amount, GST on/off with your GSTIN and business details, invoice prefix, return days, low-stock level and alert email, sales-report schedule.
3. **Categories:** create the shelves your products sit on.
4. **Products:** add your own products (with stock) and affiliate products (with partner link), or import a CSV.
5. **Home page:** arrange banners, categories, product rows and trust sections.
6. **Banners and coupons:** your first promotions.
7. **Users:** invite team members by having them sign up, then set their role to Staff.
