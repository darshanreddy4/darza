import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_LAYOUT, MAX_WIDGETS, sanitizeLayout, type Widget } from "./widgets";

const ok = (input: unknown) => {
  const r = sanitizeLayout(input);
  if ("errors" in r) assert.fail(r.errors.join("; "));
  return r.widgets;
};
const errors = (input: unknown) => {
  const r = sanitizeLayout(input);
  assert.ok("errors" in r, "expected errors");
  return r.errors;
};

test("the default layout is itself valid and unchanged by cleaning", () => {
  const cleaned = ok(DEFAULT_LAYOUT);
  assert.deepEqual(cleaned, DEFAULT_LAYOUT);
});

test("unknown widget types and non-lists are rejected", () => {
  assert.match(errors([{ type: "script" }])[0], /unknown type/);
  assert.match(errors({ type: "text" })[0], /list of widgets/);
});

test("a page is limited to a sensible number of widgets", () => {
  assert.match(errors(Array.from({ length: MAX_WIDGETS + 1 }, () => ({ type: "spacer" })))[0], /at most/);
});

test("numbers and choices are clamped to what the page supports", () => {
  const [w] = ok([{ type: "products", config: { source: "bogus", limit: 500, columns: 9, layout: "wall" } }]);
  assert.deepEqual([w.config.source, w.config.limit, w.config.columns, w.config.layout], ["featured", 24, 5, "grid"]);
});

test("a category collection needs a category, and picks need products", () => {
  assert.match(errors([{ type: "products", config: { source: "category" } }])[0], /Choose a category/);
  assert.match(errors([{ type: "products", config: { source: "picks", picks: ["Not A Slug"] } }])[0], /at least one product/);
  const [w] = ok([{ type: "products", config: { source: "picks", picks: ["a-b", "a-b", "c"], category: "ignored" } }]);
  assert.deepEqual(w.config.picks, ["a-b", "c"]);
  assert.equal(w.config.category, "");
});

test("links must stay on the site or use https", () => {
  assert.match(errors([{ type: "promo-banner", config: { title: "Sale", linkUrl: "javascript:alert(1)" } }])[0], /Link must be/);
  assert.match(errors([{ type: "promo-banner", config: { title: "Sale", linkUrl: "//evil.example" } }])[0], /Link must be/);
  ok([{ type: "promo-banner", config: { title: "Sale", linkUrl: "/products?type=OWN", buttonLabel: "Shop" } }]);
  ok([{ type: "promo-banner", config: { title: "Sale", linkUrl: "https://example.com/x", buttonLabel: "Go" } }]);
});

test("images must be uploads or https addresses", () => {
  assert.match(errors([{ type: "promo-banner", config: { imageUrl: "http://x.test/a.png" } }])[0], /Image must be/);
  ok([{ type: "promo-banner", config: { imageUrl: "/uploads/abc123.png" } }]);
});

test("a promo banner needs content, and a button needs a link", () => {
  assert.match(errors([{ type: "promo-banner", config: {} }])[0], /headline or an image/);
  assert.match(errors([{ type: "promo-banner", config: { title: "x", buttonLabel: "Go" } }])[0], /needs a link/);
});

test("empty list entries are dropped, not saved", () => {
  const [faq] = ok([{ type: "faq", config: { items: [{ question: "Q?", answer: "A." }, { question: "No answer", answer: "" }, "junk"] } }]);
  assert.equal((faq.config.items as unknown[]).length, 1);
  const [tiles] = ok([{ type: "image-tiles", config: { items: [{ title: "No image" }, { imageUrl: "/uploads/a.png", title: "Ok" }] } }]);
  assert.equal((tiles.config.items as unknown[]).length, 1);
  const [trust] = ok([{ type: "trust-bar", config: { items: [{ icon: "nope", title: "Fast", text: "" }, { title: "" }] } }]);
  assert.deepEqual(trust.config.items, [{ icon: "star", title: "Fast", text: "" }]);
});

test("ids are kept when valid and made unique otherwise", () => {
  const widgets: Widget[] = ok([{ id: "keep-1", type: "spacer" }, { id: "keep-1", type: "spacer" }, { id: "bad id!", type: "spacer" }, { type: "spacer", active: false }]);
  assert.equal(widgets[0].id, "keep-1");
  assert.equal(new Set(widgets.map((w) => w.id)).size, 4);
  assert.equal(widgets[3].active, false);
});

