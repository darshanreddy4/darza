# 08 Scenarios: real situations, step by step

Use these to train new staff, answer customers, or check that the service behaves the way you expect. Each scenario says who does what and what the system does by itself.

---

## 1. A cash-on-delivery order from start to finish

1. **Customer** adds two items to the cart, signs in with a mobile number (counts as verified), picks a saved address, chooses **Cash on delivery**, and places the order.
2. **System** reduces stock at once, sends "order received" (email, or text message because the account has no email), and shows the order as **Order placed**.
3. **Staff** opens Orders, filters to Placed, packs the parcel and sets **Shipped**. The customer is told.
4. **Courier** delivers and collects the cash. **Staff** sets **Delivered**.
5. **System** makes the **invoice** available to the customer and starts the **return window** (default 7 days).

---

## 2. An online order paid with a card

1. **Customer** chooses **Online** and pays in the Razorpay window.
2. **System** receives the payment confirmation, moves the order to **Paid**, and sends "payment received". The customer can also reach the order through **My orders**.
3. Shipping and delivery are the same as scenario 1.

**If the customer closes the payment window:** the order stays **Awaiting payment** and holds the stock. A **Pay now** button on My orders lets them finish. After **30 minutes** the system cancels the order and puts the stock back.

**If they pay after the 30 minutes:** the system notices the payment on a cancelled order and **refunds it automatically**.

---

## 3. A customer changes their mind before shipping

1. **Customer** opens My orders, presses **Cancel order**, picks a reason ("Ordered by mistake") and confirms.
2. **System** cancels the order, puts the stock back, and:
   - for a **paid online order**, starts a refund to the original payment method (banks take 5 to 7 business days) and tells the customer;
   - for a **cash order**, there is nothing to refund.
3. **Admin** sees the reason on the order.

If the refund cannot be started (for example the payment service is down), the cancellation is **undone** and the customer sees an error, so the order never ends up cancelled without a refund.

Once the order is **Shipped**, the Cancel button disappears. The customer waits for delivery and uses a return.

---

## 4. A return and refund on a cash order

1. **Customer** opens the delivered order inside the return window, presses **Return or refund**, ticks the items, picks a reason, and types their **UPI ID** (required for cash orders).
2. **Staff** opens Returns, reads the request and presses **Approve return** (or **Decline** with a reason the customer will read).
3. The item reaches the warehouse. **Admin** presses **Item received, refund**. The system puts the item back in stock and records the refund amount.
4. The request now appears under **Payouts due** with the amount and the UPI ID.
5. **Admin** sends the money from the bank or UPI app, then types the **UPI transaction reference** and presses **Mark as paid**.
6. **System** tells the customer ("We've paid ₹X to your UPI ID, reference ..."). On My orders the customer sees "Paid to ... on ...". Marking it paid twice is not possible.

---

## 5. A partial return with a coupon

An order: two items, ₹800 and ₹200, with a ₹100 coupon and ₹50 delivery. Total paid ₹950.

1. Customer returns only the ₹200 item. Its share of the coupon is ₹100 × 200 / 1,000 = ₹20. **Refund: ₹180.** Delivery is not refunded yet. The order stays **Delivered**.
2. Later the customer returns the ₹800 item (their share of the coupon is ₹80). The refund is **whatever is still owed**: ₹950 − ₹180 = **₹770**, including delivery. The order becomes **Refunded**.

The admin sees "refund would be ₹..." on every request before confirming, and the confirmation box repeats the amount.

---

## 6. A product sells out, then comes back

1. The last unit is bought. Stock is now 0 and the product page shows **Sold out**; it cannot be added to a cart.
2. A customer presses **Notify me when available** (needs an account).
3. When stock was low, the **owner already got a low-stock email** (once per product per dip).
4. **Admin** edits the product and enters the new stock.
5. **System** emails every waiting customer once and clears the wait. The low-stock alert re-arms.

Two customers racing for the last unit: the system reserves stock when the order is created, so only one succeeds and the other is told it is no longer available.

---

## 7. Someone signed up with a phone number and wants emails

1. **Customer** opens My account → **Ways to sign in and get updates** and presses **Add email address**.
2. They type the address; a confirmation link is emailed. The address is **only saved when the link is opened**, so nobody can attach someone else's email.
3. From then on they receive emails. (Until then, updates came by text message.)
4. In My account they can also **Set a password** so they can sign in with email and password, and **link Google**.

