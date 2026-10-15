// Phone numbers are stored in one shape (E.164, like +919876543210) so the same number is never two accounts.
// Ten digits starting 6 to 9 are taken as Indian mobile numbers; anything else needs its country code with a +.
export function normalisePhone(input: string): string | null {
  const raw = input.trim();
  if (!/^[+(\d][+\d\s().-]*$/.test(raw)) return null;
  const digits = raw.replace(/\D/g, "");
  if (raw.startsWith("+")) return digits.length >= 8 && digits.length <= 15 && digits[0] !== "0" ? `+${digits}` : null;
  if (digits.length === 10 && /^[6-9]/.test(digits)) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith("91") && /^[6-9]/.test(digits[2])) return `+${digits}`;
  if (digits.length === 11 && digits.startsWith("0") && /^[6-9]/.test(digits[1])) return `+91${digits.slice(1)}`;
  return null;
}

// "+91 98••• ••210": enough for the owner to recognise it, not enough to learn it.
export const maskPhone = (phone: string) => (phone.length > 6 ? `${phone.slice(0, 3)} ${"•".repeat(Math.max(phone.length - 7, 2))}${phone.slice(-4)}` : phone);
