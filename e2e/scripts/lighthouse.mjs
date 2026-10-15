// Runs Lighthouse against a running store (npm run start in apps/api and apps/web) and fails when a score drops below its floor.
// Usage: node scripts/lighthouse.mjs [baseUrl]    Needs Google Chrome; set CHROME_PATH if it is not found.
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const base = process.argv[2] ?? "http://localhost:3100";
const pages = ["/", "/products", "/products/e2e-power-bank", "/cart", "/login"];
// Floors per category. Pages that are blocked from search engines on purpose (cart, login) do not need a high SEO score.
const floors = { performance: 80, accessibility: 95, "best-practices": 90 };
const seoPages = new Set(["/", "/products", "/products/e2e-power-bank"]);

const dir = mkdtempSync(join(tmpdir(), "lighthouse-"));
let failed = false;
const rows = [];

for (const profile of ["mobile", "desktop"]) {
  for (const path of pages) {
    const out = join(dir, `${profile}${path.replace(/\W+/g, "-")}.json`);
    const args = ["-y", "lighthouse", base + path, "--quiet", "--output=json", `--output-path=${out}`, "--chrome-flags=--headless=new --no-sandbox", "--only-categories=performance,accessibility,best-practices,seo"];
    if (profile === "desktop") args.push("--preset=desktop");
    execFileSync("npx", args, { stdio: "ignore" });
    const r = JSON.parse(readFileSync(out, "utf8"));
    const score = (id) => Math.round(r.categories[id].score * 100);
    const a = r.audits;
    const s = { performance: score("performance"), accessibility: score("accessibility"), "best-practices": score("best-practices"), seo: score("seo") };
    const low = Object.entries(floors).filter(([id, floor]) => s[id] < floor).map(([id]) => id);
    if (seoPages.has(path) && s.seo < 90) low.push("seo");
    if (low.length) failed = true;
    rows.push({ profile, path, ...s, LCP: a["largest-contentful-paint"].displayValue, TBT: a["total-blocking-time"].displayValue, CLS: a["cumulative-layout-shift"].displayValue, below: low.join(",") || "-" });
  }
}

console.table(rows);
if (failed) { console.error("Some scores are below their floor."); process.exit(1); }
