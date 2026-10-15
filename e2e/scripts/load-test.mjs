// Load test for a running store. Point it at a throwaway database (the e2e one): it creates and cancels orders.
// Start the API with DISABLE_RATE_LIMIT=true or the limiter will answer most requests with 429.
// Usage: node scripts/load-test.mjs [apiUrl] [webUrl]
import autocannon from "autocannon";

const API = process.argv[2] ?? "http://localhost:4100";
const WEB = process.argv[3] ?? "http://localhost:3100";
const DURATION = Number(process.env.LOAD_SECONDS ?? 10);
const CONNECTIONS = Number(process.env.LOAD_CONNECTIONS ?? 50);
const origin = { origin: WEB };

// What each scenario must achieve to pass.
const LIMITS = { p99Ms: 800, errorRate: 0 };

const scenarios = [
  { name: "API  GET /categories", url: `${API}/categories` },
  { name: "API  GET /products", url: `${API}/products?limit=24` },
  { name: "API  GET /products/:slug", url: `${API}/products/e2e-power-bank` },
  { name: "API  GET /products?q=", url: `${API}/products?q=power` },
  { name: "API  GET /home", url: `${API}/home` },
  { name: "API  POST /checkout/quote", url: `${API}/checkout/quote`, method: "POST", headers: { ...origin, "content-type": "application/json" }, body: JSON.stringify({ items: [{ productId: "x", quantity: 1 }] }) },
  { name: "WEB  GET /", url: `${WEB}/` },
  { name: "WEB  GET /products", url: `${WEB}/products` },
  { name: "WEB  GET /products/:slug", url: `${WEB}/products/e2e-power-bank` },
];

const run = (opts) => new Promise((resolve, reject) => autocannon({ connections: CONNECTIONS, duration: DURATION, ...opts }, (e, r) => (e ? reject(e) : resolve(r))));

const rows = [];
let failed = false;
for (const s of scenarios) {
  const r = await run({ url: s.url, method: s.method ?? "GET", headers: s.headers, body: s.body });
  const bad = r.errors + r.timeouts + r.non2xx;
  const ok = r.latency.p99 <= LIMITS.p99Ms && bad / Math.max(r.requests.total, 1) <= LIMITS.errorRate;
  if (!ok) failed = true;
  rows.push({ scenario: s.name, "req/s": Math.round(r.requests.average), "p50 ms": r.latency.p50, "p97.5 ms": r.latency.p97_5, "p99 ms": r.latency.p99, requests: r.requests.total, "errors/non-2xx": bad, pass: ok ? "yes" : "NO" });
}
console.table(rows);

// Stock must never be oversold: many customers buy the last few units at the same moment.
async function oversell() {
  const admin = await (await fetch(`${API}/auth/login`, { method: "POST", headers: { ...origin, "content-type": "application/json" }, body: JSON.stringify({ email: "e2e-admin@dmg.test", password: "E2e-Pass-12345" }) })).headers.getSetCookie();
  const cookie = admin.map((c) => c.split(";")[0]).join("; ");
  const json = (path, init = {}) => fetch(`${API}${path}`, { ...init, headers: { ...origin, "content-type": "application/json", cookie, ...(init.headers ?? {}) } });
  const cats = await (await json("/admin/categories")).json();
  const STOCK = 5, BUYERS = 40;
  const slug = `load-test-${Date.now()}`;
  const created = await (await json("/admin/products", { method: "POST", body: JSON.stringify({ name: "Load Test Item", slug, description: "Temporary product for the load test.", categoryId: cats[0].id, productType: "OWN", status: "PUBLISHED", pricePaise: 10000, sku: slug.toUpperCase(), stock: STOCK, images: [] }) })).json();

  // Every order comes from the seeded customer.
  const login = await fetch(`${API}/auth/login`, { method: "POST", headers: { ...origin, "content-type": "application/json" }, body: JSON.stringify({ email: "e2e-customer@dmg.test", password: "E2e-Pass-12345" }) });
  const customerCookie = login.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
  const order = () => fetch(`${API}/orders`, { method: "POST", headers: { ...origin, "content-type": "application/json", cookie: customerCookie }, body: JSON.stringify({ items: [{ productId: created.id, quantity: 1 }], shipping: { name: "Load Tester", phone: "9876500003", line1: "3 Load Road", city: "Pune", state: "Maharashtra", pincode: "411001" }, paymentMethod: "COD" }) });
  const results = await Promise.all(Array.from({ length: BUYERS }, order));
  const won = results.filter((r) => r.status === 201).length;
  const refused = results.filter((r) => r.status === 409).length;

  const after = await (await json(`/admin/products/${created.id}`)).json();
  // Orders are cancelled so the stock returns, then the product is removed.
  const orders = await (await json("/admin/orders")).json();
  for (const o of orders.filter((o) => o.items.some((i) => i.product.name === "Load Test Item") && o.status !== "CANCELLED")) await json(`/admin/orders/${o.id}/status`, { method: "PATCH", body: JSON.stringify({ status: "CANCELLED" }) });
  await json(`/admin/products/${created.id}`, { method: "DELETE" });
  const pass = won === STOCK && refused === BUYERS - STOCK && after.stock === 0;
  console.log(`\nOversell check: ${BUYERS} buyers raced for ${STOCK} units -> ${won} orders accepted, ${refused} refused for stock, ${after.stock} left. ${pass ? "PASS" : "FAIL"}`);
  return pass;
}

const stockOk = await oversell();
if (failed || !stockOk) { console.error("\nLoad test failed."); process.exit(1); }
console.log("\nLoad test passed.");
