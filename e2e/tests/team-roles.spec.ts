import { expect, test, type APIRequestContext, type BrowserContext } from "@playwright/test";
import { ADMIN, API, AUTH_FILES } from "./data";
import { asBrowser, expectOptions, findUser, newCustomer, pick } from "./helpers";

test.use({ storageState: AUTH_FILES.admin });

// New names each run, so the spec works on a database that has seen it before.
const stamp = Date.now();
const NAME = { care: `Cara Care ${stamp}`, fin: `Finn Finance ${stamp}`, rev: `Rhea Review ${stamp}`, cat: `Cato Catalogue ${stamp}` };
const ROLE = { care: `Care executive ${stamp}`, fin: `Finance team ${stamp}`, rev: `Reviewer ${stamp}`, cat: `Editor ${stamp}` };
const shipping = { name: "Role Buyer", phone: "9876500030", line1: "30 Role Road", city: "Pune", state: "Maharashtra", pincode: "411001" };

interface RoleRow { id: string; name: string; permissions: string[]; members: { id: string; name: string }[] }
interface Roles { roles: RoleRow[]; templates: { name: string; permissions: string[] }[] }

test.describe.serial("team roles and permissions", () => {
  let care: BrowserContext, fin: BrowserContext, rev: BrowserContext, cat: BrowserContext;
  let order1 = "", order2 = "", categoryId = "", kettleId = "", adminId = "";
  const ids = { care: "", fin: "", rev: "", cat: "" };
  const userIds = { care: "", fin: "", rev: "", cat: "" };

  const status = (ctx: BrowserContext, id: string, to: string) => ctx.request.patch(`${API}/admin/orders/${id}/status`, { data: { status: to }, headers: asBrowser });
  const get = (ctx: BrowserContext, path: string) => ctx.request.get(`${API}${path}`, { headers: asBrowser });
  const roles = async (request: APIRequestContext) => (await (await request.get(`${API}/admin/roles`, { headers: asBrowser })).json()) as Roles;
  const userId = async (request: APIRequestContext, name: string) => {
    const body = (await (await request.get(`${API}/admin/users?q=${encodeURIComponent(name)}`, { headers: asBrowser })).json()) as { items: { id: string; name: string }[] };
    return body.items.find((u) => u.name === name)!.id;
  };
  const kettle = (over: Record<string, unknown> = {}) => ({ name: "E2E Roles Kettle", slug: "e2e-roles-kettle", description: "For role tests.", categoryId, productType: "OWN", status: "PUBLISHED", images: [], sku: "E2E-ROLES", pricePaise: 100000, stock: 5, costPaise: 61237, ...over });

  test.beforeAll(async ({ browser, request }) => {
    // One at a time: the phone numbers come from the clock.
    care = await newCustomer(browser, NAME.care);
    fin = await newCustomer(browser, NAME.fin);
    rev = await newCustomer(browser, NAME.rev);
    cat = await newCustomer(browser, NAME.cat);
    adminId = (await findUser(request, ADMIN.email)).id;
    categoryId = ((await (await request.get(`${API}/admin/categories`, { headers: asBrowser })).json()) as { id: string }[])[0].id;
    const made = await request.post(`${API}/admin/products`, { headers: asBrowser, data: kettle() });
    expect(made.ok(), await made.text()).toBeTruthy();
    kettleId = ((await made.json()) as { id: string }).id;

    const buyer = await newCustomer(browser, "Role Buyer");
    const place = async () => {
      const res = await buyer.request.post(`${API}/orders`, { data: { items: [{ productId: kettleId, quantity: 1 }], shipping, paymentMethod: "COD" }, headers: asBrowser });
      expect(res.status(), await res.text()).toBe(201);
      return ((await res.json()) as { order: { id: string } }).order.id;
    };
    order1 = await place();
    order2 = await place();
    await buyer.close();
  });

  test.afterAll(async ({ request }) => {
    await request.put(`${API}/admin/products/${kettleId}`, { headers: asBrowser, data: kettle({ status: "DRAFT" }) });
    await Promise.all([care, fin, rev, cat].map((c) => c?.close()));
  });

  test("an admin builds a role from a ready-made one", async ({ page }) => {
    await page.goto("/admin/team");
    await page.getByRole("button", { name: "+ New role" }).click();
    await pick(page.getByRole("button", { name: /Start from a ready-made role/ }), "Customer care executive");
    await expect(page.getByRole("checkbox", { name: /^View orders/ })).toBeChecked();
    await expect(page.getByRole("checkbox", { name: /^Approve or decline returns/ })).toBeChecked();
    await expect(page.getByRole("checkbox", { name: /^Cancel and refund orders/ })).not.toBeChecked();
    await expect(page.getByRole("checkbox", { name: /^See cost prices/ })).not.toBeChecked();
    await page.getByLabel("Role name").fill(ROLE.care);
    await page.getByRole("button", { name: "Create role" }).click();
    await expect(page.getByText("Role created")).toBeVisible();
    await expect(page.getByLabel(`Role ${ROLE.care}`, { exact: true })).toBeVisible();
  });

  test("ticking a permission also ticks what it needs", async ({ page }) => {
    await page.goto("/admin/team");
    await page.getByRole("button", { name: "+ New role" }).click();
    const process = page.getByRole("checkbox", { name: /^Process orders/ });
    const view = page.getByRole("checkbox", { name: /^View orders/ });
    await process.check();
    await expect(view).toBeChecked();
    await view.uncheck();
    await expect(process).not.toBeChecked();
    await expect(page.getByRole("button", { name: "Create role" })).toBeDisabled();
  });

  test("roles are checked: real permissions, at least one, a unique name", async ({ request }) => {
    const { templates } = await roles(request);
    const template = (name: string) => templates.find((t) => t.name === name)!.permissions;
    const make = (name: string, permissions: string[]) => request.post(`${API}/admin/roles`, { data: { name, description: "", permissions }, headers: asBrowser });
    expect((await make(ROLE.fin, template("Finance and accounts"))).status()).toBe(201);
    expect((await make(ROLE.rev, template("Product reviewer"))).status()).toBe(201);
    // Edits products but may not see costs.
    expect((await make(ROLE.cat, ["products.edit", "inventory.view"])).status()).toBe(201);

    const unknown = await make(`Odd ${stamp}`, ["orders.view", "made.up"]);
    expect(unknown.status()).toBe(400);
    expect(JSON.stringify(await unknown.json())).toContain("Unknown permission");
    expect((await make(`Empty ${stamp}`, [])).status()).toBe(400);
    expect((await make(ROLE.fin, ["orders.view"])).status()).toBe(409);

    const temp = await make(`Temp ${stamp}`, ["orders.process"]);
    const made = (await temp.json()) as { id: string; permissions: string[] };
    expect(made.permissions).toContain("orders.view");
    expect((await request.delete(`${API}/admin/roles/${made.id}`, { headers: asBrowser })).status()).toBe(200);

    const all = await roles(request);
    for (const key of ["care", "fin", "rev", "cat"] as const) ids[key] = all.roles.find((r) => r.name === ROLE[key])!.id;
  });

  test("an admin gives a team member a role from the Users page, and a role that does not exist is refused", async ({ page, request }) => {
    await page.goto("/admin/users");
    await page.getByLabel("Search users").fill(NAME.care);
    const select = page.getByLabel(/Role for /);
    await expect(select).toHaveCount(1);
    page.once("dialog", (d) => d.accept());
    await pick(select, { label: ROLE.care });
    await expect(page.getByText(/is now in the role/)).toBeVisible();

    for (const key of ["care", "fin", "rev", "cat"] as const) userIds[key] = await userId(request, NAME[key]);
    for (const key of ["fin", "rev", "cat"] as const) {
      const res = await request.patch(`${API}/admin/users/${userIds[key]}/role`, { data: { role: "STAFF", staffRoleId: ids[key] }, headers: asBrowser });
      expect(res.status(), key).toBe(200);
    }
    const bad = await request.patch(`${API}/admin/users/${userIds.cat}/role`, { data: { role: "STAFF", staffRoleId: "nope" }, headers: asBrowser });
    expect(bad.status()).toBe(400);
  });

  test("customer care can work orders and returns, sees only customers, and cannot touch money, costs or the team", async () => {
    expect((await status(care, order1, "SHIPPED")).ok()).toBeTruthy();
    const cancel = await status(care, order1, "CANCELLED");
    expect(cancel.status()).toBe(403);
    expect(JSON.stringify(await cancel.json())).toContain("cannot do this");

    for (const path of ["/admin/orders", "/admin/returns", "/admin/questions", "/admin/products", "/admin/users"]) expect((await get(care, path)).status(), path).toBe(200);
    expect(JSON.stringify(await (await get(care, "/admin/products")).json())).not.toContain("costPaise");
    expect(JSON.stringify(await (await get(care, "/admin/orders")).json())).not.toContain("costPaise");

    // Colleagues and admins are not in the customer list.
    const users = (await (await get(care, "/admin/users?role=ADMIN")).json()) as { items: { role: string }[]; roles: unknown[] };
    expect(users.items.length).toBeGreaterThan(0);
    expect(users.items.every((u) => u.role === "CUSTOMER")).toBe(true);
    expect(users.roles).toEqual([]);
    expect((await get(care, `/admin/users/${adminId}`)).status()).toBe(404);

    for (const path of ["/admin/users/export", "/admin/analytics/sales", "/admin/audit-log", "/admin/settings", "/admin/coupons", "/admin/roles", "/admin/products/export", "/admin/reviews", "/admin/stock-alerts"]) expect((await get(care, path)).status(), path).toBe(403);
    expect((await care.request.post(`${API}/admin/roles`, { data: { name: "Mine", permissions: ["orders.view"] }, headers: asBrowser })).status()).toBe(403);
    // Nobody can raise their own access.
    expect((await care.request.patch(`${API}/admin/users/${userIds.care}/role`, { data: { role: "ADMIN" }, headers: asBrowser })).status()).toBe(403);
  });

  test("customer care sees only its own sections", async () => {
    const page = await care.newPage();
    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: "Welcome, Cara" })).toBeVisible();
    await expect(page.getByText(ROLE.care).first()).toBeVisible();
    const nav = page.getByRole("navigation", { name: "Admin" });
    for (const name of ["Orders", "Returns", "Questions", "Products", "Users"]) await expect(nav.getByRole("link", { name })).toBeVisible();
    for (const name of ["Analytics", "Settings", "Audit log", "Coupons", "Team & roles", "Reviews"]) await expect(nav.getByRole("link", { name })).toHaveCount(0);

    await page.goto("/admin/users");
    await expect(page.getByRole("heading", { name: "Customers" })).toBeVisible();
    await expect(page.getByLabel(/^Role for /)).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Export CSV" })).toHaveCount(0);
    await expect(page.getByText(ADMIN.email)).toHaveCount(0);

    await page.goto("/admin/orders");
    await expectOptions(page.getByLabel(`Status for order ${order2.slice(-8)}`), { present: ["Shipped"], absent: ["Cancelled", "Refunded"] });

    await page.goto("/admin/team");
    await expect(page).toHaveURL(/\/admin$/);
    await page.close();
  });

  test("finance sees costs, orders and reports, and can cancel and refund but not ship", async () => {
    expect((await status(fin, order2, "SHIPPED")).status()).toBe(403);
    for (const path of ["/admin/orders", "/admin/returns", "/admin/products", "/admin/analytics/sales", "/admin/audit-log"]) expect((await get(fin, path)).status(), path).toBe(200);
    expect(JSON.stringify(await (await get(fin, "/admin/products")).json())).toContain("costPaise");
    for (const path of ["/admin/users", "/admin/settings", "/admin/coupons", "/admin/roles", "/admin/questions"]) expect((await get(fin, path)).status(), path).toBe(403);
    expect((await fin.request.post(`${API}/admin/products`, { data: kettle({ slug: "e2e-roles-nope", sku: "E2E-NOPE" }), headers: asBrowser })).status()).toBe(403);

    const page = await fin.newPage();
    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
    const nav = page.getByRole("navigation", { name: "Admin" });
    for (const name of ["Analytics", "Audit log", "Orders", "Returns", "Products"]) await expect(nav.getByRole("link", { name })).toBeVisible();
    for (const name of ["Coupons", "Settings", "Team & roles", "Users"]) await expect(nav.getByRole("link", { name })).toHaveCount(0);

    await page.goto("/admin/orders");
    const select = page.getByLabel(`Status for order ${order2.slice(-8)}`);
    await expectOptions(select, { present: ["Cancelled", "Refunded"], absent: ["Delivered", "Shipped"] });
    page.once("dialog", (d) => d.accept());
    await pick(select, "CANCELLED");
    await expect(page.getByText("Order updated to cancelled")).toBeVisible();
    await page.close();
  });

  test("a product reviewer moderates reviews and questions and nothing else", async () => {
    for (const path of ["/admin/reviews", "/admin/questions", "/admin/products"]) expect((await get(rev, path)).status(), path).toBe(200);
    expect(JSON.stringify(await (await get(rev, "/admin/products")).json())).not.toContain("costPaise");
    for (const path of ["/admin/orders", "/admin/returns", "/admin/users", "/admin/analytics/sales", "/admin/categories/x"]) expect((await get(rev, path)).status(), path).not.toBe(200);
    expect((await rev.request.delete(`${API}/admin/products/${kettleId}`, { headers: asBrowser })).status()).toBe(403);

    const page = await rev.newPage();
    await page.goto("/admin/reviews");
    await expect(page.getByRole("heading", { name: "Reviews" })).toBeVisible();
    const nav = page.getByRole("navigation", { name: "Admin" });
    for (const name of ["Reviews", "Questions", "Products"]) await expect(nav.getByRole("link", { name })).toBeVisible();
    for (const name of ["Orders", "Returns", "Users", "Analytics"]) await expect(nav.getByRole("link", { name })).toHaveCount(0);
    await page.goto("/admin/products");
    await expect(page.getByRole("heading", { name: "Products" })).toBeVisible();
    await expect(page.getByRole("link", { name: "+ Add product" })).toHaveCount(0);
    await page.close();
  });

  test("an editor without cost access can edit products without wiping or changing the costs", async ({ request }) => {
    const seen = await (await get(cat, `/admin/products/${kettleId}`)).json();
    expect(JSON.stringify(seen)).not.toContain("costPaise");

    const edit = await cat.request.put(`${API}/admin/products/${kettleId}`, { headers: asBrowser, data: { ...kettle({ pricePaise: 110000 }), costPaise: undefined } });
    expect(edit.ok(), await edit.text()).toBeTruthy();
    // Even a cost sent by hand is ignored.
    expect((await cat.request.put(`${API}/admin/products/${kettleId}`, { headers: asBrowser, data: kettle({ pricePaise: 110000, costPaise: 1 }) })).ok()).toBeTruthy();

    const stored = (await (await request.get(`${API}/admin/products/${kettleId}`, { headers: asBrowser })).json()) as { pricePaise: number; costPaise: number };
    expect(stored).toMatchObject({ pricePaise: 110000, costPaise: 61237 });

    const theirs = await (await get(cat, "/admin/products/export")).text();
    const mine = await (await request.get(`${API}/admin/products/export`, { headers: asBrowser })).text();
    expect(mine).toContain("612.37");
    expect(theirs).toContain("e2e-roles-kettle");
    expect(theirs).not.toContain("612.37");
    for (const path of ["/admin/settings", "/admin/orders", "/admin/analytics/sales"]) expect((await get(cat, path)).status(), path).toBe(403);
  });

  test("changing a role applies at once, and a role in use cannot be deleted", async ({ request }) => {
    const current = (await roles(request)).roles.find((r) => r.id === ids.care)!;
    expect(current.members.map((m) => m.name)).toEqual([NAME.care]);
    expect((await request.delete(`${API}/admin/roles/${ids.care}`, { headers: asBrowser })).status()).toBe(409);

    const without = current.permissions.filter((p) => p !== "returns.decide");
    const saved = await request.put(`${API}/admin/roles/${ids.care}`, { data: { name: ROLE.care, description: "", permissions: without }, headers: asBrowser });
    expect(saved.status()).toBe(200);
    expect((await get(care, "/admin/returns")).status()).toBe(200);
    expect((await care.request.patch(`${API}/admin/returns/none`, { data: { action: "approve" }, headers: asBrowser })).status()).toBe(403);
  });

  test("an admin removes someone from the team and deletes the unused role", async ({ page }) => {
    await page.goto("/admin/team");
    await expect(page.getByLabel(`Role for ${NAME.rev}`)).toBeVisible();
    page.once("dialog", (d) => d.accept());
    await pick(page.getByLabel(`Role for ${NAME.rev}`), "CUSTOMER");
    await expect(page.getByText(`${NAME.rev} was removed from the team`)).toBeVisible();
    expect((await get(rev, "/admin/reviews")).status()).toBe(403);

    page.once("dialog", (d) => d.accept());
    await page.getByLabel(`Role ${ROLE.rev}`, { exact: true }).getByRole("button", { name: "Delete" }).click();
    await expect(page.getByText("Role deleted")).toBeVisible();
    await expect(page.getByLabel(`Role ${ROLE.rev}`, { exact: true })).toHaveCount(0);
  });

  test("the audit log notes role changes and blocked attempts", async ({ request }) => {
    const log = (await (await request.get(`${API}/admin/audit-log`, { headers: asBrowser })).json()) as { items: { actorName: string; action: string; summary: string }[] };
    expect(log.items.find((e) => e.action === "role.create" && e.summary.includes(ROLE.care))).toMatchObject({ actorName: "E2E Admin" });
    expect(log.items.find((e) => e.action === "role.update")).toBeTruthy();
    expect(log.items.find((e) => e.action === "role.delete")).toBeTruthy();
    expect(log.items.find((e) => e.action === "user.role.blocked")).toMatchObject({ actorName: NAME.care });
  });
});
