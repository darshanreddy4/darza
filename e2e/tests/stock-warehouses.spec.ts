import { expect, test, type APIRequestContext, type BrowserContext } from "@playwright/test";
import { API, AUTH_FILES } from "./data";
import { asBrowser, newCustomer, pick } from "./helpers";

test.use({ storageState: AUTH_FILES.admin });

const stamp = Date.now();
const shipping = { name: "Stock Buyer", phone: "9876500050", line1: "50 Stock Road", city: "Pune", state: "Maharashtra", pincode: "411001" };
const WH = { name: `Delhi hub ${stamp}`, code: `D${String(stamp).slice(-6)}` };

interface Level { optionId: string | null; label: string | null; total: number; byWarehouse: { warehouseId: string; quantity: number }[] }
interface Move { productId: string; optionId: string | null; delta: number; balanceAfter: number; reason: string; note: string | null; orderId: string | null; actorName: string | null; warehouse: { name: string } | null }

test.describe.serial("warehouses and stock history", () => {
  let categoryId = "";
  let lampId = "";
  let teeId = "";
  let teeL = "";
  let delhi = "";
  let mainId = "";
  let buyer: BrowserContext;
  let viewer: BrowserContext;
  let keeper: BrowserContext;
  const orders: string[] = [];

  const lamp = (over: Record<string, unknown> = {}) => ({ name: "E2E Stock Lamp", slug: "e2e-stock-lamp", description: "For stock tests.", categoryId, productType: "OWN", status: "PUBLISHED", images: [], sku: "E2E-STOCK-LAMP", pricePaise: 50000, stock: 20, ...over });
  const tee = (over: Record<string, unknown> = {}) => ({ name: "E2E Stock Tee", slug: "e2e-stock-tee", description: "Sold in sizes.", categoryId, productType: "OWN", status: "PUBLISHED", images: [], sku: "E2E-STOCK-TEE", pricePaise: 1, stock: 0, options: [{ label: "L", pricePaise: 70000, stock: 6 }, { label: "XL", pricePaise: 70000, stock: 4 }], ...over });
  const moves = async (request: APIRequestContext, productId: string, extra = "") => ((await (await request.get(`${API}/admin/stock/movements?productId=${productId}${extra}`, { headers: asBrowser })).json()) as { total: number; items: Move[] }).items;
  const levels = async (request: APIRequestContext, productId: string) => (await (await request.get(`${API}/admin/stock/levels/${productId}`, { headers: asBrowser })).json()) as { items: Level[] };
  const at = (level: Level, warehouseId: string) => level.byWarehouse.find((b) => b.warehouseId === warehouseId)!.quantity;
  const post = (request: APIRequestContext, path: string, data: Record<string, unknown>) => request.post(`${API}${path}`, { data, headers: asBrowser });
  const order = async (productId: string, quantity: number, optionId?: string) => {
    const res = await buyer.request.post(`${API}/orders`, { data: { items: [{ productId, quantity, optionId }], shipping, paymentMethod: "COD" }, headers: asBrowser });
    expect(res.status(), await res.text()).toBe(201);
    const id = ((await res.json()) as { order: { id: string } }).order.id;
    orders.push(id);
    return id;
  };

  test.beforeAll(async ({ browser, request }) => {
    categoryId = ((await (await request.get(`${API}/admin/categories`, { headers: asBrowser })).json()) as { id: string }[])[0].id;
    const made = await request.post(`${API}/admin/products`, { headers: asBrowser, data: lamp() });
    expect(made.ok(), await made.text()).toBeTruthy();
    lampId = ((await made.json()) as { id: string }).id;
    const madeTee = await request.post(`${API}/admin/products`, { headers: asBrowser, data: tee() });
    expect(madeTee.ok(), await madeTee.text()).toBeTruthy();
    const body = (await madeTee.json()) as { id: string; options: { id: string; label: string }[] };
    teeId = body.id;
    teeL = body.options.find((o) => o.label === "L")!.id;
    buyer = await newCustomer(browser, "Stock Buyer");
    viewer = await newCustomer(browser, `Vera Viewer ${stamp}`);
    keeper = await newCustomer(browser, `Kim Keeper ${stamp}`);
  });

  test.afterAll(async ({ request }) => {
    await request.put(`${API}/admin/products/${lampId}`, { headers: asBrowser, data: lamp({ status: "DRAFT" }) });
    await request.put(`${API}/admin/products/${teeId}`, { headers: asBrowser, data: tee({ status: "DRAFT", options: undefined }) });
    await Promise.all([buyer, viewer, keeper].map((c) => c?.close()));
  });

  test("a new product's opening stock is written down, and one main warehouse exists from the start", async ({ request }) => {
    const first = (await moves(request, lampId)).find((m) => m.reason === "RECEIVED")!;
    expect(first).toMatchObject({ delta: 20, balanceAfter: 20, note: "Opening stock", actorName: "E2E Admin" });
    expect(first.warehouse!.name).toBe("Main warehouse");
    const list = (await (await request.get(`${API}/admin/warehouses`, { headers: asBrowser })).json()) as { id: string; isMain: boolean; units: number }[];
    const main = list.find((w) => w.isMain)!;
    mainId = main.id;
    expect(main.units).toBeGreaterThanOrEqual(20);
  });

  test("a sale is recorded against its order and a cancellation puts the units back", async ({ request }) => {
    const id = await order(lampId, 3);
    const sale = (await moves(request, lampId)).find((m) => m.reason === "SALE")!;
    expect(sale).toMatchObject({ delta: -3, balanceAfter: 17, orderId: id });

    const cancel = await request.patch(`${API}/admin/orders/${id}/status`, { data: { status: "CANCELLED" }, headers: asBrowser });
    expect(cancel.ok()).toBeTruthy();
    const back = (await moves(request, lampId)).find((m) => m.reason === "CANCELLED")!;
    expect(back).toMatchObject({ delta: 3, balanceAfter: 20, orderId: id, note: "Order cancelled" });
  });

  test("an admin adds a warehouse; names and codes are unique and the main one stays", async ({ request }) => {
    const made = await post(request, "/admin/warehouses", { name: WH.name, code: WH.code, address: "12 Hub Road, Delhi" });
    expect(made.status()).toBe(201);
    delhi = ((await made.json()) as { id: string }).id;
    expect((await post(request, "/admin/warehouses", { name: WH.name, code: "OTHER1" })).status()).toBe(409);
    expect((await post(request, "/admin/warehouses", { name: "Other", code: "bad code!" })).status()).toBe(400);
    expect((await request.delete(`${API}/admin/warehouses/${mainId}`, { headers: asBrowser })).status()).toBe(400);
    expect((await request.put(`${API}/admin/warehouses/${mainId}`, { data: { name: "Main warehouse", code: "MAIN", active: false }, headers: asBrowser })).status()).toBe(400);
  });

  test("stock received into another warehouse adds to the total on sale", async ({ request }) => {
    expect((await post(request, "/admin/stock/receive", { productId: lampId, warehouseId: delhi, quantity: 10, note: "Supplier delivery" })).ok()).toBeTruthy();
    const [lvl] = (await levels(request, lampId)).items;
    expect([lvl.total, at(lvl, mainId), at(lvl, delhi)]).toEqual([30, 20, 10]);
    expect((await moves(request, lampId)).find((m) => m.reason === "RECEIVED" && m.warehouse?.name === WH.name)).toMatchObject({ delta: 10, balanceAfter: 30, note: "Supplier delivery" });
    const product = (await (await request.get(`${API}/admin/products/${lampId}`, { headers: asBrowser })).json()) as { stock: number };
    expect(product.stock).toBe(30);
  });

  test("moving stock changes where it is, not how much there is, and cannot move more than is there", async ({ request }) => {
    expect((await post(request, "/admin/stock/transfer", { productId: lampId, fromWarehouseId: mainId, toWarehouseId: delhi, quantity: 5 })).ok()).toBeTruthy();
    const [lvl] = (await levels(request, lampId)).items;
    expect([lvl.total, at(lvl, mainId), at(lvl, delhi)]).toEqual([30, 15, 15]);
    const moved = (await moves(request, lampId)).filter((m) => m.reason === "TRANSFER");
    expect(moved.map((m) => m.delta).sort((a, b) => a - b)).toEqual([-5, 5]);

    const tooMany = await post(request, "/admin/stock/transfer", { productId: lampId, fromWarehouseId: delhi, toWarehouseId: mainId, quantity: 99 });
    expect(tooMany.status()).toBe(400);
    expect(JSON.stringify(await tooMany.json())).toContain("Only 15");
    expect((await post(request, "/admin/stock/transfer", { productId: lampId, fromWarehouseId: delhi, toWarehouseId: delhi, quantity: 1 })).status()).toBe(400);
  });

  test("a sale takes from the main warehouse first and then from the others", async ({ request }) => {
    const id = await order(lampId, 16);
    const parts = (await moves(request, lampId)).filter((m) => m.reason === "SALE" && m.orderId === id);
    expect(parts.map((m) => [m.warehouse!.name, m.delta] as [string, number]).sort((a, b) => a[1] - b[1])).toEqual([["Main warehouse", -15], [WH.name, -1]]);
    const [lvl] = (await levels(request, lampId)).items;
    expect([lvl.total, at(lvl, mainId), at(lvl, delhi)]).toEqual([14, 0, 14]);
  });

  test("a count correction needs a reason and cannot take away more than the warehouse holds", async ({ request }) => {
    expect((await post(request, "/admin/stock/adjust", { productId: lampId, warehouseId: delhi, delta: -2 })).status()).toBe(400);
    const over = await post(request, "/admin/stock/adjust", { productId: lampId, warehouseId: delhi, delta: -50, note: "Recount" });
    expect(over.status()).toBe(400);
    expect(JSON.stringify(await over.json())).toContain("Only 14");
    expect((await post(request, "/admin/stock/adjust", { productId: lampId, warehouseId: delhi, delta: 0, note: "Nothing" })).status()).toBe(400);
    expect((await post(request, "/admin/stock/adjust", { productId: lampId, warehouseId: delhi, delta: -2, note: "Damaged in transit" })).ok()).toBeTruthy();
    const [lvl] = (await levels(request, lampId)).items;
    expect([lvl.total, at(lvl, delhi)]).toEqual([12, 12]);
    expect((await moves(request, lampId)).find((m) => m.reason === "ADJUSTMENT")).toMatchObject({ delta: -2, balanceAfter: 12, note: "Damaged in transit" });
  });

  test("changing the stock on the product page is recorded and keeps the warehouses right", async ({ request }) => {
    expect((await request.put(`${API}/admin/products/${lampId}`, { headers: asBrowser, data: lamp({ stock: 50 }) })).ok()).toBeTruthy();
    let [lvl] = (await levels(request, lampId)).items;
    expect([lvl.total, at(lvl, mainId), at(lvl, delhi)]).toEqual([50, 38, 12]);
    expect((await moves(request, lampId)).find((m) => m.reason === "EDIT")).toMatchObject({ delta: 38, balanceAfter: 50, actorName: "E2E Admin", note: "Product edited" });

    expect((await request.put(`${API}/admin/products/${lampId}`, { headers: asBrowser, data: lamp({ stock: 5 }) })).ok()).toBeTruthy();
    [lvl] = (await levels(request, lampId)).items;
    expect([lvl.total, at(lvl, mainId), at(lvl, delhi)]).toEqual([5, 0, 5]);
    const cuts = (await moves(request, lampId)).filter((m) => m.reason === "EDIT" && m.delta < 0);
    expect(cuts.map((m) => m.delta).sort((a, b) => a - b)).toEqual([-38, -7]);
  });

  test("a product with options keeps stock per option", async ({ request }) => {
    const missing = await post(request, "/admin/stock/receive", { productId: teeId, warehouseId: delhi, quantity: 4 });
    expect(missing.status()).toBe(400);
    expect(JSON.stringify(await missing.json())).toContain("Choose which option");
    expect((await post(request, "/admin/stock/receive", { productId: teeId, optionId: teeL, warehouseId: delhi, quantity: 4 })).ok()).toBeTruthy();

    const { items } = await levels(request, teeId);
    const l = items.find((i) => i.label === "L")!;
    const xl = items.find((i) => i.label === "XL")!;
    expect([l.total, at(l, mainId), at(l, delhi)]).toEqual([10, 6, 4]);
    expect([xl.total, at(xl, mainId), at(xl, delhi)]).toEqual([4, 4, 0]);

    await order(teeId, 2, teeL);
    const sale = (await moves(request, teeId)).find((m) => m.reason === "SALE")!;
    expect(sale).toMatchObject({ delta: -2, balanceAfter: 8, optionId: teeL });
  });

  test("a CSV import is recorded too", async ({ request }) => {
    const csv = `slug,stock\ne2e-stock-lamp,9\n`;
    const res = await request.post(`${API}/admin/products/import`, { data: csv, headers: { ...asBrowser, "content-type": "text/csv" } });
    expect(res.ok(), await res.text()).toBeTruthy();
    expect((await moves(request, lampId)).find((m) => m.reason === "IMPORT")).toMatchObject({ delta: 4, balanceAfter: 9, note: "CSV import" });
  });

  test("people who may only look can read warehouses and history but not change stock", async ({ request }) => {
    const users = async (name: string) => ((await (await request.get(`${API}/admin/users?q=${encodeURIComponent(name)}`, { headers: asBrowser })).json()) as { items: { id: string }[] }).items[0].id;
    // Staff from before roles existed keep the original access, which includes seeing stock.
    expect((await request.patch(`${API}/admin/users/${await users(`Vera Viewer ${stamp}`)}/role`, { data: { role: "STAFF" }, headers: asBrowser })).ok()).toBeTruthy();
    expect((await viewer.request.get(`${API}/admin/warehouses`, { headers: asBrowser })).status()).toBe(200);
    expect((await viewer.request.get(`${API}/admin/stock/movements`, { headers: asBrowser })).status()).toBe(200);
    expect((await viewer.request.post(`${API}/admin/stock/receive`, { data: { productId: lampId, warehouseId: mainId, quantity: 1 }, headers: asBrowser })).status()).toBe(403);
    expect((await viewer.request.post(`${API}/admin/warehouses`, { data: { name: "Nope", code: "NOPE" }, headers: asBrowser })).status()).toBe(403);

    const role = await request.post(`${API}/admin/roles`, { data: { name: `Stock keeper ${stamp}`, description: "", permissions: ["inventory.manage"] }, headers: asBrowser });
    expect(role.status()).toBe(201);
    const made = (await role.json()) as { id: string; permissions: string[] };
    expect(made.permissions).toEqual(expect.arrayContaining(["inventory.view", "products.view"]));
    expect((await request.patch(`${API}/admin/users/${await users(`Kim Keeper ${stamp}`)}/role`, { data: { role: "STAFF", staffRoleId: made.id }, headers: asBrowser })).ok()).toBeTruthy();
    expect((await keeper.request.post(`${API}/admin/stock/receive`, { data: { productId: lampId, warehouseId: mainId, quantity: 1, note: "Keeper delivery" }, headers: asBrowser })).ok()).toBeTruthy();
    expect((await moves(request, lampId)).find((m) => m.note === "Keeper delivery")).toMatchObject({ actorName: `Kim Keeper ${stamp}` });
  });

  test("on the Stock page an admin adds a warehouse, receives stock and reads the history", async ({ page }) => {
    await page.goto("/admin/stock");
    await expect(page.getByRole("heading", { name: "Stock & warehouses" })).toBeVisible();
    await expect(page.getByLabel(`Warehouse ${WH.name}`, { exact: true })).toBeVisible();

    const pune = `Pune hub ${stamp}`;
    await page.getByRole("button", { name: "+ Add warehouse" }).click();
    await page.getByLabel("Name", { exact: true }).fill(pune);
    await page.getByLabel("Code", { exact: true }).fill(`P${String(stamp).slice(-6)}`);
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByText("Warehouse added")).toBeVisible();
    await expect(page.getByLabel(`Warehouse ${pune}`, { exact: true })).toBeVisible();

    await page.getByLabel("Find a product").fill("E2E Stock Lamp");
    await page.getByRole("button", { name: "Find", exact: true }).click();
    await page.getByRole("button", { name: /E2E Stock Lamp/ }).click();
    const table = page.getByRole("table", { name: "Stock of E2E Stock Lamp" });
    await expect(table).toBeVisible();

    await pick(page.getByLabel("Warehouse", { exact: true }), { label: pune });
    await page.getByLabel("Units", { exact: true }).fill("7");
    await page.getByLabel("Note", { exact: true }).fill("Opening a new hub");
    await page.getByRole("button", { name: "Receive", exact: true }).click();
    await expect(page.getByText("Stock received")).toBeVisible();
    await expect(table.getByRole("row", { name: /All units/ })).toContainText("7");

    await page.getByText("Only E2E Stock Lamp").click();
    await expect(page.getByRole("row", { name: /Opening a new hub/ })).toContainText("+7");
    await pick(page.getByLabel("Filter by reason"), "SALE");
    await expect(page.getByRole("row", { name: /Opening a new hub/ })).toHaveCount(0);
    await expect(page.getByRole("row", { name: /Sold/ }).first()).toBeVisible();
  });

  test("the audit log records warehouse and stock actions", async ({ request }) => {
    const log = (await (await request.get(`${API}/admin/audit-log`, { headers: asBrowser })).json()) as { items: { action: string; summary: string }[] };
    for (const action of ["warehouse.create", "stock.receive", "stock.transfer", "stock.adjust"]) expect(log.items.find((e) => e.action === action), action).toBeTruthy();
  });
});
