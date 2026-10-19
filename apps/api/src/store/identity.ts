// Keys that tell whether two accounts or orders belong to the same person. They are stored on every order, so
// the same SQL rules are used when old orders are filled in (see the coupon_customers_identity migration).

// "Jane.Doe+shop@Gmail.com" -> "janedoe@gmail.com". Other providers keep their dots; "+tag" is dropped everywhere.
export function emailKey(email: string | null | undefined): string | null {
  const text = (email ?? "").trim().toLowerCase();
  const at = text.indexOf("@");
  if (at < 1 || at === text.length - 1) return null;
  let local = text.slice(0, at).split("+")[0];
  let domain = text.slice(at + 1);
  if (domain === "gmail.com" || domain === "googlemail.com") { local = local.replaceAll(".", ""); domain = "gmail.com"; }
  return local ? `${local}@${domain}` : null;
}

// "+91 98765 43210", "09876543210" and "9876543210" are one number: the last ten digits.
export function phoneKey(phone: string | null | undefined): string | null {
  const digits = (phone ?? "").replace(/\D/g, "");
  return digits.length >= 10 ? digits.slice(-10) : null;
}

export interface Identity {
  userId: string;
  emailKey: string | null;
  phoneKey: string | null;
  // The phone number given for delivery on the order being placed.
  shipPhoneKey: string | null;
}

export const identityOf = (user: { id: string; email: string | null; phone: string | null }, shipPhone?: string | null): Identity => ({
  userId: user.id, emailKey: emailKey(user.email), phoneKey: phoneKey(user.phone), shipPhoneKey: phoneKey(shipPhone),
});

// Orders placed by this person: their account, or any order carrying the same email or phone number.
export function identityMatches(who: Identity) {
  const phones = [...new Set([who.phoneKey, who.shipPhoneKey].filter((p): p is string => !!p))];
  return [
    { userId: who.userId },
    ...(who.emailKey ? [{ buyerEmailKey: who.emailKey }] : []),
    ...(phones.length ? [{ buyerPhoneKey: { in: phones } }, { shipPhoneKey: { in: phones } }] : []),
  ];
}
