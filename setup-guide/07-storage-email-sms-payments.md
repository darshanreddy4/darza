# 7. Storage, email, SMS and payments

Each section: what it is for, what to choose, exactly what to set, and how to check it.

## Files: pictures and videos

Product pictures, banner images and videos are uploaded in the admin area. Choose where they live.

| Choice | Set | Good for | Watch out |
|---|---|---|---|
| Server disk | `STORAGE_DRIVER=local` (default) | One server, simplest | Needs backups. Lost if the disk is wiped. Does not work with more than one API instance |
| A bucket | `STORAGE_DRIVER=s3` plus `S3_*` | Any production setup, several instances, easy moves | Small monthly cost |

Customers never see the bucket directly in normal use: pictures are served by the API at `/img/<file>?w=640` (resized, cached for a year) and originals at `/uploads/<file>`. Links stored in the database contain only the file name, so you can switch storage without editing any product.

### Bucket settings by provider

Create a **private** bucket, then an access key that can read and write only that bucket.

| Provider | `S3_ENDPOINT` | `S3_REGION` | Other |
|---|---|---|---|
| Amazon S3 | leave empty | your region, e.g. `ap-south-1` | Keys, or leave keys empty and give the server a role with access to the bucket |
| Cloudflare R2 | `https://<account-id>.r2.cloudflarestorage.com` | `auto` | Create an R2 API token with object read and write |
| DigitalOcean Spaces | `https://<region>.digitaloceanspaces.com` | the region, e.g. `blr1` | |
| Backblaze B2 | `https://s3.<region>.backblazeb2.com` | the region | Use an application key |
| Wasabi | `https://s3.<region>.wasabisys.com` | the region | |
| Google Cloud Storage | `https://storage.googleapis.com` | `auto` | Create HMAC keys for a service account |
| MinIO (self-hosted) | `http://minio:9000` | `us-east-1` | `S3_FORCE_PATH_STYLE=true` |

Always set `S3_BUCKET`, and `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` (unless using a server role). Optional: `S3_PREFIX` to use a folder, and `STORAGE_PUBLIC_URL` if the bucket or a CDN is public, so browsers fetch originals directly.

### Check it

1. Restart the API and open `https://<api>/health/ready` — `"storage":"ok"`.
2. Upload a picture in Admin → Products and view it on the shop.
3. The file should now appear in the bucket.

### Moving existing pictures from disk to a bucket

Copy everything in the uploads folder into the bucket root (keep the file names, including the `.cache` folder if you like), for example with `aws s3 sync uploads/ s3://my-bucket/ --endpoint-url <endpoint>` or `rclone copy`. Then set `STORAGE_DRIVER=s3` and restart.

## Email

The store sends verification links, password resets, order and return updates, back-in-stock and cart reminders, low-stock alerts and sales reports. In production the API **refuses to start without a mail provider**.

Choose one:

### Any SMTP provider (simplest)

Works with Brevo, Mailgun, Postmark, SendGrid, Zoho, Mailjet, Gmail (with an app password) and others.

```text
MAIL_FROM="My Shop <orders@myshop.com>"
SMTP_URL=smtps://username:password@smtp.provider.com:465
```

Use `smtp://` with port 587 for providers that use STARTTLS. If the password contains special characters, URL-encode them (`@` becomes `%40`).

### Amazon SES

```text
MAIL_FROM="My Shop <orders@myshop.com>"
AWS_REGION=ap-south-1
AWS_ACCESS_KEY_ID=...        # or leave empty and use a server role
AWS_SECRET_ACCESS_KEY=...
```

Verify your sending domain in SES and ask AWS to move the account out of the sandbox.

### Make sure emails arrive

Whatever the provider, add its SPF and DKIM DNS records for your domain (the provider shows them), and use a `MAIL_FROM` address on that domain. Without them, mail lands in spam.

### Check it

Register a test customer; the verification email should arrive. If not, look at `docker compose logs api` for `Failed to send`.

## Phone codes and text messages (optional)

Enables sign-in with a mobile number, adding a number to an account, deleting an account with a code, text updates for customers without email, and refund-paid texts.

1. Create a Twilio account, buy or verify a sending number.
2. Set `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM` and restart the API.
3. The "Mobile number" option now appears on login and signup.

Without these the option is hidden in production. Numbers without a country code are treated as Indian (+91). Codes have 6 digits, last 10 minutes, allow 5 tries, 30 seconds between sends and 5 per hour per number.

## WhatsApp order updates (optional)

1. In Meta Business Manager set up the WhatsApp Cloud API and get a permanent token and the phone number id.
2. Create a message template with **four body variables** in this order: customer name, order number, update sentence, link. Wait for approval.
3. Set `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_TEMPLATE` (the template's name) and `WHATSAPP_TEMPLATE_LANG`, then restart.
4. Checkout now shows an unticked "Send my order updates on WhatsApp" box. Only customers who tick it are messaged.

## Online payments with Razorpay (optional)

Without keys, checkout offers cash on delivery only.

1. Create a Razorpay account and copy the **test** key id and secret first.
2. Set `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` and restart.
3. In Razorpay → Webhooks add `https://<api address>/payments/razorpay/webhook`, event `payment.captured`, with a secret of your choice. Put the same value in `RAZORPAY_WEBHOOK_SECRET`, restart.
4. Place a test order and pay with a Razorpay test card/UPI. The order should become **Paid** by itself.
5. When satisfied, replace the test keys with live keys.

What the shop does with Razorpay: unpaid online orders hold stock for 30 minutes and are then cancelled; a late payment on a cancelled order is refunded automatically; cancelling or refunding a paid online order in Admin (or a customer cancelling) refunds through Razorpay automatically.

## Google sign-in (optional)

1. In Google Cloud Console create an OAuth client of type **Web application**.
2. Under "Authorised JavaScript origins" add your shop address (`https://www.myshop.com`).
3. Set `GOOGLE_CLIENT_ID` on the API and restart. "Continue with Google" appears on login, signup, and in My account to link Google to an existing account.

## Searching (optional): Meilisearch

Set `MEILI_URL` and `MEILI_MASTER_KEY` (24+ random characters in production). The API indexes products at start and keeps the index current. If Meilisearch is down the shop falls back to the database search automatically. Admin → Overview shows the index status and a rebuild button.

## Error alerts (optional)

Set `ERROR_WEBHOOK_URL` to a Slack, Discord or any webhook address that accepts JSON with a `text` field. The API posts a short message when an unexpected error happens (each different error at most once per 10 minutes, and at most 10 different errors per 10 minutes), so you hear about problems before customers tell you.
