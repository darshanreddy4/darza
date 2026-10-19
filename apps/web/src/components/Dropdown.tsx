"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";

export interface DropdownOption { value: string; label: string; detail?: string; disabled?: boolean }
export interface DropdownGroup { label?: string; options: DropdownOption[] }

interface Props {
  // Accessible name of the button; leave out when a surrounding <label> already names it.
  label?: string;
  value?: string;
  defaultValue?: string;
  groups: DropdownGroup[];
  onChange?: (value: string) => void;
  // Submitted with a surrounding form under this name.
  name?: string;
  required?: boolean;
  disabled?: boolean;
  id?: string;
  title?: string;
  autoComplete?: string;
  className?: string;
  buttonClassName?: string;
  panelClassName?: string;
  align?: "left" | "right";
  // Marks the button so each store look can style it like its other form fields.
  field?: boolean;
  renderValue?: (option: DropdownOption) => ReactNode;
}

interface Place { left: number; right: number; width: number; top: number; bottom: number; up: boolean; maxHeight: number }

// A select that opens as a tidy list attached to its button (below it, or above when there is no room), is never clipped by
// scrolling tables or cards, and works from the keyboard, a screen reader and browser autofill.
export function Dropdown({
  label, value: controlled, defaultValue = "", groups, onChange, name, required, disabled, id, title, autoComplete,
  className = "", buttonClassName = "", panelClassName = "", align = "left", field, renderValue,
}: Props) {
  const listId = useId();
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const typed = useRef({ text: "", timer: 0 as unknown as ReturnType<typeof setTimeout> });
  const [inner, setInner] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [place, setPlace] = useState<Place | null>(null);
  const [invalid, setInvalid] = useState(false);
  // The panel is drawn inside the shop's look (so it matches) when there is one, else on the page.
  const [target, setTarget] = useState<Element | null>(null);

  const value = controlled ?? inner;
  const flat = groups.flatMap((g) => g.options);
  const selected = flat.find((o) => o.value === value) ?? (value === "" ? undefined : flat[0]);
  const shown = selected ?? flat.find((o) => o.value === "") ?? flat[0];
  const isPlaceholder = !!shown && shown.value === "" && !!shown.disabled;

  const measure = useCallback(() => {
    const el = button.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const below = window.innerHeight - r.bottom - 12;
    const above = r.top - 12;
    const up = below < 220 && above > below;
    setPlace({ left: r.left, right: window.innerWidth - r.right, width: r.width, top: r.bottom + 6, bottom: window.innerHeight - r.top + 6, up, maxHeight: Math.max(96, Math.min(320, up ? above : below)) });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => { window.removeEventListener("resize", measure); window.removeEventListener("scroll", measure, true); };
  }, [open, measure]);

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!root.current?.contains(t) && !list.current?.contains(t)) setOpen(false);
    };
    document.addEventListener("mousedown", away);
    return () => document.removeEventListener("mousedown", away);
  }, [open]);

  useEffect(() => {
    if (!open || !place) return;
    list.current?.focus({ preventScroll: true });
    list.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [open, place, active]);

  const enabled = (i: number) => !!flat[i] && !flat[i].disabled;
  const step = (from: number, dir: 1 | -1) => {
    for (let i = from + dir; i >= 0 && i < flat.length; i += dir) if (enabled(i)) return i;
    return from;
  };

  function show(start?: number) {
    if (disabled) return;
    setTarget(root.current?.closest("[data-theme]") ?? document.body);
    const current = flat.findIndex((o) => o.value === value);
    setActive(start ?? (current >= 0 ? current : Math.max(0, flat.findIndex((_, i) => enabled(i)))));
    setOpen(true);
  }
  function close(refocus = true) {
    setOpen(false);
    if (refocus) button.current?.focus();
  }
  function commit(next: string) {
    setInner(next);
    setInvalid(false);
    onChange?.(next);
  }
  function choose(i: number) {
    if (!enabled(i)) return;
    commit(flat[i].value);
    close();
  }

  // Typing letters jumps to the first option that starts with them, like a native select.
  function typeAhead(key: string, from: number) {
    window.clearTimeout(typed.current.timer);
    typed.current.text += key.toLowerCase();
    typed.current.timer = setTimeout(() => { typed.current.text = ""; }, 700);
    const text = typed.current.text;
    const order = [...flat.keys()];
    const start = text.length === 1 ? from + 1 : from;
    const found = [...order.slice(start), ...order.slice(0, start)].find((i) => enabled(i) && flat[i].label.toLowerCase().startsWith(text));
    return found;
  }

  function onButtonKey(e: KeyboardEvent) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); show(); return; }
    if (e.key.length === 1 && e.key !== " " && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const hit = typeAhead(e.key, Math.max(0, flat.findIndex((o) => o.value === value)));
      if (hit !== undefined) { e.preventDefault(); show(hit); }
    }
  }
  function onListKey(e: KeyboardEvent) {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => step(i, 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => step(i, -1)); }
    else if (e.key === "Home") { e.preventDefault(); setActive(step(-1, 1)); }
    else if (e.key === "End") { e.preventDefault(); setActive(step(flat.length, -1)); }
    else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); choose(active); }
    else if (e.key === "Escape") { e.preventDefault(); close(); }
    else if (e.key === "Tab") close(false);
    else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const hit = typeAhead(e.key, active);
      if (hit !== undefined) { e.preventDefault(); setActive(hit); }
    }
  }

  // Browser autofill (for example a saved state or country) fills the hidden field, which picks the matching option.
  function fill(text: string) {
    const t = text.trim().toLowerCase();
    const hit = flat.find((o) => !o.disabled && (o.value.toLowerCase() === t || o.label.toLowerCase() === t));
    if (hit) commit(hit.value);
  }

  const panelStyle = place && {
    position: "fixed" as const,
    zIndex: 70,
    minWidth: place.width,
    maxHeight: place.maxHeight,
    ...(align === "right" ? { right: place.right } : { left: place.left }),
    ...(place.up ? { bottom: place.bottom } : { top: place.top }),
  };

  return (
    <div ref={root} className={`relative ${className}`}>
      <button
        ref={button} id={id} type="button" title={title} disabled={disabled} aria-label={label} aria-haspopup="listbox" aria-expanded={open}
        aria-controls={open ? listId : undefined} data-select={field ? "" : undefined}
        onClick={() => (open ? close(false) : show())} onKeyDown={onButtonKey}
        className={`flex w-full items-center justify-between gap-2 text-left disabled:cursor-not-allowed disabled:opacity-60 ${invalid ? "!border-red-500" : ""} ${buttonClassName}`}
      >
        <span className={`truncate ${isPlaceholder ? "text-muted" : ""}`}>{shown ? (renderValue && !isPlaceholder ? renderValue(shown) : shown.label) : ""}</span>
        <svg aria-hidden width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={`shrink-0 transition-transform ${open ? "rotate-180" : ""}`}><path d="m6 9 6 6 6-6" /></svg>
      </button>

      {(name !== undefined || required) && (
        <input
          name={name} value={value} required={required} disabled={disabled} autoComplete={autoComplete} tabIndex={-1} aria-hidden
          onChange={(e) => fill(e.target.value)} onInvalid={() => { setInvalid(true); button.current?.focus(); }}
          className="pointer-events-none absolute inset-0 h-full w-full opacity-0"
        />
      )}
      {open && target && createPortal(
        <div
          ref={list} id={listId} role="listbox" tabIndex={-1} aria-label={label ? `${label} choices` : "Choices"} aria-activedescendant={`${listId}-${active}`}
          style={panelStyle || { position: "fixed", visibility: "hidden" }}
          onKeyDown={onListKey} onBlur={(e) => { const t = e.relatedTarget as Node | null; if (!root.current?.contains(t) && !list.current?.contains(t)) setOpen(false); }}
          onMouseDown={(e) => e.preventDefault()}
          className={`w-max max-w-[85vw] overflow-y-auto rounded-xl border border-line bg-white py-1.5 text-sm text-ink shadow-lift outline-none ${panelClassName}`}
        >
          {groups.map((g, gi) => {
            const start = groups.slice(0, gi).reduce((n, x) => n + x.options.length, 0);
            const options = g.options.map((o, oi) => {
              const i = start + oi;
              const isSelected = o.value === value && !o.disabled;
              return (
                <div
                  key={`${o.value}-${oi}`} id={`${listId}-${i}`} data-index={i} data-value={o.value} role="option" aria-selected={isSelected} aria-disabled={o.disabled || undefined}
                  onMouseEnter={() => enabled(i) && setActive(i)} onClick={() => choose(i)}
                  className={`flex items-center gap-3 px-3.5 py-2 ${o.disabled ? "cursor-not-allowed text-muted opacity-60" : "cursor-pointer"} ${i === active && !o.disabled ? "bg-canvas" : ""} ${isSelected ? "font-semibold" : ""}`}
                >
                  <span className="min-w-0 flex-1 truncate">{o.label}{o.detail && <span className="ml-2 font-normal text-muted">{o.detail}</span>}</span>
                  <svg aria-hidden width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className={`shrink-0 text-brand-700 ${isSelected ? "" : "invisible"}`}><path d="m5 12 5 5 9-10" /></svg>
                </div>
              );
            });
            return g.label ? (
              <div key={g.label + gi} role="group" aria-label={g.label} className={gi > 0 ? "mt-1 border-t border-line pt-1" : ""}>
                <div aria-hidden className="px-3.5 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted">{g.label}</div>
                {options}
              </div>
            ) : <div key={gi} role="presentation">{options}</div>;
          })}
        </div>,
        target,
      )}
    </div>
  );
}
