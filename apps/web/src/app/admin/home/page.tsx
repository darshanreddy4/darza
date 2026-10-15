"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useAdminApi, useAdminQuery } from "@/lib/admin";
import { adsenseSummary } from "@/lib/adsense";
import { ADSENSE_PLACEMENTS, PRODUCT_SOURCES, WIDGET_CATALOG, newWidgetId, widgetLabel, type HomeWidget } from "@/lib/home";
import { Alert, Badge, Card, PageHeader, Skeleton, btn } from "@/components/admin/ui";
import { WidgetEditor } from "@/components/admin/home/WidgetEditors";

interface Layout { widgets: HomeWidget[]; isDefault: boolean }

function summary(w: HomeWidget): string {
  const c = w.config as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  const count = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
  switch (w.type) {
    case "products": return [PRODUCT_SOURCES.find((s) => s.value === c.source)?.label, c.title && `“${c.title}”`, `${c.limit} products`, c.layout === "carousel" ? "scrolling row" : `${c.columns} per row`].filter(Boolean).join(" · ");
    case "product-slider": return [PRODUCT_SOURCES.find((s) => s.value === c.source)?.label, c.title && `“${c.title}”`, `${c.limit} products`, `${c.perView} at a time`].filter(Boolean).join(" · ");
    case "category-slider": return [c.title && `“${c.title}”`, c.level === "all" ? "all categories" : "main categories", `${c.perView} at a time`].filter(Boolean).join(" · ");
    case "categories": return [c.title && `“${c.title}”`, c.style === "chips" ? "chips" : "tiles"].filter(Boolean).join(" · ");
    case "promo-banner": return c.title ? `“${c.title}”` : "Image only";
    case "image-tiles": return count(c.items?.length ?? 0, "tile");
    case "tile-carousel": return [count(c.items?.length ?? 0, "tile"), `${c.perView} at a time`].join(" · ");
    case "trust-bar": return count(c.items?.length ?? 0, "highlight");
    case "text": return c.title ? `“${c.title}”` : "Text only";
    case "faq": return count(c.items?.length ?? 0, "question");
    case "banners": return "Slides come from Admin → Banners";
    case "how-it-works": return "Our products vs partner explainer";
    case "spacer": return `${c.size} space`;
    case "adsense": return c.publisherId ? `${ADSENSE_PLACEMENTS.find((p) => p.value === c.placement)?.label} · ${adsenseSummary(c as never)}` : "Not set up yet: paste your AdSense code";
  }
}

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

export default function HomePage() {
  const loaded = useAdminQuery<Layout>("/admin/home-layout");
  if (!loaded.data) return loaded.error ? <Alert tone="error">{loaded.error}</Alert> : <Skeleton />;
  return <Builder initial={loaded.data} />;
}

