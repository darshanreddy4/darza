"use client";

import { useState, type FormEvent } from "react";
import { useAdminApi, useAdminQuery } from "@/lib/admin";
import { themeAttr, type ThemeKey } from "@/lib/appearance";
import { Alert, Card, PageHeader, Skeleton, btn, inputCls } from "@/components/admin/ui";
import { Select } from "@/components/Select";

interface ThemeInfo { key: ThemeKey; name: string; blurb: string }
interface CurrencyRow { code: string; name: string; liveInrPerUnit: number | null; manualInrPerUnit: number | null }
interface Appearance {
  theme: ThemeKey; themes: ThemeInfo[];
  currency: { codes: string[]; default: string; updatedAt: string | null; supported: CurrencyRow[] };
}

export default function AppearancePage() {
  const data = useAdminQuery<Appearance>("/admin/appearance");
  return (
    <>
      <PageHeader title="Appearance and currency" description="Choose the look of your store and the currencies shoppers can view prices in. Only admins can change these." />
      {data.error && <Alert tone="error">{data.error}</Alert>}
      {data.loading || !data.data ? <Skeleton rows={4} /> : (
        <div className="space-y-6">
          <ThemeForm initial={data.data} onSaved={data.reload} />
          <CurrencyForm initial={data.data} onSaved={data.reload} />
        </div>
      )}
    </>
  );
}

// A small sample of a product card, drawn inside the theme it previews so it picks up that theme's colours, corners and shadows.
function ThemePreview({ theme }: { theme: ThemeKey }) {
  return (
    <div data-theme={themeAttr(theme)} className="rounded-xl p-3">
      <h4 className="font-display text-base font-bold">Aa Headline</h4>
      <div className="mt-2 rounded-2xl border border-line bg-white p-3 shadow-card">
        <div className="h-10 rounded-lg bg-brand-50" />
        <p className="mt-2 text-sm font-semibold">Product name</p>
        <p className="text-xs text-muted">Short description</p>
        <p className="font-display mt-1 text-lg font-bold">₹1,299</p>
        <div className="mt-2 flex gap-2">
          <span className="rounded-xl bg-brand-500 px-3 py-1.5 text-xs font-semibold text-ink">Add to cart</span>
          <span className="rounded-xl bg-ink px-3 py-1.5 text-xs font-semibold text-white">Buy</span>
        </div>
      </div>
    </div>
  );
}

function ThemeForm({ initial, onSaved }: { initial: Appearance; onSaved: () => void }) {
  const call = useAdminApi();
  const [theme, setTheme] = useState<ThemeKey>(initial.theme);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function save(e: FormEvent) {
    e.preventDefault();
    setError(""); setNotice(""); setBusy(true);
    try {
      await call("/admin/appearance", { method: "PUT", body: JSON.stringify({ theme }) });
      setNotice("Saved. The store now uses this look.");
      onSaved();
    } catch (err) { setError((err as Error).message); }
    setBusy(false);
  }

  return (
    <Card title="Store look" description="Applies to every shopper-facing page. The admin console always keeps the standard look. Default is the store as it is today.">
      <form onSubmit={save} className="space-y-4">
        <fieldset>
          <legend className="sr-only">Store look</legend>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {initial.themes.map((t) => (
              <label key={t.key} className={`block cursor-pointer rounded-2xl border-2 p-2 transition ${theme === t.key ? "border-brand-600 bg-brand-50" : "border-line bg-white hover:border-brand-200"}`}>
                <input type="radio" name="theme" value={t.key} checked={theme === t.key} onChange={() => setTheme(t.key)} className="sr-only" />
                <ThemePreview theme={t.key} />
                <span className="mt-2 flex items-center gap-2 px-1 text-sm font-semibold">
                  <span aria-hidden className={`grid h-4 w-4 place-items-center rounded-full border-2 ${theme === t.key ? "border-brand-700" : "border-line"}`}>{theme === t.key && <span className="h-2 w-2 rounded-full bg-brand-700" />}</span>
                  {t.name}{t.key === initial.theme && <span className="rounded bg-canvas px-1.5 py-0.5 text-[11px] font-medium text-muted">current</span>}
                </span>
                <span className="block px-1 pb-1 text-xs text-muted">{t.blurb}</span>
              </label>
            ))}
          </div>
        </fieldset>
        {error && <Alert tone="error">{error}</Alert>}
        {notice && <Alert tone="success">{notice}</Alert>}
        <button disabled={busy || theme === initial.theme} className={btn.primary}>{busy ? "Saving…" : "Save look"}</button>
      </form>
    </Card>
  );
}

