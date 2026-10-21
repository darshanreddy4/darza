import { expect, test } from "@playwright/test";
import { API, AUTH_FILES } from "./data";
import { asBrowser } from "./helpers";

test.use({ storageState: AUTH_FILES.admin });

const csvHeaders = { ...asBrowser, "content-type": "text/csv" };
const HEADER = "slug,name,type,status,category,sku,price,stock,description,option_names,options";

type Admin = { id: string; pricePaise: number; mrpPaise: number | null; stock: number; optionNames: string[]; options: { id: string; label: string; pricePaise: number; stock: number; costPaise: number | null }[] };

test.describe.serial("options in the product spreadsheet", () => {
  let id = "";

  const product = async (request: import("@playwright/test").APIRequestContext) => {
    const list = (await (await request.get(`${API}/admin/products?q=e2e-csv-tee`, { headers: asBrowser })).json()) as { id: string; slug: string }[];
    id = list.find((p) => p.slug === "e2e-csv-tee")!.id;
    return (await (await request.get(`${API}/admin/products/${id}`, { headers: asBrowser })).json()) as Admin;
  };
  const upload = (request: import("@playwright/test").APIRequestContext, csv: string, query = "") => request.post(`${API}/admin/products/import${query}`, { data: csv, headers: csvHeaders });

  test.afterAll(async ({ playwright }) => {
    const ctx = await playwright.request.newContext({ storageState: AUTH_FILES.admin });
    if (id) await ctx.delete(`${API}/admin/products/${id}`, { headers: asBrowser });
    await ctx.dispose();
  });

  test("a new product can be created with named options, one per row of the cell", async ({ request }) => {
    const csv = [HEADER, "e2e-csv-tee,CSV Tee,OWN,PUBLISHED,electronics,CSV-TEE,1,0,A tee,Colour | Size,Black > L ; 499 ; 799 ; 3 | Black > XL ; 549 ; ; 0 | Blue > L ; 499 ; 799 ; 2 ; 300"].join("\n");
    const done = await (await upload(request, csv)).json();
    expect(done).toMatchObject({ applied: true, created: 1, errors: [] });
    const p = await product(request);
    expect(p.optionNames).toEqual(["Colour", "Size"]);
    expect(p.options.map((o) => [o.label, o.pricePaise, o.stock])).toEqual([["Black / L", 49900, 3], ["Black / XL", 54900, 0], ["Blue / L", 49900, 2]]);
    expect(p.options[2].costPaise).toBe(30000);
    // The product's own price and stock come from the options, not from the price and stock cells.
    expect(p).toMatchObject({ pricePaise: 49900, mrpPaise: 79900, stock: 5 });
  });

  test("the export writes the options back in the same form", async ({ request }) => {
    const text = await (await request.get(`${API}/admin/products/export`, { headers: asBrowser })).text();
    const row = text.split("\n").find((r) => r.startsWith("e2e-csv-tee,"))!;
    expect(row).toContain("Colour | Size");
    expect(row).toContain("Black > L ; 499.00 ; 799.00 ; 3");
    expect(row).toContain("Black > XL ; 549.00 ;  ; 0");
    expect(row).toContain("Blue > L ; 499.00 ; 799.00 ; 2 ; 300.00");
    expect(text.split("\n")[0].trim()).toMatch(/,option_names,options,weight_g$/);
  });

  test("importing the list again keeps the options it names, with their ids and cost, and drops the rest", async ({ request }) => {
    const before = await product(request);
    const ids = Object.fromEntries(before.options.map((o) => [o.label, o.id]));
    const csv = ["slug,options", "e2e-csv-tee,Black > L ; 450 ; 799 ; 3 | Blue > L ; 499 ; 799 ; 2"].join("\n");
    expect(await (await upload(request, csv)).json()).toMatchObject({ applied: true, updated: 1, errors: [] });
    const after = await product(request);
    expect(after.options.map((o) => [o.label, o.id, o.pricePaise])).toEqual([["Black / L", ids["Black / L"], 45000], ["Blue / L", ids["Blue / L"], 49900]]);
    // The cost was left blank in the sheet, so it stays.
    expect(after.options[1].costPaise).toBe(30000);
    expect(after).toMatchObject({ pricePaise: 45000, stock: 5 });
  });

  test("mistakes in the options cell are named and nothing is imported", async ({ request }) => {
    const bad = async (cell: string) => (await (await upload(request, ["slug,options", `e2e-csv-tee,${cell}`].join("\n"))).json()) as { applied: boolean; errors: { message: string }[] };
    const price = await bad("Black > L ; abc ; ; 3");
    expect(price.applied).toBe(false);
    expect(JSON.stringify(price.errors)).toContain('the price of \\"Black / L\\" must be an amount');
    expect(JSON.stringify((await bad("Black > L ; 499 ; ; many")).errors)).toContain("stock");
    expect(JSON.stringify((await bad("; 499 ; ; 3")).errors)).toContain("needs its values");
    // Two values for one kind, or a second kind without a name, is refused by the same rules as the admin form.
    expect((await bad("Black > L > Cotton ; 499 ; ; 3")).applied).toBe(false);
    expect((await product(request)).options).toHaveLength(2);
  });

  test("a dash removes all the options and leaves a plain product", async ({ request }) => {
    expect(await (await upload(request, ["slug,options", "e2e-csv-tee,-"].join("\n"))).json()).toMatchObject({ applied: true, errors: [] });
    const p = await product(request);
    expect(p.options).toEqual([]);
    expect(p.optionNames).toEqual([]);
    expect(p).toMatchObject({ pricePaise: 45000, stock: 5 });
  });
});
