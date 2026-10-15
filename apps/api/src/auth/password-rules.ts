const COMMON = new Set([
  "password", "password1", "password12", "password123", "passw0rd", "12345678", "123456789", "1234567890", "qwertyui", "qwerty123", "qwertyuiop",
  "iloveyou", "welcome1", "welcome123", "admin123", "letmein1", "abc12345", "abcd1234", "11111111", "00000000", "changeme", "change-me-now", "india123", "monkey123",
]);

// Returns what is wrong with a new password, or null when it is fine. Existing passwords are never re-checked.
export function passwordProblem(password: string, context: { email?: string | null; name?: string } = {}): string | null {
  if (password.length < 8) return "Use at least 8 characters";
  if (password.length > 128) return "Use at most 128 characters";
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return "Mix letters and numbers";
  const lower = password.toLowerCase();
  if (COMMON.has(lower) || /^(.)\1+$/.test(password)) return "That password is too common. Choose something harder to guess";
  const local = context.email?.split("@")[0]?.toLowerCase();
  if (local && local.length >= 4 && lower.includes(local)) return "Do not use your email address in your password";
  return null;
}
