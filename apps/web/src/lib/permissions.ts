import type { AuthUser } from "@/lib/auth";

type Who = Pick<AuthUser, "role" | "permissions"> | null | undefined;

export const isTeam = (user: Pick<AuthUser, "role"> | null | undefined) => user?.role === "ADMIN" || user?.role === "STAFF";

// True when the user has at least one of these permissions (admins have them all).
export const can = (user: Who, ...perms: string[]) => !!user && perms.some((p) => user.permissions?.includes(p));

// The permission that opens each part of the admin area; the API enforces the same rules. Anything not listed is for admins only.
const AREAS: [prefix: string, needs: string[]][] = [
  ["/admin/orders", ["orders.view"]],
  ["/admin/print", ["orders.view"]],
  ["/admin/returns", ["returns.view"]],
  ["/admin/questions", ["questions.answer"]],
  ["/admin/reviews", ["reviews.moderate"]],
  ["/admin/attention", ["inventory.view"]],
  ["/admin/stock", ["inventory.view"]],
  ["/admin/products", ["products.view"]],
  ["/admin/categories", ["categories.manage"]],
  ["/admin/users", ["customers.view"]],
  ["/admin/coupons", ["coupons.manage"]],
  ["/admin/banners", ["content.manage"]],
  ["/admin/home", ["content.manage"]],
  ["/admin/pages", ["content.manage"]],
  ["/admin/brand", ["brand.manage"]],
  ["/admin/appearance", ["brand.manage"]],
  ["/admin/analytics", ["analytics.view"]],
  ["/admin/abandoned-carts", ["analytics.view"]],
  ["/admin/clicks", ["analytics.view"]],
  ["/admin/audit-log", ["audit.view"]],
  ["/admin/settings", ["settings.manage"]],
];

export function mayVisit(user: Who, pathname: string): boolean {
  if (!user) return false;
  if (user.role === "ADMIN") return true;
  if (user.role !== "STAFF") return false;
  // Everyone on the team gets the start page.
  if (pathname === "/admin") return true;
  // Adding or editing a product is more than looking at the list.
  if (pathname.startsWith("/admin/products/")) return can(user, "products.edit");
  const area = AREAS.find(([prefix]) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  return !!area && can(user, ...area[1]);
}
