"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { API_URL } from "@/lib/api";
import { IN_STATES } from "@/lib/states";
import type { SavedAddress } from "@/lib/address";
import { PincodeField } from "@/components/PincodeField";
import { Select } from "@/components/Select";

const field = "w-full rounded-xl border border-line bg-white px-4 py-3 text-sm outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15";

export function SavedAddresses() {
  const [list, setList] = useState<SavedAddress[] | null>(null);
  // "new", an address id being edited, or null when the form is closed.
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let stale = false;
    fetch(`${API_URL}/addresses`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => { if (!stale) setList(d); })
      .catch(() => { if (!stale) setList([]); });
    return () => { stale = true; };
  }, [version]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  const current = list?.find((a) => a.id === editing);

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(""); setBusy(true);
    const f = new FormData(e.currentTarget);
    const text = (k: string) => String(f.get(k) ?? "").trim();
    const body = { label: text("label") || undefined, name: text("name"), phone: text("phone"), line1: text("line1"), line2: text("line2") || undefined, city: text("city"), state: text("state"), pincode: text("pincode"), isDefault: !!f.get("isDefault") };
    try {
      const res = await fetch(`${API_URL}/addresses${current ? `/${current.id}` : ""}`, { method: current ? "PUT" : "POST", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      if (!res.ok) { const d = await res.json().catch(() => null); throw new Error([d?.message].flat().filter(Boolean).join(", ") || "Could not save the address"); }
      setEditing(null); reload();
    } catch (err) { setError((err as Error).message); }
    setBusy(false);
  }

  async function remove(a: SavedAddress) {
    if (!confirm("Delete this address?")) return;
    await fetch(`${API_URL}/addresses/${a.id}`, { method: "DELETE", credentials: "include" }).catch(() => null);
    reload();
  }

  async function makeDefault(a: SavedAddress) {
    await fetch(`${API_URL}/addresses/${a.id}`, {
      method: "PUT", credentials: "include", headers: { "content-type": "application/json" },
      body: JSON.stringify({ label: a.label ?? undefined, name: a.name, phone: a.phone, line1: a.line1, line2: a.line2 ?? undefined, city: a.city, state: a.state, pincode: a.pincode, isDefault: true }),
    }).catch(() => null);
    reload();
  }

  return (
    <section className="rounded-3xl border border-line bg-white p-7 shadow-card">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold">Saved addresses</h2>
        {editing === null && <button type="button" onClick={() => setEditing("new")} className="rounded-xl border border-ink px-4 py-2 text-sm font-semibold hover:bg-ink hover:text-white">+ Add address</button>}
      </div>

      {list === null ? <p className="mt-4 text-sm text-muted">Loading…</p> : list.length === 0 && editing === null ? (
        <p className="mt-4 text-sm text-muted">No saved addresses yet. Add one to check out faster.</p>
      ) : (
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {list.map((a) => (
            <li key={a.id} className="rounded-xl border border-line p-4 text-sm">
              <p className="flex items-center justify-between gap-2 font-semibold">{a.label || a.name}{a.isDefault && <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-semibold text-brand-800 ring-1 ring-brand-200">Default</span>}</p>
              <p className="mt-1 text-muted">{a.name}, {a.line1}{a.line2 ? `, ${a.line2}` : ""}, {a.city}, {a.state} {a.pincode}</p>
              <p className="text-muted">Phone {a.phone}</p>
              <div className="mt-2 flex flex-wrap gap-x-4 text-xs font-semibold [&>button]:px-1 [&>button]:py-1.5">
                <button type="button" onClick={() => setEditing(a.id)} className="text-brand-700 hover:underline">Edit</button>
                {!a.isDefault && <button type="button" onClick={() => makeDefault(a)} className="text-brand-700 hover:underline">Make default</button>}
                <button type="button" onClick={() => remove(a)} className="text-red-600 hover:underline">Delete</button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {editing !== null && (
        <form key={editing} onSubmit={save} className="mt-5 space-y-4 border-t border-line pt-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <input name="label" maxLength={30} defaultValue={current?.label ?? ""} placeholder="Label, e.g. Home (optional)" className={field} />
            <input name="name" required defaultValue={current?.name ?? ""} placeholder="Full name" autoComplete="name" className={field} />
            <input name="phone" required pattern="[6-9][0-9]{9}" inputMode="numeric" defaultValue={current?.phone ?? ""} placeholder="10-digit mobile number" className={field} />
            <PincodeField defaultValue={current?.pincode ?? ""} className={field} />
            <input name="line1" required minLength={3} defaultValue={current?.line1 ?? ""} placeholder="Address line 1" className={`${field} sm:col-span-2`} />
            <input name="line2" defaultValue={current?.line2 ?? ""} placeholder="Address line 2 (optional)" className={`${field} sm:col-span-2`} />
            <input name="city" required defaultValue={current?.city ?? ""} placeholder="City" className={field} />
            <Select name="state" required defaultValue={current?.state ?? ""} aria-label="State" className={field}>
              <option value="" disabled>Select state</option>
              {IN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
            </Select>
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isDefault" defaultChecked={current?.isDefault ?? false} className="h-4 w-4 accent-emerald-600" /> Use as my default address</label>
          {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <div className="flex gap-3">
            <button disabled={busy} className="rounded-xl bg-ink px-6 py-3 text-sm font-semibold text-white hover:bg-ink-3 disabled:opacity-60">{busy ? "Saving…" : "Save address"}</button>
            <button type="button" onClick={() => { setEditing(null); setError(""); }} className="rounded-xl border border-line px-5 py-3 text-sm font-medium hover:bg-canvas">Cancel</button>
          </div>
        </form>
      )}
    </section>
  );
}
