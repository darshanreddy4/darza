# 07 Notifications: who is told what, and how

The service sends messages on three channels. Email is the main one; text message (SMS) and WhatsApp are optional extras that switch on when the owner connects the provider.

| Channel | Needs | Used for |
|---|---|---|
| **Email** | An email provider (any SMTP service or Amazon SES) | All account and order messages, alerts to the owner, reports |
| **Text message (SMS)** | Twilio | Sign-in codes; order updates for customers who have no email; refund payout notice |
| **WhatsApp** | Meta WhatsApp Business account and an approved template | Order updates for customers who tick the box at checkout |

If a channel is not connected, the option is hidden from customers in production. During development the messages are printed in the API log instead, so you can test everything without sending anything.

A message failing never blocks the action. If an email cannot be sent, the order, return or sign-up still goes through; the problem is written to the log.

## Order updates

Sent when the order reaches the status. The same wording is used on every channel.

| Event | Customer is told | Email | WhatsApp (if ticked) | SMS (no email, no WhatsApp tick) |
|---|---|---|---|---|
| Cash order placed | "We've received your order. You'll pay when it's delivered" | ✅ | ✅ | ✅ |
| Online payment received | "Your payment went through and your order is confirmed" | ✅ | ✅ | ✅ |
| Shipped | "Your order has been shipped and is on its way" | ✅ | ✅ | ✅ |
| Delivered | "Your order has been delivered. A review helps other shoppers" | ✅ | ✅ | ✅ |
| Cancelled (by customer or admin) | Says if a refund was started and that banks take 5 to 7 business days | ✅ | ✅ | ✅ |
| Refunded | Amount refunded, to the original payment method or "marked as refunded" for cash | ✅ | ✅ | ✅ |
| Online order created, not yet paid | Nothing yet (the "Pay now" button is on My orders) | ❌ | ❌ | ❌ |

Rules for who gets which channel:

- If the customer has an **email address**, they get the email.
- If they ticked the **WhatsApp** box at checkout, they also get WhatsApp, on the phone number given for that order.
- If they have **no email** and did **not** tick WhatsApp but have a mobile number, they get a **text message**, so a phone-only account never goes silent.

Order emails include the items, subtotal, discount, delivery, total and a link to My orders.

## Return and refund updates

| Event | Customer is told | Channels |
|---|---|---|
| Return requested | "We've received your return request and will review it" | Email |
| Return approved | "Approved; we'll be in touch about collecting the item, your refund follows" | Email |
| Return declined | "We weren't able to approve it", with the admin's written reason | Email |
| Refunded, online order | Amount refunded to the original payment method (5 to 7 business days) | Email (and the order messages above when the last item closes the order) |
| Refunded, cash order | "We'll pay your refund of ₹X to your UPI ID (masked) and let you know when it's sent" | Email |
| Cash refund paid out | "We've paid ₹X to your UPI ID (masked), reference ..." | Email; **text message** for phone-only accounts |

UPI IDs are shown masked in messages (for example `as***@okbank`).

## Account messages

| Event | Message | Valid for |
|---|---|---|
| Sign up with email | Verification link | 24 hours, once |
| "Send me a verification email" in My account | New verification link | 24 hours, once |
| Add an email to a phone account | Confirmation link to the new address; the address is only saved when it is clicked | 24 hours, once |
| Forgot password | Reset link | 1 hour, once |
| Phone sign-in, adding a phone, deleting the account | Text message with a 6-digit code | 10 minutes, 5 tries |

Reset links are limited to 5 per hour per visitor. The same answer is shown whether or not an address has an account, so nobody can use the form to find out who is registered.

## Messages to customers that run by themselves

| Message | When | Who | Stops when |
|---|---|---|---|
| **Cart reminder** | About an hour after a signed-in customer leaves items in the cart without buying | Signed-in customers with an email who have not opted out | One per left-behind cart; the customer can switch them off in My account or with the one-click link in the email; buying clears the cart |
| **Back in stock** | When a sold-out product has stock again | Customers who pressed "Notify me" on that product | One email each, then the wait is cleared |
| **Question answered** | When staff or an admin answers a question | The customer who asked | One email per answer |

## Messages to the owner and team

| Message | When | To | Channel |
|---|---|---|---|
| **Low-stock alert** | A product falls to the low-stock level (default 5 units) | The alert address in Admin → Settings (blank turns it off) | Email. One per product per dip; it re-arms when stock recovers. Products that are sold out are called out in the subject |
| **Sales report** | Weekly (Mondays) or monthly (the 1st), or "Send now" in Admin → Settings | The report address in Admin → Settings | Email with the report as a CSV file for your accountant |
| **Unexpected server error** (optional) | The server hits an error it did not expect | A chat or alerting webhook set by the technical team | Slack, Discord, Teams or any webhook; at most 10 different errors every 10 minutes |

## What customers can control

| Choice | Where |
|---|---|
| Stop cart reminders | My account → Email preferences, or the link in the reminder |
| Receive order updates on WhatsApp | The tick box at checkout (only shown when WhatsApp is connected) |
| Add an email, a mobile number or Google to the account | My account → Ways to sign in and get updates |

Order, return and account messages cannot be switched off, because they are part of the service.

## For the owner: making sure messages arrive

1. Send from an address on **your own domain**, and set up the email provider's SPF and DKIM records. Otherwise messages land in spam.
2. Test once after launch: sign up with a new email, place a cash order, ship it, deliver it, and confirm each message arrives.
3. If WhatsApp is used, the template must be approved by Meta first, with four fields in this order: name, order number, update text, link.
4. Watch the API log for "Failed to send" lines after launch.
