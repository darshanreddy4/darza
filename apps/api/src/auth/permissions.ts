import type { OrderStatus, Role } from "@prisma/client";

// What a team member may do is a list of permission keys. Admins have them all; everyone else gets the permissions of their team role.
// Managing the team and its roles is not a permission: only admins can do it, so nobody can give themselves more access.

export interface PermissionDef {
  key: string;
  label: string;
  description: string;
  // Moves money, shows personal details or changes how the store runs, so the roles screen marks it.
  sensitive?: boolean;
}
export interface PermissionGroup { key: string; label: string; permissions: PermissionDef[] }

export const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    key: "orders", label: "Orders and delivery", permissions: [
      { key: "orders.view", label: "View orders", description: "See orders, delivery addresses, payment details and invoices." },
      { key: "orders.process", label: "Process orders", description: "Mark orders paid, shipped and delivered, and add courier tracking." },
      { key: "orders.cancel", label: "Cancel and refund orders", description: "Cancel an order or mark it refunded. Returns the stock and sends online payments back.", sensitive: true },
    ],
  },
  {
    key: "returns", label: "Returns", permissions: [
      { key: "returns.view", label: "View returns", description: "See return requests and their refund amounts." },
      { key: "returns.decide", label: "Approve or decline returns", description: "Approve a return request, or decline it with a reason." },
      { key: "returns.refund", label: "Refund returns and record payouts", description: "Refund returned items and record cash-on-delivery payouts.", sensitive: true },
    ],
  },
  {
    key: "catalogue", label: "Products and stock", permissions: [
      { key: "products.view", label: "View products", description: "See products, prices and stock, without cost prices." },
      { key: "products.edit", label: "Create and edit products", description: "Add, change, delete, bulk edit, import and export products, and upload pictures." },
      { key: "categories.manage", label: "Manage categories", description: "Add, rename and remove categories." },
      { key: "costs.view", label: "See cost prices", description: "Cost prices and the cost of goods on orders.", sensitive: true },
      { key: "inventory.view", label: "See stock alerts", description: "The Attention list: low stock, sold out and customers waiting for a product. Also the warehouses and the stock history." },
      { key: "inventory.manage", label: "Manage stock and warehouses", description: "Add warehouses, receive stock, correct counts and move stock between warehouses." },
    ],
  },
  {
    key: "community", label: "Customers and community", permissions: [
      { key: "reviews.moderate", label: "Moderate reviews", description: "See every review and remove those that break the rules." },
      { key: "questions.answer", label: "Answer customer questions", description: "Answer, hide or delete the questions asked on product pages." },
      { key: "customers.view", label: "View customers", description: "Customer accounts, contact details and order history.", sensitive: true },
      { key: "customers.export", label: "Export customers", description: "Download the customer list as a spreadsheet.", sensitive: true },
    ],
  },
  {
    key: "marketing", label: "Marketing and content", permissions: [
      { key: "coupons.manage", label: "Manage coupons", description: "Create, change and switch off discount codes." },
      { key: "content.manage", label: "Manage home page and pages", description: "Banners, home page blocks, policy pages and pages of your own." },
      { key: "brand.manage", label: "Manage brand and look", description: "Logo, brand details, theme, header and footer colours, price currencies." },
    ],
  },
  {
    key: "business", label: "Business", permissions: [
      { key: "analytics.view", label: "View analytics and reports", description: "Sales analytics, reports, abandoned carts and affiliate clicks. Includes profit figures.", sensitive: true },
      { key: "audit.view", label: "View the audit log", description: "See who changed what, and attempts that were blocked." },
      { key: "settings.manage", label: "Manage store settings", description: "Delivery fees, GST, payment rules, return window, alerts and the search index.", sensitive: true },
    ],
  },
];

export const ALL_PERMISSIONS: string[] = PERMISSION_GROUPS.flatMap((g) => g.permissions.map((p) => p.key));
export const isPermission = (key: string) => ALL_PERMISSIONS.includes(key);

// Doing something needs seeing it first, so granting one also grants what it builds on.
export const PERMISSION_REQUIRES: Record<string, string[]> = {
  "orders.process": ["orders.view"], "orders.cancel": ["orders.view"],
  "returns.decide": ["returns.view"], "returns.refund": ["returns.view"],
  "products.edit": ["products.view"], "categories.manage": ["products.view"], "costs.view": ["products.view"], "inventory.view": ["products.view"],
  "inventory.manage": ["inventory.view", "products.view"],
  "customers.export": ["customers.view"],
};

