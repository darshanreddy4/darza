export const MAX_FAILED_LOGINS = 5;
export const LOCK_MINUTES = 15;

// Whole minutes until password sign-in works again, or 0 when the account is not locked.
export function lockMinutesLeft(lockedUntil: Date | null, now = new Date()): number {
  if (!lockedUntil || lockedUntil.getTime() <= now.getTime()) return 0;
  return Math.ceil((lockedUntil.getTime() - now.getTime()) / 60_000);
}

// What to store after a wrong password: the account locks once the limit is reached, and the count starts over.
export function afterFailedLogin(failedSoFar: number, now = new Date()): { failedLogins: number; lockedUntil: Date | null } {
  if (failedSoFar < MAX_FAILED_LOGINS) return { failedLogins: failedSoFar, lockedUntil: null };
  return { failedLogins: 0, lockedUntil: new Date(now.getTime() + LOCK_MINUTES * 60_000) };
}
