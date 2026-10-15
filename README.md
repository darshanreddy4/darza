# DMG

Hybrid storefront: DMG-owned products (cart + checkout) and affiliate products (tracked redirect to the partner marketplace).

## Structure

- `apps/api` — NestJS + Prisma + PostgreSQL (public catalog, tracked `/go/:slug` redirect, admin API, JWT auth)
- `apps/web` — Next.js storefront and `/admin` dashboard
- `e2e` — Playwright end-to-end tests
- `deploy` — one-server production setup (Docker Compose, https proxy, backup and restore scripts)
- `setup-guide` — step-by-step guide: requirements, running locally, configuration, hosting options, going live, operations
- `business-docs` — how the store works for owners, admins, staff and customers, plus an illustrated one-page infographic
- `docker-compose.yml` — local PostgreSQL, Meilisearch and Redis
- `.github/workflows/ci.yml` — CI: API tests, web lint and build, Docker image builds, end-to-end tests

Start with the [setup guide](setup-guide/README.md) to run or deploy the store, and the [business documentation](business-docs/README.md) to understand what it does.

## Hosting and services

Nothing ties the store to one provider. Pictures and videos live on the server disk or in any S3-compatible bucket (`STORAGE_DRIVER`), email goes through any SMTP provider or Amazon SES, and the API and website ship as Docker images (`apps/api/Dockerfile`, `apps/web/Dockerfile`). `/health` and `/health/ready` serve load balancers, `LOG_FORMAT=json` gives searchable logs, `ERROR_WEBHOOK_URL` sends unexpected errors to a chat or alerting webhook, and `deploy/backup.sh` and `deploy/restore.sh` back up and restore the database and uploads. Five wrong passwords lock password sign-in for 15 minutes.

## Run locally

```bash
docker compose up -d
cd apps/api && cp .env.example .env && npm i
npx prisma migrate dev && npm run db:seed
npm run dev            # http://localhost:4000

cd ../web && cp .env.example .env.local && npm i
npm run dev            # http://localhost:3000
```

Admin login uses `ADMIN_EMAIL` / `ADMIN_PASSWORD` from `apps/api/.env` (change them before any deployment). Requires Node 22+.

## Search (Meilisearch)

`docker compose up -d` also starts Meilisearch on port 7700. The API indexes published products on startup and keeps the index in sync when products or categories change. Set `MEILI_URL` and `MEILI_MASTER_KEY` in `apps/api/.env` (see `.env.example`); leave `MEILI_URL` empty to use plain database search. If Meilisearch is down the API falls back to the database automatically. Admin → Overview shows index status and a Rebuild button. Change the master key before deploying.

## Online payments (Razorpay)

Set `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` and `RAZORPAY_WEBHOOK_SECRET` in `apps/api/.env` (use test keys first). Without them checkout offers pay-on-delivery only. In the Razorpay dashboard add a webhook to `<api-url>/payments/razorpay/webhook` for the `payment.captured` event. Unpaid online orders release their stock after 30 minutes. Cancelling or refunding a paid online order in Admin sends the money back through Razorpay automatically.

## Cache (Redis)

`docker compose up -d` also starts Redis on port 6379. Set `REDIS_URL` in `apps/api/.env` (see `.env.example`) to cache the home page data, banners, categories, product lists and product pages for 30 to 60 seconds. Any change made in the admin (products, bulk edits, categories, banners, reviews) clears the cache straight away. Leave `REDIS_URL` empty to run without a cache; if Redis goes down the API keeps working, just uncached.

## Search engines

Set `NEXT_PUBLIC_SITE_URL` in `apps/web/.env.local` to the public address (for example `https://www.example.com`). It is used for canonical links, `/sitemap.xml`, `/robots.txt`, social previews and the product structured data (JSON-LD). Cart, checkout, account, order, login and admin pages are marked `noindex`.

## Home page widgets

Admin → Home page lists the widgets the home page is built from, top to bottom. Add a widget at the end or below any other, move it up or down, hide it, duplicate it or remove it, then press Save. "Reset to original" goes back to the built-in layout. Available widgets: banner slider, product collection and product slider (featured, sold by DMG, partner picks, new arrivals, best sellers, top rated, one category, or products you pick), shop by category (tiles or chips) and category slider, promo strip, image tiles, image tile slider (one row with side arrows), highlights bar, text block, questions and answers, how shopping works, spacer, and Google AdSense ad. The live page is served from `GET /home` and cached with the rest of the storefront data.

