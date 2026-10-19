// "98765*****": the first half of a phone number, the rest hidden.
export function maskPhone(phone: string): string {
  // Numbers are stored with the country code (+919856123456); the owner knows theirs as ten digits.
  const all = phone.replace(/\D/g, "");
  const digits = all.length === 12 && all.startsWith("91") ? all.slice(2) : all.length === 11 && all.startsWith("0") ? all.slice(1) : all;
  const shown = Math.floor(digits.length / 2);
  return `${digits.slice(0, shown)}${"*".repeat(Math.max(1, digits.length - shown))}`;
}

// "rahul*****@gmail.com": the first half of the part before the @, the rest hidden; the domain stays.
export function maskEmail(email: string): string {
  const [local = "", domain = ""] = email.trim().split("@");
  const shown = Math.max(1, Math.floor(local.length / 2));
  return `${local.slice(0, shown)}${"*".repeat(Math.max(1, local.length - shown))}${domain ? `@${domain}` : ""}`;
}

// A "name" that is really the email or phone number the account was made with does not count as a name.
const looksLikeContact = (name: string) => name.includes("@") || /^[\d\s+()-]{6,}$/.test(name);

// What to print above a review: the name they gave, or else half of their email or phone number.
export function reviewerName(u: { name: string | null; email: string | null; phone: string | null }): string {
  const name = (u.name ?? "").replace(/\s+/g, " ").trim();
  if (name && !looksLikeContact(name)) return name.slice(0, 40);
  if (u.phone) return maskPhone(u.phone);
  if (u.email) return maskEmail(u.email);
  return "Customer";
}