function Builder({ initial }: { initial: Layout }) {
  const call = useAdminApi();
  const [widgets, setWidgets] = useState<HomeWidget[]>(initial.widgets);
  const [saved, setSaved] = useState(JSON.stringify(initial.widgets));
  const [isDefault, setIsDefault] = useState(initial.isDefault);
  const [open, setOpen] = useState<string | null>(null);
  const [adding, setAdding] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const adder = useRef<HTMLDivElement>(null);

  const dirty = JSON.stringify(widgets) !== saved;
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  useEffect(() => { if (adding !== null) adder.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }); }, [adding]);

  const update = (next: HomeWidget[]) => { setWidgets(next); setNotice(""); };
  const patch = (id: string, change: Partial<HomeWidget>) => update(widgets.map((w) => (w.id === id ? { ...w, ...change } : w)));
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= widgets.length) return;
    const next = [...widgets];
    [next[i], next[j]] = [next[j], next[i]];
    update(next);
  };
  const add = (type: HomeWidget["type"], at: number) => {
    const entry = WIDGET_CATALOG.find((w) => w.type === type)!;
    const widget: HomeWidget = { id: newWidgetId(), type, active: true, config: clone(entry.defaults) };
    update([...widgets.slice(0, at), widget, ...widgets.slice(at)]);
    setOpen(widget.id);
    setAdding(null);
  };
  const duplicate = (i: number) => {
    const copy = { ...clone(widgets[i]), id: newWidgetId() };
    update([...widgets.slice(0, i + 1), copy, ...widgets.slice(i + 1)]);
    setOpen(copy.id);
  };

  function accept(layout: Layout, message: string) {
    setWidgets(layout.widgets);
    setSaved(JSON.stringify(layout.widgets));
    setIsDefault(layout.isDefault);
    setNotice(message);
  }

  async function save() {
    setError(""); setBusy(true);
    try { accept(await call<Layout>("/admin/home-layout", { method: "PUT", body: JSON.stringify({ widgets }) }), "Saved. Your home page is updated."); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }

  async function reset() {
    if (!confirm("Go back to the original home page layout? Your own widgets will be removed.")) return;
    setError(""); setBusy(true);
    try { accept(await call<Layout>("/admin/home-layout", { method: "DELETE" }), "The home page is back to the original layout."); setOpen(null); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }

  return (
    <>
      <PageHeader
        title="Home page"
        description="The home page is built from widgets, top to bottom. Add, move, hide or edit them, then save. Type {brand} in any text to show your brand name."
        actions={
          <>
            <Link href="/" target="_blank" className={btn.secondary}>View home page ↗</Link>
            <button className={btn.secondary} disabled={busy || isDefault} onClick={reset}>Reset to original</button>
            <button className={btn.primary} disabled={busy || !dirty} onClick={save}>{busy ? "Saving…" : dirty ? "Save changes" : "Saved"}</button>
          </>
        }
      />
      {error && <Alert tone="error" onClose={() => setError("")}>{error}</Alert>}
      {notice && <Alert tone="success" onClose={() => setNotice("")}>{notice}</Alert>}
      {isDefault && !dirty && <Alert tone="success">You are using the original layout. Change anything and save to make it your own.</Alert>}
      {dirty && <p className="mb-4 rounded-xl bg-gold-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-gold/40">You have unsaved changes. Visitors will not see them until you save.</p>}

      <ol className="space-y-3">
        {widgets.map((w, i) => {
          const expanded = open === w.id;
          return (
            <li key={w.id}>
              <Card padded={false} className={w.active ? "" : "opacity-70"}>
                <div className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <span className="flex flex-col">
                    <button className="px-1.5 py-1 leading-none text-muted hover:text-ink disabled:opacity-30" disabled={i === 0} onClick={() => move(i, -1)} aria-label={`Move ${widgetLabel(w.type)} up`}>▲</button>
                    <button className="px-1.5 py-1 leading-none text-muted hover:text-ink disabled:opacity-30" disabled={i === widgets.length - 1} onClick={() => move(i, 1)} aria-label={`Move ${widgetLabel(w.type)} down`}>▼</button>
                  </span>
                  <span className="grid h-7 w-7 place-items-center rounded-full bg-canvas text-xs font-bold text-ink-3">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{widgetLabel(w.type)} {!w.active && <Badge tone="slate">Hidden</Badge>}</p>
                    <p className="truncate text-xs text-muted">{summary(w)}</p>
                  </div>
                  <label className="flex items-center gap-2 text-xs text-ink-3"><input type="checkbox" className="h-4 w-4 accent-emerald-600" checked={w.active} onChange={(e) => patch(w.id, { active: e.target.checked })} aria-label={`Show ${widgetLabel(w.type)} ${i + 1}`} /> Visible</label>
                  <button className={btn.secondary + " !px-3 !py-1.5"} onClick={() => setOpen(expanded ? null : w.id)} aria-expanded={expanded}>{expanded ? "Close" : "Edit"}</button>
                  <button className={btn.secondary + " !px-3 !py-1.5"} onClick={() => setAdding(i + 1)}>Add below</button>
                  <button className={btn.secondary + " !px-3 !py-1.5"} onClick={() => duplicate(i)}>Duplicate</button>
                  <button className={btn.danger} onClick={() => { if (confirm(`Remove this ${widgetLabel(w.type)} widget?`)) { update(widgets.filter((x) => x.id !== w.id)); if (open === w.id) setOpen(null); } }}>Remove</button>
                </div>
                {expanded && (
                  <div className="border-t border-line bg-white px-5 py-5">
                    <WidgetEditor type={w.type} config={w.config} set={(change) => patch(w.id, { config: { ...w.config, ...change } })} />
                  </div>
                )}
              </Card>
            </li>
          );
        })}
      </ol>

      <div ref={adder} className="mt-5">
        {adding === null ? (
          <button className={btn.dark} onClick={() => setAdding(widgets.length)}>+ Add widget</button>
        ) : (
          <Card title="Choose a widget" description={adding >= widgets.length ? "It will be added at the bottom." : `It will be added at position ${adding + 1}.`} actions={<button className={btn.secondary} onClick={() => setAdding(null)}>Cancel</button>}>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {WIDGET_CATALOG.map((c) => (
                <button key={c.type} onClick={() => add(c.type, adding)} className="rounded-xl border border-line p-4 text-left transition hover:border-brand-500 hover:bg-brand-50/40">
                  <p className="font-semibold">{c.label}</p>
                  <p className="mt-1 text-xs text-muted">{c.description}</p>
                </button>
              ))}
            </div>
          </Card>
        )}
      </div>
    </>
  );
}