test("text in widgets is stored as plain text, never markup the page would run", () => {
  const [w] = ok([{ type: "text", config: { title: "<script>alert(1)</script>", body: "x".repeat(5000) } }]);
  assert.equal((w.config.body as string).length, 2000);
  assert.equal(w.config.title, "<script>alert(1)</script>");
});

const ad = { publisherId: "ca-pub-1234567890123456", slotId: "9876543210", format: "auto", responsive: true };

test("an AdSense widget keeps only the values Google's tag needs", () => {
  const [w] = ok([{ type: "adsense", config: { ...ad, placement: "right-rail", html: "<script>alert(1)</script>", testMode: true } }]);
  assert.deepEqual(w.config, { ...ad, layout: "", layoutKey: "", width: 0, height: 0, placement: "right-rail", showLabel: true, testMode: true });
});

test("an AdSense widget that is not set up yet can be saved, but half-set-up ones cannot", () => {
  const [w] = ok([{ type: "adsense", config: {} }]);
  assert.equal(w.config.publisherId, "");
  assert.match(errors([{ type: "adsense", config: { publisherId: "pub-123", slotId: "9876543210", format: "auto" } }])[0], /publisher ID/);
  assert.match(errors([{ type: "adsense", config: { publisherId: ad.publisherId, slotId: "abc", format: "auto" } }])[0], /slot ID/);
  assert.match(errors([{ type: "adsense", config: { publisherId: ad.publisherId, slotId: ad.slotId } }])[0], /format or a fixed width/);
});

test("a fixed-size AdSense unit needs no format", () => {
  const [w] = ok([{ type: "adsense", config: { publisherId: ad.publisherId, slotId: ad.slotId, width: 728, height: 90, responsive: false, placement: "bottom-bar" } }]);
  assert.deepEqual([w.config.width, w.config.height, w.config.placement], [728, 90, "bottom-bar"]);
});

test("an unknown AdSense placement falls back to inline", () => {
  const [w] = ok([{ type: "adsense", config: { ...ad, placement: "popup" } }]);
  assert.equal(w.config.placement, "inline");
});

test("a tile carousel holds more tiles than a tile grid and keeps its own settings", () => {
  const items = Array.from({ length: 25 }, (_, i) => ({ imageUrl: `/uploads/t${i}.png`, title: `T${i}` }));
  const [grid] = ok([{ type: "image-tiles", config: { items } }]);
  const [row] = ok([{ type: "tile-carousel", config: { items, perView: 9, shape: "tall" } }]);
  assert.equal((grid.config.items as unknown[]).length, 8);
  assert.equal((row.config.items as unknown[]).length, 20);
  assert.deepEqual([row.config.perView, row.config.shape], [5, "landscape"]);
});

test("tile carousel links and images are checked like image tiles", () => {
  assert.match(errors([{ type: "tile-carousel", config: { items: [{ imageUrl: "/uploads/a.png", linkUrl: "javascript:x" }] } }])[0], /Tile link must be/);
  assert.match(errors([{ type: "tile-carousel", config: { items: [{ imageUrl: "http://x.test/a.png" }] } }])[0], /Tile image must be/);
});

test("a product slider shares the product rules and adds how many show at once", () => {
  const [w] = ok([{ type: "product-slider", config: { source: "bestselling", limit: 99, perView: 9, layout: "grid" } }]);
  assert.deepEqual([w.config.source, w.config.limit, w.config.perView], ["bestselling", 24, 6]);
  assert.equal("layout" in w.config, false);
  assert.match(errors([{ type: "product-slider", config: { source: "category" } }])[0], /Choose a category/);
  assert.match(errors([{ type: "product-slider", config: { source: "picks" } }])[0], /at least one product/);
});

test("a category slider keeps to its limits", () => {
  const [w] = ok([{ type: "category-slider", config: { perView: 1, limit: 500, level: "everything" } }]);
  assert.deepEqual([w.config.perView, w.config.limit, w.config.level], [2, 24, "main"]);
  const [x] = ok([{ type: "category-slider", config: { level: "all" } }]);
  assert.deepEqual([x.config.perView, x.config.limit, x.config.level], [4, 12, "all"]);
});

test("a product grid keeps its card size choice, and defaults to fitting the row", () => {
  const [a] = ok([{ type: "products", config: { source: "new", cardSize: "medium" } }]);
  const [b] = ok([{ type: "products", config: { source: "new", cardSize: "huge" } }]);
  assert.deepEqual([a.config.cardSize, b.config.cardSize], ["medium", "auto"]);
});
