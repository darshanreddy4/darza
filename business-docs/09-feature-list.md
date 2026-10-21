# 09 Feature list: everything the service includes

A checklist you can use to show a client what they are getting, or to check nothing is missing. Each item points to the document that explains it.

## For shoppers

### Finding products
- [x] Home page built from blocks the owner arranges ([admin guide](04-admin-guide.md))
- [x] Product list with filters (category, sold by the store or partner deals, featured, price) and sorting
- [x] Search box with live suggestions (picture, price, category), typo-tolerant when Meilisearch is on, automatic fallback to database search
- [x] Category pages, including nested categories
- [x] Product page with picture gallery, videos, highlights, specifications, delivery and return information, stock status
- [x] Ratings and reviews with a "Verified purchase" badge
- [x] Questions and answers on each product
- [x] Compare up to 4 products side by side (no account needed)
- [x] Wishlist that follows the customer to any device
- [x] "Notify me" when a sold-out product returns

### Buying
- [x] Cart that works without an account and survives closing the tab
- [x] Coupon codes with live discount, including personal codes shown in My account
- [x] Delivery fee shown live (flat, free above an amount, always free or never free)
- [x] Delivery rules: heavy products always charged, area fees by PIN code, free delivery on everything for big orders
- [x] Rewards progress line in the cart and checkout with a celebration when a reward is unlocked: free delivery, free gifts or surprises, and percentage-off rewards
- [x] Delete icon beside each cart item
- [x] Coupons the shopper can use are listed in the cart and checkout, and shown on the progress bar at the amount that unlocks them; the admin chooses whether a code is shown
- [x] Saved addresses with a default; state list, pincode and phone checks
- [x] Pay on delivery, with an optional fee and a largest order size (or switched off)
- [x] Products that must be paid for online only (no pay on delivery), chosen per product
- [x] Part payment: a share online when ordering (for example 30 to 40 percent) and the rest on delivery, switched on in Settings and chosen per product
- [x] Pay online by card, UPI or net banking (Razorpay)
- [x] "Pay now" to finish an unpaid online order within 30 minutes
- [x] Optional WhatsApp updates tick box
- [x] Stock reserved the moment an order is placed; no overselling
- [x] Partner (affiliate) products with a disclosure and a tracked "Buy on ..." link

### After buying
- [x] Order tracker with seven statuses
- [x] Tax invoice or bill of supply with a running number
- [x] Cancel before shipping, with a reason; automatic refund for paid online orders
- [x] Return after delivery inside the return window, for part or all of an order
- [x] Refund to the original payment method (online) or to a UPI ID with a payout record (cash)
- [x] Status messages by email, text message and WhatsApp
- [x] Reviews and questions after the purchase

### Account
- [x] Sign up and log in with email and password, mobile number and code, or Google
- [x] Add the missing methods later (email, mobile, Google); set or change a password
- [x] Email verification, forgot and reset password
- [x] Saved addresses, personal coupons, email preferences
- [x] Download all personal data; delete the account (with safeguards)
- [x] Login lockout after five wrong passwords (15 minutes)

### Trust and information pages
- [x] About, Contact, Terms, Privacy, Refund policy, Shipping policy, Affiliate disclosure
- [x] One-click unsubscribe from cart reminders

## For the team

- [x] **Guest checkout** (switch in Settings): shoppers order with just a name and a verified mobile number; they pay online in full, or pay the delivery charge now and the rest on delivery; guest orders are badged for the team and carry the cash to collect on the label
- [x] **Order progress bar** on My orders (placed, preparing, shipped with date and courier, delivered), which an admin can switch off in Settings
- [x] **Weight and per-option SKU** (switch in Settings): every option can have its own SKU and weight, products a weight; SKUs are unique across products and options; packing slips and labels print the option's SKU and the parcel weight as bought
- [x] **Option-level low stock alerts** (switch in Settings): one option running low is flagged on the Attention list and in the low stock email even when the product total is fine
- [x] **Warehouses and stock history:** one main warehouse from the start, more can be added; receive stock into a warehouse, correct a count (with a reason) and move stock between warehouses; every change to stock (sales, cancellations, returns, deliveries, corrections, moves, product edits, CSV imports) is written down with who, when, which order and the units left ([admin guide](04-admin-guide.md))
- [x] **Role-based access:** an admin makes team roles (customer care, finance, product reviewer, catalogue manager, marketing, warehouse and more, from ready-made templates) with 22 permissions, and gives each team member a role; menus, screens and the server all follow the role ([roles](03-roles-and-permissions.md))
- [x] Team & roles screen (admin only): create, edit and delete roles, see who holds each, move or remove members
- [x] Cost prices, customer data, money actions, settings and reports each have their own permission; costs are never wiped by someone who cannot see them
- [x] Reviews screen for moderating every customer review
- [x] Staff made before roles existed keep the original staff access ([staff guide](05-staff-guide.md))
- [x] Tick orders to print **shipping labels** (address, big PIN code, cash to collect or "prepaid", sender) and **packing slips** (items with tick boxes, SKU, gifts to pack), and to **mark many orders shipped at once** with one courier, each parcel's tracking number (typed or pasted from the courier's list) and a tracking link; orders that are not ready are skipped with the reason
- [x] Move orders to Paid, Shipped, Delivered, with the courier, tracking number and tracking link typed when shipping; customers see them in My orders and in the shipped message
- [x] Approve or decline returns with a written reason
- [x] Answer or delete product questions
- [x] See stock and prices without cost prices
- [x] Server-enforced limits: no cancelling, refunds, payouts, settings, users, reports

