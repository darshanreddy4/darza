export interface AuditEntry {
  action: string;
  entity: string | null;
  entityId: string | null;
  summary: string;
  details: Record<string, unknown> | null;
}

const SECRET_KEY = /pass(word)?|token|secret|credential|authorization|cookie|code$/i;
const BULKY_KEY = /^(description|images|specifications|highlights|videoUrls|about|csv)$/;

// What was sent, minus secrets and bulk, so the log shows what changed without keeping passwords or whole product descriptions.
export function sanitiseBody(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return undefined;
  if (typeof value === "string") return value.length > 200 ? `${value.slice(0, 200)}…` : value;
  if (typeof value !== "object") return value;
  if (Array.isArray(value)) return depth >= 2 ? `[${value.length} items]` : value.length > 10 ? `[${value.length} items]` : value.map((v) => sanitiseBody(v, depth + 1));
  if (depth >= 2) return "{…}";
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (SECRET_KEY.test(k)) out[k] = "[hidden]";
    else if (BULKY_KEY.test(k)) out[k] = Array.isArray(v) ? `[${v.length} items]` : "[omitted]";
    else { const s = sanitiseBody(v, depth + 1); if (s !== undefined) out[k] = s; }
  }
  return out;
}

const ref = (id?: string) => (id ? `#${id.slice(-8).toUpperCase()}` : "");
const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);
const RETURN_VERB: Record<string, string> = { approve: "Approved", reject: "Declined", refund: "Refunded", paid: "Paid out the refund for" };

type Ctx = { id?: string; body: Record<string, unknown> };
type Rule = (c: Ctx) => Omit<AuditEntry, "details">;

const named = (kind: string, c: Ctx) => str(c.body.name) ?? str(c.body.code) ?? str(c.body.title) ?? str(c.body.slug) ?? c.id ?? kind;