// Keeps only real keys, adds what each one builds on, drops repeats and puts them in catalogue order.
export function normalisePermissions(list: string[]): { permissions: string[]; unknown: string[] } {
  const unknown = [...new Set(list.filter((k) => !isPermission(k)))];
  const wanted = new Set(list.filter(isPermission));
  for (const key of [...wanted]) for (const base of PERMISSION_REQUIRES[key] ?? []) wanted.add(base);
  return { permissions: ALL_PERMISSIONS.filter((k) => wanted.has(k)), unknown };
}

// Team members promoted before roles existed keep what staff could always do.
export const LEGACY_STAFF_PERMISSIONS: string[] = ["orders.view", "orders.process", "returns.view", "returns.decide", "questions.answer", "products.view", "inventory.view"];

// Ready-made roles an admin can start from, named for the jobs people really have in an online shop.
export const ROLE_TEMPLATES: { name: string; description: string; permissions: string[] }[] = [
  { name: "Order fulfilment executive", description: "Packs and ships orders. Cannot cancel or refund, and sees no costs.", permissions: ["orders.view", "orders.process", "products.view", "inventory.view"] },
  { name: "Customer care executive", description: "Answers customers, handles orders and decides returns. Cannot send money.", permissions: ["orders.view", "orders.process", "returns.view", "returns.decide", "questions.answer", "products.view", "customers.view"] },
  { name: "Customer care lead", description: "Customer care with the power to cancel orders and refund returns.", permissions: ["orders.view", "orders.process", "orders.cancel", "returns.view", "returns.decide", "returns.refund", "questions.answer", "reviews.moderate", "products.view", "customers.view", "inventory.view"] },
  { name: "Finance and accounts", description: "Sees orders, costs and reports, and handles refunds and payouts.", permissions: ["orders.view", "orders.cancel", "returns.view", "returns.refund", "products.view", "costs.view", "analytics.view", "audit.view"] },
  { name: "Catalogue manager", description: "Adds and edits products, categories and prices, and watches stock.", permissions: ["products.view", "products.edit", "categories.manage", "costs.view", "inventory.view", "inventory.manage"] },
  { name: "Product reviewer", description: "Checks reviews and answers questions on product pages. Changes nothing else.", permissions: ["products.view", "reviews.moderate", "questions.answer"] },
  { name: "Marketing manager", description: "Runs coupons, banners, the home page and the shop's look, and reads the reports.", permissions: ["products.view", "coupons.manage", "content.manage", "brand.manage", "analytics.view"] },
  { name: "Inventory and warehouse", description: "Keeps stock right and sees what needs packing.", permissions: ["products.view", "products.edit", "inventory.view", "inventory.manage", "orders.view", "orders.process"] },
  { name: "Store manager", description: "Everything except the store settings, and team and role management.", permissions: ALL_PERMISSIONS.filter((k) => k !== "settings.manage") },
];

// What a signed-in user may do right now. Customers may do nothing in the admin area.
export function permissionsFor(user: { role: Role; staffRole?: { permissions: string[] } | null }): string[] {
  if (user.role === "ADMIN") return ALL_PERMISSIONS;
  if (user.role === "STAFF") return user.staffRole ? user.staffRole.permissions.filter(isPermission) : LEGACY_STAFF_PERMISSIONS;
  return [];
}

export const hasPermission = (perms: readonly string[] | undefined, key: string) => !!perms?.includes(key);

const MONEY_STATUSES: OrderStatus[] = ["CANCELLED", "REFUNDED"];

// Cancelling or refunding an order returns stock and (for online orders) sends money back, so it has its own permission.
export function canSetOrderStatus(perms: readonly string[] | undefined, status: OrderStatus): boolean {
  return hasPermission(perms, MONEY_STATUSES.includes(status) ? "orders.cancel" : "orders.process");
}

export function canDecideReturn(perms: readonly string[] | undefined, action: "approve" | "reject" | "refund" | "paid"): boolean {
  return hasPermission(perms, action === "approve" || action === "reject" ? "returns.decide" : "returns.refund");
}

// What the business paid for goods is only for those who may see costs.
export function withoutCost<T extends { costPaise?: number | null; options?: { costPaise?: number | null }[] }>(perms: readonly string[] | undefined, row: T): T {
  if (hasPermission(perms, "costs.view")) return row;
  const { costPaise: _cost, ...rest } = row;
  void _cost;
  // Each option of a product carries its own cost.
  if (rest.options) rest.options = rest.options.map(({ costPaise: c, ...o }) => { void c; return o; });
  return rest as T;
}
