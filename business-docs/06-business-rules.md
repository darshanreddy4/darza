# 06 Business rules and numbers

Every rule the system applies, with its exact value. Values marked **setting** can be changed by an admin; everything else is built in.

## Products and stock

| Rule | Value |
|---|---|
| Product types | **Own** (sold and shipped by you, has stock) and **Affiliate** (partner link, no cart) |
| Product status | **Draft** (hidden from the shop) or **Published** |
| Stock is reduced | The moment an order is placed (cash on delivery or online), so the last unit can never be sold twice |
| Stock comes back | When an order is cancelled or refunded, when an unpaid online order times out, and for each unit returned |
| Sold-out products | Cannot be added to a cart; shoppers can ask to be emailed when back |
| Low-stock level | **Setting**, default 5 units. One email per product per dip, to the alert address; it re-arms when stock recovers |
| Largest quantity of one item per order | 99 |
| Compare | Up to 4 products |
| Pictures | JPG, PNG, WebP or GIF, up to 5 MB. The shop serves resized WebP copies (160 to 1600 px wide) cached for a year |
| Videos | MP4 or WebM, up to 50 MB and 60 seconds, for banners and products |

## Prices, delivery and tax

| Rule | Value |
|---|---|
| Money | Stored in paise, shown in rupees |
| Delivery fee | **Setting**, default ₹49 |
| Free delivery | **Setting**: free from an order amount (default ₹499), always free (fee 0) or never free (empty) |
| Coupon and delivery | A coupon reduces the goods total; the delivery fee is added after. Free-delivery and gift amounts are measured on the cart value **before** the coupon, so a coupon never removes free delivery |
| Heavy or bulky products | A product set to always charge delivery pays its own fee (or the store fee) once per order; its money counts towards the free-delivery amount of the regular items, but its own charge stays until the free-everything amount |
| Free delivery on everything | **Setting** (optional): when the whole basket reaches this amount, every delivery charge is waived |
| Delivery by area | **Setting**: PIN code starts with their own fee and optional free-over amount |
| Rewards | **Setting**: free gifts and percentage-off rewards for baskets reaching an amount. A gift is recorded on the order when it is placed. A percentage off (best one reached, optional maximum) is taken before any coupon and kept on the order apart from the coupon discount, so coupon figures stay true |
| GST | **Setting** on or off, with GSTIN, business name, address, state and a rate on delivery (default 18%). The regime in force when the order was placed is saved on that order, so later changes do not alter old invoices |
| Invoice | Tax invoice when GST is on, bill of supply when off. Numbered `PREFIX/FINANCIAL-YEAR/SERIAL` (for example `DZ/2026-27/00001`). Prefix is a **setting** |

## Orders and payment

| Rule | Value |
|---|---|
| Statuses | Awaiting payment → Placed (cash) or Paid (online) → Shipped → Delivered; or Cancelled; or Refunded |
| Who may place an order | Verified customers |
| Payment methods | Cash on delivery; online through Razorpay (only when keys are set) |
| Unpaid online order | Holds stock for **30 minutes**, then is cancelled and stock released. A late payment on a cancelled order is refunded automatically |
| Customer may cancel | While awaiting payment, placed or paid (not once shipped) |
| Admin may cancel/refund | Any time before the order is already cancelled or refunded; staff cannot |
| Cancel/refund of a paid online order | Refunded in full (minus anything already returned) to the original payment method, automatically |
| Coupon use | Cancelled and refunded orders give the coupon use back |

## Coupons

| Rule | Value |
|---|---|
| Types | Percentage (1 to 100, optional maximum discount) or flat rupee amount |
| Limits | Minimum order, valid-from and valid-until, total uses, uses per customer |
| First order only | Only for customers with no earlier order that was not cancelled or refunded |
| Private code | Tied to one or more chosen customers (by email or mobile number); only they can use it; one use each unless the admin sets another limit; shown in their My account; guests are asked to log in |
| Same person, second account | Uses are counted across the account, the email address (lower case, no +tag, no dots for Gmail) and the mobile number (last 10 digits, including the delivery number on the order), so a second account does not get a second use |
| Last use | When two orders try to take the last use of a code at once, only one succeeds; the other is told the code has reached its limit |
| Order holds the use | An order awaiting payment holds the use for up to 30 minutes; cancelled and refunded orders give it back |
| Used codes | Cannot be deleted; switch them off |
| Offers in the cart | A shown, live code is listed to a shopper when it is meant for them, is not used up and they have not used it (account, email, mobile number); a first-order code only before their first order. If the minimum order is not reached it is listed as locked and placed on the progress bar at that amount |
| Codes | Not case sensitive; extra spaces ignored |

