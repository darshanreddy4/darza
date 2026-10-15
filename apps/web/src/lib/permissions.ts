import type { AuthUser } from "@/lib/auth";

export const isTeam = (user: Pick<AuthUser, "role"> | null | undefined) => user?.role === "ADMIN" || user?.role === "STAFF";

// What staff may open in the admin area. Everything else is for admins (the API refuses it too).
const STAFF_PREFIXES = ["/admin/orders", "/admin/returns", "/admin/questions", "/admin/attention"];

export function staffMayVisit(pathname: string): boolean {
  return pathname === "/admin/products" || STAFF_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}
