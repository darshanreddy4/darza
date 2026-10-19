import { expect, test, type APIRequestContext, type BrowserContext } from "@playwright/test";
import { API, AUTH_FILES, WEB } from "./data";
import { asBrowser, newCustomer, pick, withDb } from "./helpers";

test.use({ storageState: AUTH_FILES.admin, viewport: { width: 1280, height: 900 } });

const signedOut = { cookies: [], origins: [] };
const shipping = { name: "Rule Buyer", phone: "9876500031", line1: "31 Rule Road", city: "Pune", state: "Maharashtra", pincode: "411001" };
// A 1x1 PNG and the smallest thing that looks like an MP4 file.
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
const MP4 = Buffer.from("0000001866747970 6d703432 00000000 6d703432 69736f6d".replace(/ /g, ""), "hex");
const ids: Record<string, string> = {};

test.describe.serial("PIN codes, return rules, pack sizes and review photos", () => {
  let categoryId = "";
  let buyer: BrowserContext;

  const dto = (over: Record<string, unknown>) => ({
    description: "Used to test the product page.", categoryId, productType: "OWN", status: "PUBLISHED", images: [], pricePaise: 49900, stock: 30, ...over,
  });
  const create = async (request: APIRequestContext, slug: string, over: Record<string, unknown> = {}) => {
    const res = await request.post(`${API}/admin/products`, { data: dto({ name: `E2E ${slug}`, slug, sku: slug.toUpperCase(), ...over }), headers: asBrowser });
    expect(res.ok(), await res.text()).toBeTruthy();
    ids[slug] = (await res.json()).id;
  };
  const publicProduct = async (request: APIRequestContext, slug: string) => (await (await request.get(`${API}/products/${slug}`)).json()) as Record<string, unknown>;

  test.beforeAll(async ({ browser, request }) => {
    const cats = (await (await request.get(`${API}/admin/categories`, { headers: asBrowser })).json()) as { id: string }[];
    categoryId = cats[0].id;
    await create(request, "e2e-rule-none", { returnDays: 0, deliveryDays: 3, packSize: "1 piece" });
    await create(request, "e2e-rule-default", { packSize: "500 g" });
    await create(request, "e2e-rule-text", { returnPolicy: "No return" });
    await create(request, "e2e-rule-days", { returnDays: 3, freeDelivery: true, deliveryDays: 2, warranty: "1 year" });
    buyer = await newCustomer(browser, "Rule Buyer");
  });

  test.afterAll(async ({ request }) => {
    await buyer.close();
    for (const [slug, id] of Object.entries(ids)) {
      const res = await request.put(`${API}/admin/products/${id}`, { data: dto({ name: `E2E ${slug}`, slug, sku: slug.toUpperCase(), status: "DRAFT" }), headers: asBrowser });
      if (!res.ok()) await request.delete(`${API}/admin/products/${id}`, { headers: asBrowser });
    }
  });

  // ---------- PIN codes ----------

  test("the PIN code lookup says where a PIN code is and refuses ones that cannot exist", async ({ request }) => {
    const ok = (await (await request.get(`${API}/pincode/411001`)).json()) as { valid: boolean; state: string; states: string[] };
    expect(ok).toMatchObject({ valid: true, state: "Maharashtra", states: ["Maharashtra"] });
    for (const bad of ["100001", "12345", "000000", "41100a", "4110011"]) expect(((await (await request.get(`${API}/pincode/${bad}`)).json()) as { valid: boolean }).valid, bad).toBe(false);
    expect(((await (await request.get(`${API}/pincode/12345`)).json()) as { reason: string }).reason).toBe("format");
    expect(((await (await request.get(`${API}/pincode/100001`)).json()) as { reason: string }).reason).toBe("unknown");
  });

  test("orders and saved addresses are refused for a PIN code that does not exist", async () => {
    const order = await buyer.request.post(`${API}/orders`, { data: { items: [{ productId: ids["e2e-rule-default"], quantity: 1 }], shipping: { ...shipping, pincode: "100001" }, paymentMethod: "COD" }, headers: asBrowser });
    expect(order.status()).toBe(400);
    expect(await order.text()).toContain("couldn't find PIN code 100001");
    const short = await buyer.request.post(`${API}/orders`, { data: { items: [{ productId: ids["e2e-rule-default"], quantity: 1 }], shipping: { ...shipping, pincode: "41100" }, paymentMethod: "COD" }, headers: asBrowser });
    expect(short.status()).toBe(400);
    const address = { name: "A", phone: "9876500031", line1: "1 Road", city: "Pune", state: "Maharashtra" };
    expect((await buyer.request.post(`${API}/addresses`, { data: { ...address, pincode: "100001" }, headers: asBrowser })).status()).toBe(400);
    const saved = await buyer.request.post(`${API}/addresses`, { data: { ...address, pincode: "411001" }, headers: asBrowser });
    expect(saved.ok(), await saved.text()).toBeTruthy();
  });

  test("a visitor can check delivery to their PIN code on a product page, and it is remembered", async ({ browser }) => {
    const ctx = await browser.newContext({ baseURL: WEB, storageState: signedOut });
    const page = await ctx.newPage();
    await page.goto("/products/e2e-rule-none");
    const box = page.getByRole("region", { name: "Delivery to your PIN code" });
    await box.getByRole("textbox", { name: "PIN code" }).fill("123");
    await box.getByRole("button", { name: "Check" }).click();
    await expect(box.getByRole("alert")).toHaveText("Enter a valid 6-digit PIN code.");
    await box.getByRole("textbox", { name: "PIN code" }).fill("100001");
    await box.getByRole("button", { name: "Check" }).click();
    await expect(box.getByRole("alert")).toContainText("couldn't find PIN code 100001");

    await box.getByRole("textbox", { name: "PIN code" }).fill("560001");
    await box.getByRole("button", { name: "Check" }).click();
    await expect(box).toContainText("We deliver to Karnataka");
    await expect(box).toContainText("PIN 560001");
    await expect(box).toContainText("Delivery by");

    // Another product remembers the PIN code and checks it again by itself.
    await page.goto("/products/e2e-rule-days");
    await expect(page.getByRole("region", { name: "Delivery to your PIN code" })).toContainText("We deliver to Karnataka");
    await expect(page.getByRole("region", { name: "Delivery to your PIN code" })).toContainText("FREE delivery");
    await page.getByRole("button", { name: "Change" }).click();
    await expect(page.getByRole("textbox", { name: "PIN code" })).toBeVisible();
    await ctx.close();
  });

  test("the checkout address checks the PIN code while it is typed", async ({ browser }) => {
    const ctx = await browser.newContext({ baseURL: WEB, storageState: AUTH_FILES.customer });
    const page = await ctx.newPage();
    await page.goto("/products/e2e-rule-default");
    await page.getByRole("button", { name: "Add to Cart" }).click();
    await page.goto("/checkout");
    // Saved addresses load after the page does; wait for either them or the address form.
    const choose = page.getByRole("radio", { name: /different address/ });
    const stateBox = page.getByRole("button", { name: "State" });
    await expect(choose.or(stateBox)).toBeVisible();
    if (await choose.isVisible()) await choose.click();
    await pick(page.getByRole("button", { name: "State" }), "Kerala");
    const pin = page.getByPlaceholder("Pincode");
    await pin.fill("100001");
    await expect(page.getByRole("alert").filter({ hasText: "couldn't find this PIN code" })).toBeVisible();
    expect(await pin.evaluate((el: HTMLInputElement) => el.validity.customError)).toBe(true);

    await pin.fill("411001");
    await expect(page.getByText("This PIN code is in Maharashtra, not Kerala")).toBeVisible();
    expect(await pin.evaluate((el: HTMLInputElement) => el.validity.valid)).toBe(true);

    await pin.fill("41100x");
    await expect(pin).toHaveValue("41100");
    await ctx.close();
  });

  // ---------- return rules ----------

  test("each product says whether it can be returned: its own setting, then its text, then the store's window", async ({ request }) => {
    expect((await publicProduct(request, "e2e-rule-none")).returnDays).toBe(0);
    expect((await publicProduct(request, "e2e-rule-text")).returnDays).toBe(0);
    expect((await publicProduct(request, "e2e-rule-days")).returnDays).toBe(3);
    expect((await publicProduct(request, "e2e-rule-default")).returnDays).toBe(7);
  });

  test("the return icon on the product page follows the rule", async ({ page }) => {
    const strip = page.getByRole("list", { name: "Buying with confidence" });
    await page.goto("/products/e2e-rule-none");
    await expect(strip).toContainText("No returns");
    await expect(strip).not.toContainText("-day returns");

    await page.goto("/products/e2e-rule-text");
    await expect(strip).toContainText("No returns");
    await expect(page.locator("dl").getByText("No return", { exact: true }).first()).toBeVisible();

    await page.goto("/products/e2e-rule-days");
    await expect(strip).toContainText("3-day returns");
    await expect(strip.getByText("Free delivery", { exact: true })).toBeVisible();
    await expect(strip).toContainText("1 year");

    await page.goto("/products/e2e-rule-default");
    await expect(strip).toContainText("7-day returns");
    await expect(strip).not.toContainText("No returns");
    await expect(strip.getByText("Free delivery", { exact: true })).toHaveCount(0);
    await expect(page.locator("dl").getByText("7-day returns after delivery").first()).toBeVisible();
  });

  test("the cart says which items cannot be returned", async ({ page, request }) => {
    const quote = (await (await request.post(`${API}/checkout/quote`, { data: { items: [{ productId: ids["e2e-rule-none"], quantity: 1 }, { productId: ids["e2e-rule-default"], quantity: 1 }] }, headers: asBrowser })).json()) as { lines: { productId: string; returnDays: number }[] };
    expect(quote.lines.find((l) => l.productId === ids["e2e-rule-none"])?.returnDays).toBe(0);
    expect(quote.lines.find((l) => l.productId === ids["e2e-rule-default"])?.returnDays).toBe(7);
    await page.goto("/");
    await page.evaluate(({ a, b }) => localStorage.setItem("dmg-cart", JSON.stringify([
      { productId: a, slug: "e2e-rule-none", name: "E2E e2e-rule-none", image: null, pricePaise: 49900, quantity: 1 },
      { productId: b, slug: "e2e-rule-default", name: "E2E e2e-rule-default", image: null, pricePaise: 49900, quantity: 1 }])), { a: ids["e2e-rule-none"], b: ids["e2e-rule-default"] });
    await page.goto("/cart");
    await expect(page.getByText("No returns on this item")).toHaveCount(1);
  });

  test("after shipping, a non-returnable item cannot be returned, and the order keeps that rule", async ({ request }) => {
    const placed = await buyer.request.post(`${API}/orders`, { data: { items: [{ productId: ids["e2e-rule-none"], quantity: 1 }, { productId: ids["e2e-rule-default"], quantity: 1 }], shipping, paymentMethod: "COD" }, headers: asBrowser });
    expect(placed.status(), await placed.text()).toBe(201);
    const orderId = ((await placed.json()) as { order: { id: string } }).order.id;
    for (const status of ["SHIPPED", "DELIVERED"]) expect((await request.patch(`${API}/admin/orders/${orderId}/status`, { data: { status }, headers: asBrowser })).ok()).toBeTruthy();

    const mine = async () => {
      const list = (await (await buyer.request.get(`${API}/orders`, { headers: asBrowser })).json()) as { id: string; returnableUntil: string | null; items: { returnableQty: number; returnWindowDays: number; product: { slug: string } }[] }[];
      return list.find((o) => o.id === orderId)!;
    };
    const order = await mine();
    expect(order.returnableUntil).not.toBeNull();
    expect(order.items.find((i) => i.product.slug === "e2e-rule-none")).toMatchObject({ returnableQty: 0, returnWindowDays: 0 });
    expect(order.items.find((i) => i.product.slug === "e2e-rule-default")).toMatchObject({ returnableQty: 1, returnWindowDays: 7 });

    const item = (slug: string) => ((order.items as unknown as { id: string; product: { slug: string } }[]).find((i) => i.product.slug === slug)!).id;
    const asked = await buyer.request.post(`${API}/orders/${orderId}/return`, { data: { reason: "Changed my mind", upiId: "buyer@okbank", items: [{ orderItemId: item("e2e-rule-none"), quantity: 1 }] }, headers: asBrowser });
    expect(asked.status()).toBe(400);
    expect(await asked.text()).toContain("sold as non-returnable");

    // Changing the product afterwards does not change an order that is already placed.
    await request.put(`${API}/admin/products/${ids["e2e-rule-none"]}`, { data: dto({ name: "E2E e2e-rule-none", slug: "e2e-rule-none", sku: "E2E-RULE-NONE", returnDays: 30 }), headers: asBrowser });
    expect((await buyer.request.post(`${API}/orders/${orderId}/return`, { data: { reason: "Changed my mind", upiId: "buyer@okbank", items: [{ orderItemId: item("e2e-rule-none"), quantity: 1 }] }, headers: asBrowser })).status()).toBe(400);
    expect((await publicProduct(request, "e2e-rule-none")).returnDays).toBe(30);

    // The item that allows returns can still go back.
    const ok = await buyer.request.post(`${API}/orders/${orderId}/return`, { data: { reason: "Changed my mind", upiId: "buyer@okbank" }, headers: asBrowser });
    expect(ok.status(), await ok.text()).toBe(201);
    expect(((await ok.json()) as { items: unknown[] }).items).toHaveLength(1);
  });

  test("the customer's order list marks a non-returnable item", async ({ browser }) => {
    const page = await buyer.newPage();
    await page.goto("/orders");
    await expect(page.getByText("Non-returnable").first()).toBeVisible();
    await page.close();
    void browser;
  });

  test("the admin form saves a product's return rule", async ({ page, request }) => {
    await page.goto(`/admin/products/${ids["e2e-rule-default"]}`);
    await pick(page.getByRole("button", { name: "Returns" }), "none");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page).toHaveURL(/\/admin\/products$/);
    expect((await publicProduct(request, "e2e-rule-default")).returnDays).toBe(0);

    await page.goto(`/admin/products/${ids["e2e-rule-default"]}`);
    await pick(page.getByRole("button", { name: "Returns" }), "days");
    await page.getByLabel("Return days").fill("12");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page).toHaveURL(/\/admin\/products$/);
    expect((await publicProduct(request, "e2e-rule-default")).returnDays).toBe(12);
  });

  // ---------- pack sizes ----------

  test("pack sizes are chosen by what the product is: pieces, volume or weight", async ({ page, request }) => {
    const set = async (kind: RegExp, fill?: { amount?: string; unit?: string; custom?: string }) => {
      await page.goto(`/admin/products/${ids["e2e-rule-days"]}`);
      await pick(page.getByRole("button", { name: "Measured in" }), { label: kind });
      if (fill?.amount) await page.getByLabel("Pack amount").fill(fill.amount);
      if (fill?.unit) await pick(page.getByRole("button", { name: "Unit" }), fill.unit);
      if (fill?.custom) await page.getByLabel("Pack size text").fill(fill.custom);
      await page.getByRole("button", { name: "Save changes" }).click();
      await expect(page).toHaveURL(/\/admin\/products$/);
      return (await publicProduct(request, "e2e-rule-days")).packSize;
    };
    expect(await set(/^Quantity/, { amount: "1" })).toBe("1 piece");
    expect(await set(/^Quantity/, { amount: "3" })).toBe("3 pieces");
    expect(await set(/^Volume/, { amount: "100", unit: "ml" })).toBe("100 ml");
    expect(await set(/^Volume/, { amount: "2", unit: "L" })).toBe("2 L");
    expect(await set(/^Weight/, { amount: "500", unit: "g" })).toBe("500 g");
    expect(await set(/^Weight/, { amount: "1.5", unit: "kg" })).toBe("1.5 kg");
    expect(await set(/^Something else/, { custom: "600 ml, 800 ml" })).toBe("600 ml, 800 ml");
    // An old pack size comes back into the right boxes.
    await page.goto(`/admin/products/${ids["e2e-rule-days"]}`);
    await expect(page.getByRole("button", { name: "Measured in" })).toContainText("Something else");
    expect(await set(/^Not shown/)).toBeNull();
    await page.goto(`/admin/products/${ids["e2e-rule-default"]}`);
    await expect(page.getByRole("button", { name: "Measured in" })).toContainText("Weight");
    await expect(page.getByLabel("Pack amount")).toHaveValue("500");
  });

  test("size options are named after what the pack is measured in", async ({ page, request }) => {
    for (const [slug, packSize, colorName] of [["e2e-size-a", "250 ml", "Blue"], ["e2e-size-b", "500 ml", "Blue"], ["e2e-size-c", "1 piece", "Red"], ["e2e-size-d", "2 pieces", "Red"], ["e2e-size-e", "500 g", "Green"], ["e2e-size-f", "1 kg", "Green"]]) {
      await create(request, slug, { packSize, colorName, variantGroup: "e2e-size-group" });
    }
    await page.goto("/products/e2e-size-a");
    await expect(page.getByText(/^Capacity:/)).toContainText("250 ml");
    await page.goto("/products/e2e-size-c");
    await expect(page.getByText(/^Pack:/)).toContainText("1 piece");
    await page.goto("/products/e2e-size-e");
    await expect(page.getByText(/^Weight:/)).toContainText("500 g");
  });

  // ---------- reviews ----------

  test("a review shows the name given, or half of the phone or email when there is no name", async ({ browser, request }) => {
    const review = async (c: BrowserContext, body: string) => {
      const res = await c.request.post(`${API}/products/e2e-rule-default/reviews`, { data: { rating: 4, body }, headers: asBrowser });
      expect(res.ok(), await res.text()).toBeTruthy();
    };
    const named = await newCustomer(browser, "Asha Kulkarni");
    await review(named, "Named review.");
    const unnamed = await newCustomer(browser, "Temporary");
    await withDb((db) => db.$executeRawUnsafe(`UPDATE "User" SET name = '' WHERE phone = $1`, `+91${unnamed.phone}`));
    await review(unnamed, "Phone review.");
    const emailOnly = await newCustomer(browser, "Temporary Two");
    await withDb((db) => db.$executeRawUnsafe(`UPDATE "User" SET name = '', phone = NULL, email = 'priya.sharma@example.com' WHERE phone = $1`, `+91${emailOnly.phone}`));
    await review(emailOnly, "Email review.");

    const data = (await (await request.get(`${API}/products/e2e-rule-default/reviews`)).json()) as { items: { body: string; author: string }[] };
    const by = (body: string) => data.items.find((i) => i.body === body)!.author;
    expect(by("Named review.")).toBe("Asha Kulkarni");
    expect(by("Phone review.")).toBe(`${unnamed.phone.slice(0, 5)}*****`);
    expect(by("Email review.")).toBe("priya.******@example.com");
    for (const c of [named, unnamed, emailOnly]) await c.close();

    const page = await buyer.newPage();
    await page.goto("/products/e2e-rule-default/reviews");
    await expect(page.getByText("Asha Kulkarni")).toBeVisible();
    await expect(page.getByText(`${unnamed.phone.slice(0, 5)}*****`)).toBeVisible();
    await expect(page.getByText("priya.******@example.com")).toBeVisible();
    await page.close();
  });

  test("customers can add photos and a video to a review, and everyone sees them", async ({ browser, request }) => {
    const c = await newCustomer(browser, "Photo Fan");
    const upload = (path: string, name: string, mimeType: string, buffer: Buffer) => c.request.post(`${API}/reviews/uploads${path}`, { multipart: { file: { name, mimeType, buffer } }, headers: asBrowser });
    const photo = await upload("", "pot.png", "image/png", PNG);
    expect(photo.ok(), await photo.text()).toBeTruthy();
    const photoBody = (await photo.json()) as { url: string; type: string };
    expect(photoBody.type).toBe("IMAGE");
    expect(photoBody.url).toMatch(/^\/uploads\/[a-f0-9]{32}\.webp$/);
    const video = await upload("/video", "clip.mp4", "video/mp4", Buffer.concat([MP4, Buffer.alloc(64)]));
    expect(video.ok(), await video.text()).toBeTruthy();
    const videoBody = (await video.json()) as { url: string; type: string };
    expect(videoBody).toMatchObject({ type: "VIDEO" });
    expect(videoBody.url).toMatch(/\.mp4$/);

    // Things that are not a photo or a video, and people who are not signed in, are turned away.
    expect((await upload("", "notes.png", "image/png", Buffer.from("<html>not a picture at all, sorry</html>"))).status()).toBe(400);
    expect((await upload("", "anim.gif", "image/gif", Buffer.from("GIF89a" + "x".repeat(40)))).status()).toBe(400);
    expect((await upload("/video", "clip.mp4", "video/mp4", Buffer.from("this is not a video file at all"))).status()).toBe(400);
    const guest = await browser.newContext({ baseURL: WEB, storageState: signedOut });
    expect((await guest.request.post(`${API}/reviews/uploads`, { multipart: { file: { name: "a.png", mimeType: "image/png", buffer: PNG } }, headers: asBrowser })).status()).toBe(401);
    await guest.close();

    const send = (media: unknown) => c.request.post(`${API}/products/e2e-rule-text/reviews`, { data: { rating: 5, body: "Looks great in real life.", media }, headers: asBrowser });
    expect((await send([{ type: "IMAGE", url: "https://example.com/x.png" }])).status()).toBe(400);
    expect((await send([{ type: "IMAGE", url: videoBody.url }])).status()).toBe(400);
    expect((await send([{ type: "VIDEO", url: videoBody.url }, { type: "VIDEO", url: videoBody.url }])).status()).toBe(400);
    expect((await send([{ type: "IMAGE", url: `/uploads/${"0".repeat(32)}.webp` }])).status()).toBe(400);
    const good = await send([{ type: "IMAGE", url: photoBody.url }, { type: "VIDEO", url: videoBody.url }]);
    expect(good.ok(), await good.text()).toBeTruthy();

    const data = (await (await request.get(`${API}/products/e2e-rule-text/reviews`)).json()) as { items: { media: { type: string }[] }[]; gallery: { type: string }[]; mediaCount: number };
    expect(data.items[0].media.map((m) => m.type)).toEqual(["IMAGE", "VIDEO"]);
    expect(data.mediaCount).toBe(2);
    expect(data.gallery).toHaveLength(2);

    const page = await browser.newPage({ baseURL: WEB, storageState: signedOut });
    await page.goto("/products/e2e-rule-text");
    const reviews = page.locator("#reviews");
    await expect(reviews.getByRole("list", { name: "Photos and videos in this review" }).getByRole("button")).toHaveCount(2);
    await reviews.getByRole("list", { name: "Photos and videos in this review" }).getByRole("button", { name: /View photo/ }).click();
    const viewer = page.getByRole("dialog", { name: /Customer photo 1 of 2/ });
    await expect(viewer.locator("img")).toBeVisible();
    await page.keyboard.press("ArrowRight");
    await expect(page.getByRole("dialog", { name: /Customer video 2 of 2/ }).locator("video")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page.close();
    await c.close();
  });

  test("the review form uploads a photo and the review appears with it", async ({ browser }) => {
    const c = await newCustomer(browser, "Form User");
    const page = await c.newPage();
    await page.goto("/products/e2e-rule-days");
    await page.getByPlaceholder("What did you like or dislike?").fill("Sturdy and well made.");
    await page.getByLabel("Add photos or a video").setInputFiles({ name: "mine.png", mimeType: "image/png", buffer: PNG });
    const attached = page.getByRole("list", { name: "Attached photos and videos" });
    await expect(attached.getByRole("button", { name: "Remove photo" })).toBeVisible();
    await page.getByRole("button", { name: "Submit review" }).click();
    await expect(page.getByText("Thanks — your review has been saved.")).toBeVisible();
    await expect(page.locator("#reviews").getByRole("list", { name: "Photos and videos in this review" })).toBeVisible();
    await expect(page.locator("#reviews").getByText("Photos and videos from customers")).toBeVisible();

    await page.getByLabel("Add photos or a video").setInputFiles({ name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("hello") });
    await expect(page.getByRole("alert").filter({ hasText: "notes.txt is not a photo or video" })).toBeVisible();
    await page.close();
    await c.close();
  });
});