## Returns and refunds

| Rule | Value |
|---|---|
| Window | **Setting**, default 7 days after delivery; 0 turns returns off |
| Who can request | Verified customers, for delivered orders inside the window |
| Parts of an order | Allowed. Several requests allowed until every unit has been returned |
| Steps | Requested → Approved (or Declined with a reason) → Refunded |
| Who decides | Staff or admin approve and decline; **only an admin refunds** |
| Refund for part of an order | Price of the returned units minus their share of the coupon discount (shared out by value). Delivery is not refunded |
| Refund when the last units come back | Everything still owed, including delivery |
| Online order | Refunded to the original payment method automatically |
| Cash order | Customer supplies a **UPI ID** (required). After refunding, the return appears under **Payouts due**; an admin sends the money and records the **UPI transaction reference** with **Mark as paid** (once). The customer is notified |
| Stock | Returned units go back on the shelf |

Worked example: an order of two items, ₹800 + ₹200 = ₹1,000, with a ₹100 coupon and ₹50 delivery (total ₹950). The customer returns the ₹200 item. Its share of the discount is ₹100 × 200 ÷ 1,000 = ₹20, so the refund is ₹180 and delivery is kept. When the ₹800 item is returned later, the refund is the rest of what was paid: ₹950 − ₹180 = ₹770, and the order becomes Refunded.

## Sign-in and accounts

| Rule | Value |
|---|---|
| Sign-in methods | Email and password; mobile number and code; Google |
| Password | 8 to 128 characters, letters and numbers, not a common password, not repeated characters, must not contain the email name or the person's name |
| Wrong passwords | 5 in a row lock password sign-in for **15 minutes**; a password reset or a correct sign-in clears the count |
| One-time code | 6 digits, valid 10 minutes, 5 tries, 30 seconds between sends, 5 per hour per number |
| Email links | Verification and adding an email: 24 hours. Password reset: 1 hour. Each works once. Only a fingerprint of the link is stored |
| Verified | An email or a mobile number has been confirmed |
| Password change or reset | Signs the person out on every other device |
| Accounts made with phone or Google | No password until they set one (needs an email on the account) |
| Account deletion | Needs DELETE plus proof (password, code, or Google). Blocked while an order is on its way, a return is open, or a refund is owed, and for staff and admins. Orders and invoices are kept as "Deleted customer" |
| Data download | JSON file of the customer's own data; never password hashes |

## Reviews and questions

| Rule | Value |
|---|---|
| Who | Verified customers |
| Review | 1 to 5 stars, optional title, text. One per customer per product; a new one replaces the old |
| Verified-purchase badge | Shown when the reviewer has a paid, shipped or delivered order containing the product |
| Questions | Up to 3 unanswered at a time per customer; shown publicly only after an answer; the asker is emailed |

## Messages that run by themselves

| Message | Rule |
|---|---|
| Cart reminder | One email per left-behind cart, about an hour after the customer left, only to signed-in customers who have not opted out |
| Back in stock | One email to each customer waiting, then the wait is cleared |
| Low stock | One email per product per dip |
| Sales report | Off, weekly (Mondays) or monthly (1st) to the chosen address, as a CSV |

## Limits that protect the service

| Area | Limit |
|---|---|
| Everyone | 120 requests per minute per visitor (stricter on sign-in actions) |
| Sign-in actions | Sign-up, login and similar: 10 per minute; codes 20 sends and 30 checks per hour |
| Password reset emails | 5 per hour |
| Return requests | 20 per hour |
| Account data download and delete | 10 per hour each |
| Uploads | Checked by their real content, not their file name; images 5 MB, videos 50 MB |
| Sessions | Secure cookies only the site can read; origin checks on every change |

## Search, speed and visibility

| Topic | Behaviour |
|---|---|
| Search | Fast typo-tolerant search when Meilisearch is on, otherwise database search; the shop switches automatically if search is down |
| Speed | Home page, banners, categories and product lists are cached when Redis is on; admin changes refresh them |
| Search engines | Page titles and descriptions, canonical addresses, sitemap, robots file and product structured data; private pages (cart, checkout, account, orders, admin) are hidden from search engines |
| Accessibility | Key pages are checked automatically for accessibility problems at desktop and phone widths |
