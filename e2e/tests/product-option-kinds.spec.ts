import { expect, test, type BrowserContext } from "@playwright/test";
import { API, AUTH_FILES, money } from "./data";
import { asBrowser, newCustomer } from "./helpers";

test.use({ storageState: AUTH_FILES.admin });

const shipping = { name: "Shirt Buyer", phone: "9876500044", line1: "44 Cloth Road", city: "Pune", state: "Maharashtra", pincode: "411001" };

type Opt = { id: string; label: string; values: string[]; pricePaise: number; stock: number };
type Admin = { id: string; optionNames: string[]; stock: number; pricePaise: number; options: Opt[] };

test.describe.serial("options named by the admin", () => {
  let categoryId = "";
  let teeId = "";
  let chargerId = "";
  let buyer: BrowserContext;
  const black = "https://example.com/e2e-black.jpg";
  const blue = "https://example.com/e2e-blue.jpg";

  const base = (over: Record<string, unknown>) => ({ description: "Options test.", categoryId, productType: "OWN", status: "PUBLISHED", images: [], pricePaise: 1, stock: 0, ...over });
  const admin = async (request: import("@playwright/test").APIRequestContext, id: string) => (await (await request.get(`${API}/admin/products/${id}`, { headers: asBrowser })).json()) as Admin;

  test.beforeAll(async ({ browser, request }) => {
    const cats = (await (await request.get(`${API}/admin/categories`, { headers: asBrowser })).json()) as { id: string }[];
    categoryId = cats[0].id;
    const tee = await request.post(`${API}/admin/products`, {
      headers: asBrowser,
      data: base({
        name: "E2E Cotton Tee", slug: "e2e-cotton-tee", sku: "E2E-TEE", images: [{ url: black }, { url: blue }], optionNames: ["Colour", "Size"],
        options: [
          { values: ["Black", "L"], pricePaise: 49900, mrpPaise: 79900, stock: 3, imageUrl: black },
          { values: ["Black", "XL"], pricePaise: 54900, stock: 0, imageUrl: black },
          { values: ["Blue", "L"], pricePaise: 49900, stock: 2, imageUrl: blue },
          { values: ["Blue", "XL"], pricePaise: 54900, stock: 5, imageUrl: blue },
        ],
      }),
    });
    expect(tee.ok(), await tee.text()).toBeTruthy();
    teeId = ((await tee.json()) as { id: string }).id;
    const charger = await request.post(`${API}/admin/products`, {
      headers: asBrowser,
      data: base({ name: "E2E Fast Charger", slug: "e2e-fast-charger", sku: "E2E-CHG", optionNames: ["Wattage"], options: [{ values: ["20W"], pricePaise: 79900, stock: 4 }, { values: ["40W"], pricePaise: 129900, stock: 6 }] }),
    });
    expect(charger.ok(), await charger.text()).toBeTruthy();
    chargerId = ((await charger.json()) as { id: string }).id;
    buyer = await newCustomer(browser, "Shirt Buyer");
  });

  test.afterAll(async ({ request }) => {
    await buyer.close();
    for (const [id, slug, sku] of [[teeId, "e2e-cotton-tee", "E2E-TEE"], [chargerId, "e2e-fast-charger", "E2E-CHG"]]) {
      const p = await admin(request, id);
      await request.put(`${API}/admin/products/${id}`, { data: base({ name: slug, slug, sku, status: "DRAFT", optionNames: p.optionNames, options: p.options.map((o) => ({ id: o.id, values: o.values, pricePaise: o.pricePaise, stock: o.stock })) }), headers: asBrowser });
    }
  });

  test("two named kinds give one option for every combination, stored with a readable label", async ({ request }) => {
    const p = await admin(request, teeId);
    expect(p).toMatchObject({ optionNames: ["Colour", "Size"], pricePaise: 49900, stock: 10 });
    expect(p.options.map((o) => o.label)).toEqual(["Black / L", "Black / XL", "Blue / L", "Blue / XL"]);
    const pub = (await (await request.get(`${API}/products/e2e-cotton-tee`)).json()) as { optionNames: string[]; options: { values: string[]; imageUrl: string | null }[] };
    expect(pub.optionNames).toEqual(["Colour", "Size"]);
    expect(pub.options[2]).toMatchObject({ values: ["Blue", "L"], imageUrl: blue });
  });

  test("a second kind needs a name, a value for each kind and no repeats", async ({ request }) => {
    const post = (over: Record<string, unknown>) => request.post(`${API}/admin/products`, { headers: asBrowser, data: base({ name: "E2E Bad Tee", slug: "e2e-bad-tee", sku: "E2E-BADTEE", ...over }) });
    const unnamed = await post({ options: [{ values: ["Black", "L"], pricePaise: 100, stock: 1 }] });
    expect(unnamed.status()).toBe(400);
    expect(await unnamed.text()).toContain("Name what the customer chooses");
    const missing = await post({ optionNames: ["Colour", "Size"], options: [{ values: ["Black"], pricePaise: 100, stock: 1 }] });
    expect(missing.status()).toBe(400);
    const three = await post({ optionNames: ["A", "B", "C"], options: [{ values: ["1", "2", "3"], pricePaise: 100, stock: 1 }] });
    expect(three.status()).toBe(400);
    const twice = await post({ optionNames: ["Size"], options: [{ values: ["L"], pricePaise: 100, stock: 1 }, { values: ["l"], pricePaise: 100, stock: 1 }] });
    expect(twice.status()).toBe(400);
  });

  test("the page asks for each kind, keeps choices that still exist and shows the picture and price of the choice", async ({ page }) => {
    await page.goto("/products/e2e-cotton-tee");
    const price = page.getByTestId("option-price");
    // Starts on the first option in stock.
    await expect(page.getByRole("radiogroup", { name: "Colour" }).getByRole("radio", { name: "Black" })).toHaveAttribute("aria-checked", "true");
    await expect(page.getByRole("radiogroup", { name: "Size" }).getByRole("radio", { name: "L", exact: true })).toHaveAttribute("aria-checked", "true");
    await expect(price).toHaveText(money(49900));
    await expect(page.getByText("Save 38%")).toBeVisible();

    // Black in XL is sold out: the size stays pickable (Blue has it), the price is the XL price and buying is off.
    await page.getByRole("radiogroup", { name: "Size" }).getByRole("radio", { name: /^XL/ }).click();
    await expect(price).toHaveText(money(54900));
    await expect(page.getByRole("button", { name: "Out of stock" })).toBeDisabled();

    // Choosing Blue keeps XL, which Blue has in stock.
    await page.getByRole("radiogroup", { name: "Colour" }).getByRole("radio", { name: "Blue" }).click();
    await expect(page.getByRole("radiogroup", { name: "Size" }).getByRole("radio", { name: /^XL/ })).toHaveAttribute("aria-checked", "true");
    await expect(page.getByRole("button", { name: "Add to Cart" })).toBeEnabled();
    await expect(page.getByTestId("option-price")).toHaveText(money(54900));
  });

  test("the cart names each choice and an order records the option and takes its stock", async ({ page, request }) => {
    await page.goto("/products/e2e-cotton-tee");
    await page.getByRole("radiogroup", { name: "Colour" }).getByRole("radio", { name: "Blue" }).click();
    await page.getByRole("radiogroup", { name: "Size" }).getByRole("radio", { name: /^XL/ }).click();
    await page.getByRole("button", { name: "Add to Cart" }).click();
    await page.goto("/cart");
    const row = page.getByRole("listitem").filter({ hasText: "E2E Cotton Tee" });
    await expect(row).toContainText("Colour: Blue, Size: XL");
    await expect(row).toContainText(money(54900));
    await page.evaluate(() => localStorage.removeItem("dmg-cart"));

    const blueXl = (await admin(request, teeId)).options.find((o) => o.label === "Blue / XL")!;
    const res = await buyer.request.post(`${API}/orders`, { data: { items: [{ productId: teeId, optionId: blueXl.id, quantity: 2 }], shipping, paymentMethod: "COD" }, headers: asBrowser });
    expect(res.status(), await res.text()).toBe(201);
    const { order } = (await res.json()) as { order: { items: { optionLabel: string; pricePaise: number }[] } };
    expect(order.items[0]).toMatchObject({ optionLabel: "Blue / XL", pricePaise: 54900 });
    const after = await admin(request, teeId);
    expect(after.options.find((o) => o.label === "Blue / XL")!.stock).toBe(3);
    expect(after.stock).toBe(8);
  });

  test("any wording works for the options of a product: wattage here", async ({ page }) => {
    await page.goto("/products/e2e-fast-charger");
    await expect(page.getByRole("radiogroup", { name: "Wattage" })).toBeVisible();
    await page.getByRole("radio", { name: "40W" }).click();
    await expect(page.getByTestId("option-price")).toHaveText(money(129900));
  });

  test("the admin form names the kind, creates rows from a list and saves", async ({ page, request }) => {
    await page.goto(`/admin/products/${chargerId}`);
    await expect(page.getByLabel("What does the customer choose?")).toHaveValue("Wattage");
    await page.getByLabel("What does the customer choose?").fill("Output");
    await page.getByLabel("Output values to add").fill("65W, 100W, 20W");
    await page.getByRole("button", { name: "Create rows" }).click();
    // 20W already exists, so only two rows are new.
    await expect(page.getByLabel("Option 3 Output")).toHaveValue("65W");
    await expect(page.getByLabel("Option 4 Output")).toHaveValue("100W");
    await expect(page.getByLabel("Option 5 Output")).toHaveCount(0);
    await page.getByLabel("Option 3 price").fill("1999");
    await page.getByLabel("Option 3 stock").fill("2");
    await page.getByLabel("Option 4 price").fill("2999");
    await page.getByLabel("Option 4 stock").fill("1");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page).toHaveURL(/\/admin\/products$/);

    const p = await admin(request, chargerId);
    expect(p.optionNames).toEqual(["Output"]);
    expect(p.options.map((o) => [o.label, o.pricePaise, o.stock])).toEqual([["20W", 79900, 4], ["40W", 129900, 6], ["65W", 199900, 2], ["100W", 299900, 1]]);
    expect(p.stock).toBe(13);
    expect(p.pricePaise).toBe(79900);
  });

  test("the admin form adds a second kind and the combinations", async ({ page, request }) => {
    await page.goto(`/admin/products/${chargerId}`);
    await page.getByLabel("A second choice").fill("Cable");
    for (let n = 1; n <= 4; n++) await page.getByLabel(`Option ${n} Cable`).fill(n % 2 ? "USB-C" : "Lightning");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page).toHaveURL(/\/admin\/products$/);
    const p = await admin(request, chargerId);
    expect(p.optionNames).toEqual(["Output", "Cable"]);
    expect(p.options.map((o) => o.label)).toEqual(["20W / USB-C", "40W / Lightning", "65W / USB-C", "100W / Lightning"]);
  });
});
