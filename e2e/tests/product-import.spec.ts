import { expect, test } from "@playwright/test";
import { API, AUTH_FILES } from "./data";
import { adminProduct, asBrowser } from "./helpers";

test.use({ storageState: AUTH_FILES.admin });

const HEADER = "slug,name,type,status,category,sku,price,stock,gst_percent,highlights,description";
const csvHeaders = { ...asBrowser, "content-type": "text/csv" };

test.describe.serial("product CSV import and export", () => {
  test.afterAll(async ({ playwright }) => {
    const ctx = await playwright.request.newContext({ storageState: AUTH_FILES.admin });
    for (const slug of ["e2e-csv-mug", "e2e-csv-flask", "e2e-csv-ui"]) {
      const list = await (await ctx.get(`${API}/admin/products?q=${slug}`, { headers: asBrowser })).json() as { id: string; slug: string }[];
      for (const p of list.filter((x) => x.slug === slug)) await ctx.delete(`${API}/admin/products/${p.id}`, { headers: asBrowser });
    }
    await ctx.dispose();
  });

  test("the export lists every product with prices in rupees", async ({ request }) => {
    const res = await request.get(`${API}/admin/products/export`, { headers: asBrowser });
    expect(res.status()).toBe(200);
    expect(res.headers()["content-disposition"]).toMatch(/products-\d{4}-\d{2}-\d{2}\.csv/);
    const text = await res.text();
    expect(text.startsWith("\uFEFFslug,name,type,status,category,brand,sku,price")).toBe(true);
    expect(text).toContain("e2e-power-bank,E2E Power Bank 10000mAh,OWN,PUBLISHED,electronics");
    expect(text).toContain(",1499.00,");
  });

  test("a file with mistakes imports nothing and names each problem", async ({ request }) => {
    const csv = [HEADER,
      "e2e-csv-mug,Mug,OWN,PUBLISHED,electronics,CSV-1,299,10,18,Sturdy,A mug",
      "Bad Slug,Mug,OWN,PUBLISHED,electronics,CSV-2,299,10,18,,A mug",
      "e2e-csv-flask,Flask,OWN,PUBLISHED,no-such-category,CSV-3,499,10,18,,A flask",
      "e2e-csv-flask,Flask again,OWN,PUBLISHED,electronics,CSV-4,499,10,18,,A flask",
      "e2e-csv-nosku,Thing,OWN,PUBLISHED,electronics,,499,10,18,,No sku given",
    ].join("\r\n");
    const res = await request.post(`${API}/admin/products/import`, { data: csv, headers: csvHeaders });
    expect(res.status()).toBe(201);
    const report = await res.json();
    expect(report.applied).toBe(false);
    const text = JSON.stringify(report.errors);
    expect(text).toContain("slug may only use lowercase");
    expect(text).toContain('category \\"no-such-category\\" does not exist');
    expect(text).toContain("appears more than once");
    expect(text).toContain("OWN products require a sku");
    expect(report.errors.find((e: { slug: string }) => e.slug === "bad slug" || e.slug === "Bad Slug")?.row).toBe(3);

    const list = await (await request.get(`${API}/admin/products?q=e2e-csv-mug`, { headers: asBrowser })).json();
    expect(list).toHaveLength(0);
  });

  test("a good file creates products, and importing again updates them", async ({ request }) => {
    const create = [HEADER,
      'e2e-csv-mug,CSV Mug,OWN,PUBLISHED,electronics,CSV-1,299,10,18,Sturdy | Dishwasher safe,"A mug, with a handle"',
      "e2e-csv-flask,CSV Flask,OWN,DRAFT,electronics,CSV-2,499.50,4,12,,A flask",
    ].join("\n");
    const dry = await (await request.post(`${API}/admin/products/import?dryRun=true`, { data: create, headers: csvHeaders })).json();
    expect(dry).toMatchObject({ dryRun: true, applied: false, created: 2, updated: 0, errors: [] });
    expect(await (await request.get(`${API}/admin/products?q=e2e-csv-mug`, { headers: asBrowser })).json()).toHaveLength(0);

    const done = await (await request.post(`${API}/admin/products/import`, { data: create, headers: csvHeaders })).json();
    expect(done).toMatchObject({ applied: true, created: 2, updated: 0 });
    const mug = await adminProduct(request, "e2e-csv-mug");
    expect(mug.pricePaise).toBe(29900);
    expect(mug.stock).toBe(10);
    const flask = await adminProduct(request, "e2e-csv-flask");
    expect(flask.pricePaise).toBe(49950);

    const update = ["slug,price,stock", "e2e-csv-mug,349,3", "e2e-csv-flask,,7"].join("\n");
    const again = await (await request.post(`${API}/admin/products/import`, { data: update, headers: csvHeaders })).json();
    expect(again).toMatchObject({ applied: true, created: 0, updated: 2 });
    const after = await adminProduct(request, "e2e-csv-mug");
    expect(after).toMatchObject({ pricePaise: 34900, stock: 3 });
    // A blank price cell leaves the old price in place.
    expect(await adminProduct(request, "e2e-csv-flask")).toMatchObject({ pricePaise: 49950, stock: 7 });

    const detail = await (await request.get(`${API}/admin/products/${mug.id}`, { headers: asBrowser })).json();
    expect(detail.highlights).toEqual(["Sturdy", "Dishwasher safe"]);
    expect(detail.description).toBe("A mug, with a handle");
  });

  test("a SKU already used by another product is refused", async ({ request }) => {
    const report = await (await request.post(`${API}/admin/products/import`, { data: ["slug,sku", "e2e-csv-flask,CSV-1"].join("\n"), headers: csvHeaders })).json();
    expect(report.applied).toBe(false);
    expect(JSON.stringify(report.errors)).toContain("SKU CSV-1 is already used by e2e-csv-mug");
  });

  test("unknown columns and a missing slug column are explained", async ({ request }) => {
    const unknown = await request.post(`${API}/admin/products/import`, { data: "slug,colour\nx,red", headers: csvHeaders });
    expect(unknown.status()).toBe(400);
    expect(JSON.stringify(await unknown.json())).toContain("Unknown column: colour");
    const noSlug = await request.post(`${API}/admin/products/import`, { data: "name\nMug", headers: csvHeaders });
    expect(noSlug.status()).toBe(400);
  });

  test("only admins can import or export", async ({ browser }) => {
    const customer = await browser.newContext({ storageState: AUTH_FILES.customer });
    expect((await customer.request.get(`${API}/admin/products/export`, { headers: asBrowser })).status()).toBe(403);
    expect((await customer.request.post(`${API}/admin/products/import`, { data: "slug\nx", headers: csvHeaders })).status()).toBe(403);
    await customer.close();
  });

  test("the admin page checks a file, then imports it", async ({ page }) => {
    await page.goto("/admin/products");
    await page.getByRole("button", { name: "Import CSV" }).click();

    const bad = "slug,name,type,category,sku,price,stock,description\ne2e-csv-ui,CSV UI,OWN,nowhere,UI-1,100,1,Nope";
    await page.getByLabel("CSV file").setInputFiles({ name: "bad.csv", mimeType: "text/csv", buffer: Buffer.from(bad) });
    await expect(page.getByText(/1 problem found\. Nothing was imported/)).toBeVisible();
    await expect(page.getByText(/Row 2 \(e2e-csv-ui\): category "nowhere" does not exist/)).toBeVisible();
    await expect(page.getByRole("button", { name: /^Import \d+ products$/ })).toHaveCount(0);

    const good = "slug,name,type,status,category,sku,price,stock,description\ne2e-csv-ui,CSV UI Product,OWN,PUBLISHED,electronics,UI-1,100,1,Imported from the admin page";
    await page.getByLabel("CSV file").setInputFiles({ name: "good.csv", mimeType: "text/csv", buffer: Buffer.from(good) });
    await expect(page.getByText(/The file looks good\. 1 rows: 1 new, 0 updated\./)).toBeVisible();
    await page.getByRole("button", { name: "Import 1 products" }).click();
    await expect(page.getByText("Imported 1 products (1 new, 0 updated)")).toBeVisible();
    await expect(page.getByRole("row", { name: /CSV UI Product/ })).toBeVisible();
  });

  test("the export button downloads the file", async ({ page }) => {
    await page.goto("/admin/products");
    const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Export CSV" }).click()]);
    expect(download.suggestedFilename()).toMatch(/^products-\d{4}-\d{2}-\d{2}\.csv$/);
    expect((await import("fs")).readFileSync(await download.path(), "utf8")).toContain("e2e-csv-ui");
  });
});