## For admins and owners

### Catalogue
- [x] Products: create, edit, delete; own or affiliate; draft or published; pictures, videos, highlights, specifications, price and original price, deal label, delivery and return text, tax rate, stock and low-stock level, cost price
- [x] Bulk edit up to 500 products with a preview
- [x] Options and prices: one product in several versions, with choices the admin names (size, colour, wattage, battery...), up to two at once, each combination with its own price, MRP, stock, cost and picture; customers choose like on Amazon or Flipkart and pay that option's price
- [x] Spreadsheet import with a dry run, and full export, including HSN codes and options (and, when used, option SKUs and weights)
- [x] Categories with parents and children

### Selling and marketing
- [x] Coupons: percentage or flat, minimum order, maximum discount, dates, total and per-customer limits, first-order only, private codes for one or many customers, one use per person across accounts (email and mobile number), usage list, race-safe last use
- [x] Banners and sliders with schedule, countdown, video, position, impressions and clicks
- [x] Home page designer: 18 block types (including icon grids, brand promo cards, wide spotlight banners and offer cards with deal strips and festive panels), drag order, show or hide, reset to default
- [x] Google AdSense slot (optional)

### Orders and money
- [x] All orders with filters and details, including cost, coupon, payment and WhatsApp choice
- [x] Cancel and refund (stock returns, online refunds automatic)
- [x] Returns: approve, decline, refund, and cash payouts with "Payouts due" and "Mark as paid"
- [x] Tax: GST on or off with GSTIN and details; invoice numbering with prefix
- [x] Delivery fee and free-delivery threshold; return window in days

### Understanding the business
- [x] Overview dashboard, analytics by day, week, month, year, accounting spreadsheet with tax split
- [x] Affiliate click report
- [x] Weekly or monthly sales report by email
- [x] Abandoned carts list with automatic reminders
- [x] Waiting stock alerts, low-stock alert emails, "Attention" list
- [x] Audit log of every admin and team change, including blocked attempts and role changes

### People and branding
- [x] Users: search, filter, export, change roles (customer, team roles, admin), sign a person out everywhere
- [x] Logo designer: picture logo with 3D, shadow or glow effects and one-click transparent background, or a text logo with 14 fonts, a colour for every letter, gradients and 3D, outline or glow effects
- [x] Pages & policies: edit or hide the terms, privacy, shipping, refund and affiliate pages, add pages of your own with a live preview, and change the message bar and footer note
- [x] Legal and grievance details (registered name, GSTIN, grievance officer) set in the admin portal
- [x] Brand name, logo, tagline, about text, contact details, WhatsApp button, social links; shown across the site, emails and invoices
- [x] Store look chosen by the admin: default, minimalism, maximalism, glassmorphism, neumorphism, flat, material or editorial design
- [x] Header, search bar, category bar and footer colours chosen by the admin, with background pictures for the header and footer, automatic readable text and a contrast warning
- [x] Price currency switcher for shoppers: admin chooses which currencies are offered, live rates refresh automatically, admin can set own rates; display only, charged in rupees
- [x] Search index status and rebuild

## For the technical team

- [x] Runs on any server or cloud; Docker images for the API and the website ([setup guide](../setup-guide/README.md))
- [x] Pictures and videos on server disk or any S3-compatible bucket
- [x] Email through any SMTP provider or Amazon SES
- [x] One-server production setup with automatic https, backup and restore scripts
- [x] Health checks for load balancers (`/health`, `/health/ready`), graceful shutdown, JSON logs, error alerts to a webhook
- [x] Optional Redis cache and Meilisearch search; both can fail without taking the shop down
- [x] Security: server-enforced roles, secure cookies, rate limits, upload checks by content, hashed codes and tokens, production start refuses unsafe settings
- [x] SEO: titles, descriptions, canonical addresses, sitemap, robots file, product structured data
- [x] Accessibility checks and speed checks in the test suite
- [x] 363 unit tests and 536 browser tests run on every change

## Not included (be honest with clients)

- Automatic cash refunds: cash-on-delivery refunds are sent by the admin by hand, then recorded in the system.
- Courier integrations: the courier, tracking number and link are typed by hand when an order is shipped; nothing is booked with a courier automatically (labels and slips are printed by the store, see above).
- Per-warehouse reservation of stock for a particular region or sales channel, colour as part of a size's stock line, and multi-currency.
- A mobile app: the website is mobile friendly and works in any browser.