// Known admin actions in plain words. Anything else falls back to the method and path.
const RULES: Record<string, Rule> = {
  "PATCH /admin/orders/:id/tracking": (c) => ({ action: "order.tracking", entity: "order", entityId: c.id ?? null, summary: `Set tracking for order ${ref(c.id)}${c.body.courierName ? ` (${String(c.body.courierName)})` : ""}` }),
  "POST /admin/stock/receive": (c) => ({ action: "stock.receive", entity: "stock", entityId: null, summary: `Received ${String(c.body.quantity ?? "?")} units into a warehouse` }),
  "POST /admin/stock/adjust": (c) => ({ action: "stock.adjust", entity: "stock", entityId: null, summary: `Corrected a stock count by ${String(c.body.delta ?? "?")} units` }),
  "POST /admin/stock/transfer": (c) => ({ action: "stock.transfer", entity: "stock", entityId: null, summary: `Moved ${String(c.body.quantity ?? "?")} units between warehouses` }),
  "POST /admin/warehouses": (c) => ({ action: "warehouse.create", entity: "warehouse", entityId: null, summary: `Added the warehouse ${named("", c)}` }),
  "PUT /admin/warehouses/:id": (c) => ({ action: "warehouse.update", entity: "warehouse", entityId: c.id ?? null, summary: `Changed the warehouse ${named("", c)}` }),
  "DELETE /admin/warehouses/:id": (c) => ({ action: "warehouse.delete", entity: "warehouse", entityId: c.id ?? null, summary: "Deleted a warehouse" }),
  "POST /admin/orders/bulk-ship": (c) => ({ action: "order.bulk-ship", entity: "order", entityId: null, summary: `Marked ${Array.isArray(c.body.ids) ? c.body.ids.length : "several"} orders as shipped${c.body.courierName ? ` with ${String(c.body.courierName)}` : ""}` }),
  "PATCH /admin/orders/:id/status": (c) => ({ action: "order.status", entity: "order", entityId: c.id ?? null, summary: `Set order ${ref(c.id)} to ${String(c.body.status ?? "?").toLowerCase()}` }),
  "PATCH /admin/returns/:id": (c) => ({ action: "return.decide", entity: "return", entityId: c.id ?? null, summary: `${RETURN_VERB[String(c.body.action)] ?? "Updated"} a return request` }),
  "POST /admin/products": (c) => ({ action: "product.create", entity: "product", entityId: null, summary: `Created product ${named("", c)}` }),
  "PUT /admin/products/:id": (c) => ({ action: "product.update", entity: "product", entityId: c.id ?? null, summary: `Updated product ${named("", c)}` }),
  "DELETE /admin/products/:id": (c) => ({ action: "product.delete", entity: "product", entityId: c.id ?? null, summary: "Deleted a product" }),
  "POST /admin/products/bulk": (c) => ({ action: "product.bulk", entity: "product", entityId: null, summary: `Edited ${Array.isArray(c.body.ids) ? c.body.ids.length : "several"} products at once` }),
  "POST /admin/products/import": () => ({ action: "product.import", entity: "product", entityId: null, summary: "Imported products from a CSV file" }),
  "PUT /admin/settings": () => ({ action: "settings.update", entity: "settings", entityId: null, summary: "Changed store settings" }),
  "PUT /admin/appearance": (c) => ({ action: "appearance.update", entity: "appearance", entityId: null, summary: typeof c.body.theme === "string" ? `Changed the store look to ${c.body.theme.toLowerCase()} and currency settings` : "Changed currency settings" }),
  "POST /admin/appearance/refresh-rates": () => ({ action: "appearance.rates", entity: "appearance", entityId: null, summary: "Refreshed exchange rates" }),
  "POST /admin/site-profile/transparent-logo": () => ({ action: "brand.logo-transparent", entity: "brand", entityId: null, summary: "Made the logo background transparent" }),
  "POST /admin/pages": (c) => ({ action: "page.create", entity: "page", entityId: null, summary: `Added the page ${named("", c)}` }),
  "PUT /admin/pages/:id": (c) => ({ action: "page.update", entity: "page", entityId: c.id ?? null, summary: `Updated the page ${c.id ?? ""}` }),
  "DELETE /admin/pages/:id": (c) => ({ action: "page.delete", entity: "page", entityId: c.id ?? null, summary: `Removed or reset the page ${c.id ?? ""}` }),
  "PUT /admin/site-profile": () => ({ action: "brand.update", entity: "brand", entityId: null, summary: "Changed brand and contact details" }),
  "PATCH /admin/users/:id/role": (c) => ({ action: "user.role", entity: "user", entityId: c.id ?? null, summary: `Set a user's role to ${String(c.body.role ?? "?").toLowerCase()}${typeof c.body.staffRoleId === "string" ? " with a team role" : ""}` }),
  "POST /admin/roles": (c) => ({ action: "role.create", entity: "role", entityId: null, summary: `Created the team role ${named("", c)}` }),
  "PUT /admin/roles/:id": (c) => ({ action: "role.update", entity: "role", entityId: c.id ?? null, summary: `Changed the permissions of the team role ${named("", c)}` }),
  "DELETE /admin/roles/:id": (c) => ({ action: "role.delete", entity: "role", entityId: c.id ?? null, summary: "Deleted a team role" }),
  "POST /admin/users/:id/sign-out": (c) => ({ action: "user.sign-out", entity: "user", entityId: c.id ?? null, summary: "Signed a user out of every device" }),
  "POST /admin/coupons": (c) => ({ action: "coupon.create", entity: "coupon", entityId: null, summary: `Created coupon ${named("", c)}` }),
  "PUT /admin/coupons/:id": (c) => ({ action: "coupon.update", entity: "coupon", entityId: c.id ?? null, summary: `Updated coupon ${named("", c)}` }),
  "DELETE /admin/coupons/:id": (c) => ({ action: "coupon.delete", entity: "coupon", entityId: c.id ?? null, summary: "Deleted a coupon" }),
  "PATCH /admin/questions/:id": (c) => ({ action: "question.answer", entity: "question", entityId: c.id ?? null, summary: "Answered a customer question" }),
  "DELETE /admin/questions/:id": (c) => ({ action: "question.delete", entity: "question", entityId: c.id ?? null, summary: "Deleted a customer question" }),
  "DELETE /admin/reviews/:id": (c) => ({ action: "review.delete", entity: "review", entityId: c.id ?? null, summary: "Deleted a review" }),
  "PUT /admin/home-layout": () => ({ action: "home.update", entity: "home", entityId: null, summary: "Changed the home page layout" }),
  "DELETE /admin/home-layout": () => ({ action: "home.reset", entity: "home", entityId: null, summary: "Reset the home page to the default layout" }),
  "POST /admin/search/reindex": () => ({ action: "search.reindex", entity: "search", entityId: null, summary: "Rebuilt the search index" }),
};

const VERB: Record<string, string> = { POST: "Created", PUT: "Updated", PATCH: "Updated", DELETE: "Deleted" };

// Turns an admin request into a log entry; null for requests that are not worth logging (reads, dry runs, uploads).
export function describeAction(input: { method: string; routePath: string; params?: Record<string, string>; body?: unknown; query?: Record<string, unknown> }): AuditEntry | null {
  const method = input.method.toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") return null;
  if (!input.routePath.startsWith("/admin")) return null;
  if (input.routePath.startsWith("/admin/uploads")) return null;
  if (input.query?.dryRun === "true" || (input.body as { dryRun?: boolean } | undefined)?.dryRun === true) return null;

  const body = input.body && typeof input.body === "object" && !Array.isArray(input.body) ? (input.body as Record<string, unknown>) : {};
  const id = input.params?.id;
  const rule = RULES[`${method} ${input.routePath}`];
  const base = rule
    ? rule({ id, body })
    : (() => {
        const entity = input.routePath.split("/")[2] ?? "admin";
        return { action: `${entity}.${method.toLowerCase()}`, entity, entityId: id ?? null, summary: `${VERB[method] ?? method} ${entity.replace(/-/g, " ")}` };
      })();
  const clean = typeof input.body === "string" ? { bytes: input.body.length } : sanitiseBody(body);
  const details = clean && typeof clean === "object" && Object.keys(clean).length > 0 ? JSON.stringify(clean).length <= 4000 ? (clean as Record<string, unknown>) : { note: "large request" } : null;
  return { ...base, details };
}