The AdSense widget takes the code from an AdSense ad unit (Ads → By ad unit → Display ads). Only the publisher ID, slot and size settings are read from it; the pasted code is never run as it is. It can be placed in the page, on the left or right edge of wide screens, or as a closable sticky bar at the bottom. `/ads.txt` is generated from the ads in use, and the privacy page and cookie notice mention Google ads while one is switched on. Ads show only on a live domain approved in AdSense; use the widget's test mode while setting up.

To add a new kind of widget: describe its settings and limits in `apps/api/src/home/widgets.ts`, draw it in `apps/web/src/components/home/Widgets.tsx` and `apps/web/src/app/(store)/page.tsx`, and add its entry and settings form in `apps/web/src/lib/home.ts` and `apps/web/src/components/admin/home/WidgetEditors.tsx`.

## Brand and contact details

Admin → Brand & contact sets the logo (with an optional white badge for dark logos), brand name, tagline, About us text, email, phone, address, customer care hours and note, a WhatsApp number (with an optional floating chat button), links for Instagram, Facebook, X, YouTube, LinkedIn, Pinterest, Telegram, Threads and Snapchat (a full link or just the @handle), and up to six other links. They appear in the header, footer, login screens, the new About us page (`/about`), the Contact page and the structured data search engines read. Values entered here win over the `NEXT_PUBLIC_*` business details in `apps/web/.env.local`, which remain the fallback. Legal name, GSTIN and grievance officer details still come from the env file.

The brand name set there is used everywhere customers read it: header, footer, page titles and descriptions, "Sold by" labels, product pages, cart and checkout, the Razorpay payment window, login screens, policies, emails (verification, password reset, order updates) and invoices. In text you type yourself (home page widgets, banners, affiliate disclosures) write `{brand}` and it is replaced with the current name, so a rename never needs editing those again. Product names and descriptions are plain catalogue text and are not changed automatically. The website address is used for links in emails, canonical links, the sitemap and structured data. When you move to a new domain, also add it to `WEB_ORIGIN` in `apps/api/.env` (comma separated) so logins and the browser's cross-origin checks keep working. Before anything is set, the name comes from `NEXT_PUBLIC_BUSINESS_NAME` (web) and `BRAND_NAME` (API), then falls back to the built-in default name, which you can change in the code (search for `"DMG"` in `apps/api/src` and `apps/web/src`).

## Sign-in options

Customers can sign up and log in with an email and password, a mobile number (one-time code by SMS) or Google. Every sign-up must accept the Terms & Conditions and Privacy Policy (the time is stored on the account), and passwords need 8+ characters with letters and numbers, must not be a common password and must not contain the email name.

- Google: create an OAuth "Web" client in Google Cloud, set `GOOGLE_CLIENT_ID` in `apps/api/.env`, and add your site address (and `http://localhost:3000` for testing) under "Authorised JavaScript origins". The button appears once the id is set. A Google account with a verified email joins an existing account with that email.
- Mobile number: set `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` and `TWILIO_FROM`. Without them the option only appears outside production, and the code is printed in the API log. Codes are 6 digits, last 10 minutes, allow 5 tries, 30 seconds between sends and 5 per hour per number. Numbers are treated as Indian (+91) unless typed with another country code.
- Mobile and Google accounts count as verified. Accounts made with a number have no email, so they get no email updates, and existing email accounts cannot add a number yet.
- `OTP_DEBUG_RESPONSE=true` (tests only, never in production) returns the code in the API response, and `OTP_RESEND_SECONDS` shortens the resend gap.

## Admin users

Admin → Users lists every account (search by name, email or number; role and verification filters), changes roles (Customer or Admin) and can sign a user out of every device. You cannot change your own role, and the last admin cannot be demoted.

## Customer extras

