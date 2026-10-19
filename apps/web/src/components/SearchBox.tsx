"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, type CSSProperties, type FocusEvent, type KeyboardEvent } from "react";
import { API_URL, imgSized } from "@/lib/api";
import { Money } from "@/lib/currency";
import { Dropdown } from "./Dropdown";

interface Suggestion { name: string; slug: string; image: string | null; pricePaise: number; category: string }
interface Group { id: string; name: string; slug: string; children: { id: string; name: string; slug: string }[] }

// `skin` carries the colours the admin picked for the search bar; without it the bar looks as it always did.
export function SearchBox({ categories, skin = null }: { categories: Group[]; skin?: CSSProperties | null }) {
  const router = useRouter();
  const listId = useId();
  const wrapper = useRef<HTMLFormElement>(null);
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [result, setResult] = useState<{ q: string; items: Suggestion[] } | null>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);

  const term = q.trim();
  const items = result && result.q === term ? result.items : [];
  const showPanel = open && term.length >= 2;

  useEffect(() => {
    if (term.length < 2) return;
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      fetch(`${API_URL}/search/suggest?q=${encodeURIComponent(term)}`, { signal: ctrl.signal })
        .then((r) => (r.ok ? r.json() : { items: [] }))
        .then((d: { items: Suggestion[] }) => setResult({ q: term, items: d.items }))
        .catch(() => {});
    }, 180);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [term]);

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (!showPanel) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => (i + 1) % Math.max(items.length, 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => (i <= 0 ? items.length - 1 : i - 1)); }
    else if (e.key === "Escape") setOpen(false);
    else if (e.key === "Enter" && active >= 0 && items[active]) {
      e.preventDefault();
      go(items[active].slug);
    }
  }

  function go(slug: string) {
    setOpen(false);
    setQ("");
    router.push(`/products/${slug}`);
  }

  function onBlur(e: FocusEvent) {
    if (!wrapper.current?.contains(e.relatedTarget as Node | null)) setOpen(false);
  }

  return (
    <form ref={wrapper} action="/products" role="search" onBlur={onBlur} style={skin ?? undefined} data-search-custom={skin ? "" : undefined} className="relative flex min-w-0 flex-1 rounded-xl bg-white ring-2 ring-transparent focus-within:ring-brand-500">
      <Dropdown
        name="category" label="Category" value={category} onChange={setCategory} className="hidden md:block"
        buttonClassName="h-full w-36 rounded-l-xl border-r border-line bg-canvas px-3 text-sm text-muted outline-none focus-visible:outline-2 focus-visible:outline-brand-500"
        panelClassName="min-w-60"
        groups={[
          { options: [{ value: "", label: "All" }] },
          ...categories.map((p) => ({ label: p.name, options: [{ value: p.slug, label: `All ${p.name}` }, ...p.children.map((c) => ({ value: c.slug, label: c.name }))] })),
        ]}
      />
      <input
        name="q" value={q} autoComplete="off" placeholder="Search products, brands and categories"
        onChange={(e) => { setQ(e.target.value); setOpen(true); setActive(-1); }}
        onFocus={() => setOpen(true)} onKeyDown={onKeyDown}
        role="combobox" aria-expanded={showPanel} aria-controls={listId} aria-autocomplete="list"
        aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
        className="min-w-0 flex-1 bg-transparent px-4 py-2.5 text-sm outline-none focus-visible:outline-none"
      />
      <button className="rounded-r-xl bg-brand-500 px-4 text-ink hover:bg-brand-600" aria-label="Search">
        <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
      </button>

      {showPanel && (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-2xl border border-line bg-white shadow-lift">
          {items.length > 0 ? (
            <ul id={listId} role="listbox" aria-label="Suggestions" className="max-h-96 overflow-y-auto py-1">
              {items.map((s, i) => (
                <li key={s.slug} id={`${listId}-${i}`} role="option" aria-selected={i === active}>
                  <button
                    type="button" onMouseEnter={() => setActive(i)} onClick={() => go(s.slug)}
                    className={`flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm ${i === active ? "bg-canvas" : ""}`}
                  >
                    <span className="h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-canvas">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {s.image && <img src={imgSized(s.image, 160)} alt="" className="h-full w-full object-cover" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-ink">{s.name}</span>
                      <span className="block truncate text-xs text-muted">in {s.category}</span>
                    </span>
                    <span className="shrink-0 font-semibold text-ink"><Money paise={s.pricePaise} /></span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            result?.q === term && <p className="px-4 py-3 text-sm text-muted">No quick matches for “{term}”.</p>
          )}
          <button type="submit" className="block w-full border-t border-line px-4 py-3 text-left text-sm font-semibold text-brand-700 hover:bg-canvas">
            See all results for “{term}” →
          </button>
        </div>
      )}
    </form>
  );
}