The reverse works too: an email account can **add and verify a mobile number** with a code, which also makes the account verified.

---

## 8. Forgot password, and a locked account

1. A person types a wrong password five times. **Password sign-in locks for 15 minutes** and says so.
2. They press **Forgot password**, receive a link (valid 1 hour, works once), and set a new password. This **lifts the lock** and **signs them out of every other device**.
3. Phone and Google sign-in are not affected by the lock.

For an admin helping a customer: there is nothing to unlock by hand; the customer resets their password or waits.

---

## 9. A customer asks to delete their account

1. **Customer** opens My account → Your data. They can first **download a copy** (a JSON file).
2. They press **Delete my account**, choose how to prove it is them (password, a code by text, or Google), and type **DELETE**.
3. **If an order is still on its way, a return is open, or a cash refund is still owed**, the system refuses and says which. They try again after those finish (or after cancelling the order).
4. **If everything is settled**, the system removes the profile, addresses, wishlist, reviews, questions and saved cart, frees the email and number, and signs them out everywhere.
5. **Orders and invoices stay** under the name "Deleted customer", because tax records must be kept. The person no longer appears in the admin customer list.

Staff and admin accounts cannot delete themselves; another admin changes the role first.

---

## 10. Staff tries something only an admin may do

1. **Staff** opens an order and tries to set it to **Cancelled**.
2. **System** refuses ("Only an admin can ..."). Staff menus do not even show settings, coupons, users or reports.
3. The attempt is written to the **audit log** as a blocked action with the person's name.

The same applies to refunding a return, marking a payout paid, editing products, and seeing cost prices. See [Roles and permissions](03-roles-and-permissions.md).

---

## 11. Launching a sale

1. **Admin** creates a coupon (Admin → Coupons): for example 10% off, maximum ₹200 off, minimum order ₹999, valid for a week, one use per customer.
2. Adds a **banner** (Admin → Banners) with a start and end time and a link to the products, and optionally a countdown.
3. Adds a **product collection** block on the home page (Admin → Home page), for example "Sale picks", with hand-picked products, and presses Save.
4. Customers see the banner and block immediately; shoppers enter the code in the cart.
5. After the sale, the coupon's **usage figures** show how often it was used. Cancelled and refunded orders give their coupon use back.

**A code just for one person:** create the coupon, choose the customer, and it is limited to one use and listed in that customer's My account.

---

## 12. Adding a partner (affiliate) product

1. **Admin** creates a product, chooses type **Affiliate**, fills in the platform name (for example Amazon), the partner link and the disclosure text, and publishes.
2. Shoppers see it in search and lists. The page shows **Buy on <platform>** instead of Add to cart.
3. Each click is recorded (the visitor's address is stored only as a one-way fingerprint) and the visitor is sent to the partner.
4. **Admin → Affiliate clicks** ranks products by clicks over the last 30 days (or up to a year) so you can see what earns.

---

## 13. A customer asks a question about a product

1. A **verified customer** types a question on the product page (up to 3 unanswered at a time).
2. It is **not public yet**. **Staff or admin** sees it under Questions, types an answer, and saves.
3. The answer now shows on the product page and the **customer is emailed**.
4. Spam or inappropriate questions are deleted from the same screen.

---

## 14. Checking how the business is doing

1. **Admin → Overview** shows products, clicks, revenue and profit for the last 30 days, top affiliate products, and things needing attention.
2. **Admin → Analytics** breaks revenue, units, profit, payment mix and best sellers down by day, week, month or year, and downloads a spreadsheet for your accountant.
3. **Admin → Settings → Sales report** can email that report every Monday or on the 1st of the month.
4. **Admin → Audit log** answers "who changed this price?" with the person's name and time.

---

## 15. Bringing in many products at once

1. **Admin → Products → Import** accepts a spreadsheet (CSV). A **dry run** shows what would change and any errors before anything is saved.
2. **Export** downloads the whole catalogue, handy for editing in bulk or keeping a copy. Cells that could run formulas are neutralised so the file is safe to open.
3. **Bulk edit** changes up to 500 selected products at once: publish or hide them, feature them, set a deal label, set a price or raise or cut prices by a percentage, and adjust the original (MRP) price. A **preview** shows the result before saving.