- **Returns:** a delivered order shows "Return or refund" in My orders for the return window set in Admin → Settings (7 days by default, 0 turns it off). The customer picks which items and how many to send back, and can make further requests for the rest. The refund is the price of those units less their share of any coupon discount, and delivery is refunded only when the last items come back. Admin → Returns approves or declines (a reason is needed to decline), then "Item received, refund" refunds through Razorpay for online orders and puts the stock back. Pay-on-delivery refunds are paid out by hand. Customers are emailed at each step.
- **Questions:** shoppers ask on the product page; the answer is written in Admin → Questions, shown publicly and emailed to the asker. Up to 3 unanswered questions per account.
- **Cart reminders:** signed-in customers with a verified email get one reminder an hour after leaving items in the cart (`CART_REMINDER_AFTER_MINUTES`, default 60), with a one-click unsubscribe and a switch in My account. Admin → Abandoned carts shows what was left behind.
- **Back in stock:** sold-out products offer "Notify me when it's back" to customers with a verified email; one email goes out when stock returns (checked every 5 minutes, `STOCK_ALERT_INTERVAL_SECONDS`). Admin → Needs attention shows how many are waiting.

- **Compare:** every product card and product page has a Compare button (up to 4 products); the Compare bar leads to a side-by-side page.
- **Personal coupons:** in Admin → Coupons a code can be tied to one customer, and/or limited to a customer's first order. Customers see the codes meant for them in My account.
- **WhatsApp order updates:** when `WHATSAPP_TOKEN` and `WHATSAPP_PHONE_NUMBER_ID` are set (Meta WhatsApp Business Cloud API, with an approved template of four variables: name, order, update, link), checkout offers an unticked "Send my order updates on WhatsApp" box. Only customers who tick it are messaged, on the phone number of that order, when it is placed, paid, shipped, delivered, cancelled or refunded. In development the message is printed in the API log.
- **Cancel an order:** in My orders a customer can cancel until the order ships (awaiting payment, placed or paid), choosing a reason. Stock goes back on the shelf, a paid online order is refunded through Razorpay (the cancellation is undone if that refund fails), and admins see the reason on the order. After delivery the customer uses a return instead.
- **Add or link sign-in methods:** My account → "Ways to sign in and get updates". An account made with a phone number can add an email address (saved only once the emailed link is opened), an email account can add and verify a mobile number with a code, and any account can link Google when Google sign-in is configured. A number or address that belongs to another account is refused.
- **Password for phone and Google accounts:** accounts made with a phone number or Google have no password until they set one (My account → Set a password, needs an email address on the account). Changing a password needs the current one; setting a first one does not.
- **Order updates for phone-only accounts:** with no email address and no WhatsApp tick on the order, the update (placed, paid, shipped, delivered, cancelled, refunded) is sent by text message instead, using the same Twilio settings as sign-in. Refund payouts are texted too.
- **Download or delete my data:** My account → Your data. Download is a JSON file with the profile, addresses, orders, returns, reviews, questions, wishlist and alerts (never password hashes or tokens). Deleting needs the word DELETE plus proof of identity (password, a code texted to the account's phone, or Google). It removes the profile, addresses, wishlist, reviews, questions and saved cart, frees the email and number, and signs out every device. Orders and invoices are kept for tax records under the name "Deleted customer". It is refused while an order is on its way, a return is open or a refund is still owed, and for staff and admin accounts.
- **Cash on delivery refunds:** a customer returning a pay-on-delivery order gives a UPI ID. When an admin refunds the return it appears in Admin → Returns → "Payouts due" with the amount and UPI ID; after sending the money the admin records the UPI transaction reference with "Mark as paid" (admins only, once), and the customer is told by email or text. The money is still sent by hand, but nothing is forgotten or paid twice.

## Admin extras

- **Product import/export:** Admin → Products → Export CSV downloads every product; edit it in a spreadsheet and Import CSV it back. Rows are matched by slug (new slugs are created), a blank cell leaves the current value, prices are in rupees, the category is its slug, and nothing is saved if any row has a problem.
- **Inventory alerts:** Settings → Inventory alerts sets the low stock level and an email address. One email lists products that newly drop to that level (checked hourly, `INVENTORY_ALERT_INTERVAL_SECONDS`).
- **Sales report:** Analytics → Download sales report gives every order in the chosen dates as a CSV with discount, delivery, CGST/SGST/IGST and refunds, plus a totals row for orders that count as sales.

- **Staff role:** in Admin → Users, set a person to Staff. Staff see a smaller console: they work orders (not cancel or refund them), approve or decline returns (not refund them), answer customer questions and look up products without costs. Settings, users, coupons, analytics, imports and the audit log stay with admins, and the API enforces this, not just the menus.
- **Audit log:** Admin → Audit log lists every change made in the admin area (who, when, what, with the details sent, minus passwords and long text), and changes someone tried without permission. Entries are kept until you remove them from the database.
- **Sales report by email:** Settings → Sales report by email sends last week's (Mondays) or last month's (the 1st) summary with the full order list as a CSV attachment. Switching it on starts counting from that moment; "Send the last report now" tries it.
- **Image resizing:** pictures uploaded in the admin are served in several sizes (`/img/<file>?w=640`, WebP, made on first request and cached for a year), and cards, galleries, banners and tiles pick the smallest sharp copy for the screen. Remote (https) image links are used as they are, so upload pictures instead of linking large ones.

## Quality checks

`e2e/tests/accessibility.spec.ts` scans the main storefront, account and admin pages with axe (WCAG 2.1 A and AA) at desktop and phone widths, and `mobile.spec.ts` checks for sideways scrolling and small tap targets at 360px. Both run with the rest of the suite.

With the API and web running from a production build (`npm run start`) against the throwaway e2e database, `npm run lighthouse` (needs Chrome) scores five key pages on mobile and desktop and fails below 80 performance, 95 accessibility and 90 best practices. `npm run load` (start the API with `DISABLE_RATE_LIMIT=true`) hammers the main endpoints and pages with 50 connections and also checks that 40 buyers racing for 5 units never oversell. Last run: the API answered 2,600 to 6,200 requests a second with p99 under 60 ms, the web pages about 220 to 290 requests a second with p99 under 600 ms, and Lighthouse scored 100 for accessibility and best practices everywhere. Product pages are slowest on a throttled phone (84 performance) because of large remote product images; resize images before uploading.

## Security review

Checked before launch: every route was called without logging in (all admin and account routes answer 401; the public ones are the storefront, sign-in and webhooks), admin and staff actions are enforced on the server, sessions are httpOnly SameSite cookies with an origin check on changes, passwords are bcrypt hashed, reset and OTP codes are stored hashed with attempt limits, uploads are checked by content and renamed, spreadsheet exports neutralise formulas, emails and JSON-LD are escaped, and the production start refuses development settings. Added in this pass: security headers on the storefront (no framing, no sniffing, referrer policy, HSTS in production), `TRUST_PROXY` so rate limits see real visitor addresses behind a load balancer, safer Referer handling, and audit entries for blocked attempts. `e2e/tests/security.spec.ts` keeps these checks running.

Still yours to do at launch: set `TRUST_PROXY`, serve everything over https, and consider a full Content-Security-Policy after testing it with your Google sign-in, Razorpay and AdSense setup (only the directives that cannot break them are set now). `npm audit` reports one issue in the Prisma command-line tool's config merging (`deepmerge-ts`), which only runs at build and migrate time on your own files; update Prisma when a fix is released. Login limits are per visitor address, and each account also locks for 15 minutes after five wrong passwords; still consider a web application firewall in front for credential-stuffing protection.

## Tests

```bash
# API unit tests and types
cd apps/api && npm test && npx tsc --noEmit

# End-to-end tests (own API on 4100, web on 3100, throwaway database)
docker exec ecommerswebsite-db-1 psql -U dmg -d postgres -c "CREATE DATABASE dmg_e2e"
export DATABASE_URL=postgresql://dmg:dmg@localhost:5432/dmg_e2e
(cd apps/api && npx prisma migrate deploy && npm run db:seed:e2e && npm run build)
(cd apps/web && NEXT_PUBLIC_API_URL=http://localhost:4100 NEXT_PUBLIC_SITE_URL=http://localhost:3100 npm run build)
cd e2e && npm install && npx playwright install chromium
E2E_DATABASE_URL=$DATABASE_URL E2E_REDIS_URL=redis://localhost:6379/1 npx playwright test
```

Run `npm run db:seed:e2e` again before a second run, so stock and prices start from the same place. CI does all of this on every push and pull request.

## Before launch

Fill the `NEXT_PUBLIC_*` business details in `apps/web/.env.local` and have the Terms, Privacy, Shipping and Refund pages reviewed by a qualified lawyer. The pages describe how the store works today (delivery fees, coupons, emails through Amazon SES, Razorpay refunds, GST invoices, cookies); update them whenever those change.

## Not built yet

Automatic cash-on-delivery payouts (they are sent by hand and recorded), courier integrations and shipping labels, product variants (size, colour) and multiple warehouses.
