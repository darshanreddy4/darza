# 8. Go-live checklist

Tick every line before opening the store to customers. Items marked **(do not skip)** protect money or customer data.

## Infrastructure

- [ ] Both addresses open over https with a padlock (`https://www...` and `https://api...`)
- [ ] `https://<api>/health/ready` shows database `ok` and storage `ok`
- [ ] API started in production mode (`NODE_ENV=production`) — it refuses to start if a setting is unsafe, so a running API means the checks passed
- [ ] `JWT_SECRET` is a fresh random value, not an example **(do not skip)**
- [ ] `ADMIN_PASSWORD` is long and unique; the admin account was created with `npm run admin:create` **(do not skip)**
- [ ] `TRUST_PROXY` is set to the number of proxies in front of the API
- [ ] Database is **not** reachable from the internet (only from the API)
- [ ] Uploads are on a bucket, or the disk volume is included in backups
- [ ] A nightly backup runs, copies leave the server, **and one restore has been tested** **(do not skip)**
- [ ] An uptime monitor watches `/health` on both addresses and alerts you
- [ ] `ERROR_WEBHOOK_URL` is set (optional but recommended)

## Messaging and payments

- [ ] A test customer received the verification email (not in spam); SPF/DKIM are set
- [ ] Password reset email works
- [ ] If using phone codes: a real number received a code
- [ ] If using Razorpay: a **live** test payment succeeded, the order became Paid by itself, and a refund of that order worked **(do not skip)**
- [ ] Razorpay webhook points at the live API and shows deliveries as successful
- [ ] If using WhatsApp: a test order sent an update

## Store content and rules (Admin)

- [ ] **Brand & contact:** name, website address, logo, tagline, about, email, phone, address, care hours
- [ ] **Settings:** delivery fee and free-delivery amount; GST on/off with GSTIN, legal name, address and state; invoice prefix; return days; low-stock level and alert email; sales-report schedule
- [ ] Policy pages read correctly for your business: Terms, Privacy, Refund, Shipping, Affiliate disclosure **(have them reviewed by a professional)**
- [ ] Categories created, products added with correct prices, stock and images
- [ ] Affiliate products have a working partner link and the disclosure
- [ ] Home page arranged; at least one banner
- [ ] Team members have signed up and been given the **Staff** role in Admin → Users
- [ ] Nobody uses the admin account for daily order work (use Staff accounts) **(do not skip)**

## A full dress rehearsal (30 minutes)

Do this on the live site with a test customer:

1. Sign up with email, verify, log in.
2. Search for a product, add it to the wishlist, add to cart.
3. Add an address, apply a coupon, place a **cash on delivery** order. Check the confirmation email.
4. In Admin → Orders, mark it Shipped, then Delivered. Check the customer sees the status and an invoice.
5. Ask for a return as the customer; approve and refund it as admin; for cash orders record the payout with a UPI reference.
6. Place a second order and **cancel** it as the customer; check stock returned.
7. If online payments are on: place and pay an online order, then cancel it and confirm the refund in Razorpay.
8. Delete the test customer from My account → Your data (it should be refused while an order is on its way, and work after).
9. Check the invoice shows the right business details and tax treatment.
10. Open the shop on a phone.

## After launch

- [ ] Watch the logs and alerts for the first days
- [ ] Look at Admin → Analytics daily at first
- [ ] Re-run the restore test monthly
- [ ] Plan updates (see [operations](09-operations.md#updating))