function CurrencyForm({ initial, onSaved }: { initial: Appearance; onSaved: () => void }) {
  const call = useAdminApi();
  const c = initial.currency;
  const [codes, setCodes] = useState<string[]>(c.codes);
  const [def, setDef] = useState(c.default);
  const [manual, setManual] = useState<Record<string, string>>(() => Object.fromEntries(c.supported.map((r) => [r.code, r.manualInrPerUnit ? String(r.manualInrPerUnit) : ""])));
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const toggle = (code: string) => setCodes((cur) => {
    const next = cur.includes(code) ? cur.filter((x) => x !== code) : [...cur, code];
    if (!next.includes(def) && def !== "INR") setDef("INR");
    return next;
  });

  async function save(e: FormEvent) {
    e.preventDefault();
    setError(""); setNotice("");
    const manualRates: Record<string, number | null> = {};
    for (const r of c.supported) {
      const text = manual[r.code]?.trim();
      if (!text) { manualRates[r.code] = null; continue; }
      const n = Number(text);
      if (!Number.isFinite(n) || n <= 0) return setError(`Enter how many rupees one ${r.code} is worth, for example 83.5`);
      manualRates[r.code] = n;
    }
    setBusy(true);
    try {
      await call("/admin/appearance", { method: "PUT", body: JSON.stringify({ currencyCodes: codes, currencyDefault: def, manualRates }) });
      const noRate = codes.filter((code) => !manualRates[code] && !c.supported.find((r) => r.code === code)?.liveInrPerUnit);
      if (noRate.length) setError(`Saved, but ${noRate.join(", ")} has no rate yet, so shoppers will not see it. Type your own rate below, or fix the live rate fetch.`);
      else setNotice(codes.length ? "Saved. Shoppers can now switch currency from the header." : "Saved. Prices are shown in rupees only.");
      onSaved();
    } catch (err) { setError((err as Error).message); }
    setBusy(false);
  }

  async function refresh() {
    setError(""); setNotice(""); setRefreshing(true);
    try { await call("/admin/appearance/refresh-rates", { method: "POST" }); setNotice("Today's exchange rates were fetched."); onSaved(); }
    catch (err) { setError((err as Error).message); }
    setRefreshing(false);
  }

  return (
    <Card title="Currencies" description="Shoppers can view prices in any currency you offer. Everything is still charged in Indian rupees, so converted prices are shown as a guide.">
      <form onSubmit={save} className="space-y-4">
        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="w-full text-sm">
            <thead className="bg-canvas text-left text-xs font-semibold uppercase tracking-wider text-muted">
              <tr><th className="px-4 py-2.5">Offer</th><th className="px-4 py-2.5">Currency</th><th className="px-4 py-2.5">Live rate (₹ for 1)</th><th className="px-4 py-2.5">Your own rate (₹ for 1)</th></tr>
            </thead>
            <tbody>
              {c.supported.map((r) => (
                <tr key={r.code} className="border-t border-line">
                  <td className="px-4 py-2"><input type="checkbox" checked={codes.includes(r.code)} onChange={() => toggle(r.code)} aria-label={`Offer ${r.name}`} className="h-4 w-4 accent-emerald-600" /></td>
                  <td className="px-4 py-2"><span className="font-semibold">{r.code}</span> <span className="text-muted">{r.name}</span></td>
                  <td className="px-4 py-2 text-muted">{r.liveInrPerUnit ? r.liveInrPerUnit.toLocaleString("en-IN", { maximumFractionDigits: 4 }) : "not fetched yet"}</td>
                  <td className="px-4 py-2"><input value={manual[r.code] ?? ""} onChange={(e) => setManual({ ...manual, [r.code]: e.target.value })} inputMode="decimal" placeholder="use live" aria-label={`Your rate for ${r.code}`} className={`${inputCls} !w-32`} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted">Leave &quot;Your own rate&quot; empty to follow the live rate, which is refreshed every few hours{c.updatedAt ? ` (last updated ${new Date(c.updatedAt).toLocaleString("en-IN")})` : ""}. Type a rate to fix it yourself, for example 83.5 when one dollar is worth ₹83.50. Rates by ExchangeRate-API.</p>

        <label className="block max-w-xs text-sm font-medium">Currency shown to new visitors
          <Select value={def} onChange={(e) => setDef(e.target.value)} className={`${inputCls} mt-1`}>
            <option value="INR">INR Indian rupee</option>
            {codes.map((code) => <option key={code} value={code}>{code} {c.supported.find((r) => r.code === code)?.name}</option>)}
          </Select>
        </label>

        {error && <Alert tone="error">{error}</Alert>}
        {notice && <Alert tone="success">{notice}</Alert>}
        <div className="flex flex-wrap gap-3">
          <button disabled={busy} className={btn.primary}>{busy ? "Saving…" : "Save currencies"}</button>
          <button type="button" onClick={refresh} disabled={refreshing} className={btn.secondary}>{refreshing ? "Fetching…" : "Fetch today's rates"}</button>
        </div>
      </form>
    </Card>
  );
}
