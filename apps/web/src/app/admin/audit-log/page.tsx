"use client";

import { Fragment, useState } from "react";
import { useAdminApi, useAdminQuery } from "@/lib/admin";
import { Alert, Badge, Card, Empty, PageHeader, Skeleton, btn, inputCls, td, th } from "@/components/admin/ui";

interface Entry { id: string; actorId: string | null; actorName: string; actorRole: "CUSTOMER" | "STAFF" | "ADMIN"; action: string; summary: string; entity: string | null; entityId: string | null; details: Record<string, unknown> | null; createdAt: string }
interface Page { items: Entry[]; nextBefore: string | null; actors: { id: string | null; name: string }[]; entities: string[] }

const when = (iso: string) => new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "medium" });

export default function AuditLogPage() {
  const call = useAdminApi();
  const [actorId, setActorId] = useState("");
  const [entity, setEntity] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [older, setOlder] = useState<{ key: string; items: Entry[]; next: string | null } | null>(null);
  const [more, setMore] = useState(false);
  const [moreError, setMoreError] = useState("");

  const filters = new URLSearchParams();
  if (actorId) filters.set("actorId", actorId);
  if (entity) filters.set("entity", entity);
  const key = filters.toString();
  const first = useAdminQuery<Page>(`/admin/audit-log?${key}`);

  // Older pages belong to the filters they were loaded with.
  const extra = older && older.key === key ? older : null;
  const items = [...(first.data?.items ?? []), ...(extra?.items ?? [])];
  const next = extra ? extra.next : first.data?.nextBefore ?? null;
  const actors = first.data?.actors ?? [];
  const entities = first.data?.entities ?? [];
  const loading = first.loading;
  const error = first.error || moreError;

  async function loadOlder() {
    if (!next) return;
    setMoreError(""); setMore(true);
    const p = new URLSearchParams(filters);
    p.set("before", next);
    try {
      const page = await call<Page>(`/admin/audit-log?${p}`);
      setOlder({ key, items: [...(extra?.items ?? []), ...page.items], next: page.nextBefore });
    } catch (e) { setMoreError((e as Error).message); }
    setMore(false);
  }

  return (
    <>
      <PageHeader
        title="Audit log"
        description="Every change made in the admin area, newest first: who did it, when, and what was changed."
        actions={
          <div className="flex flex-wrap gap-2">
            <select value={actorId} onChange={(e) => setActorId(e.target.value)} className={`${inputCls} !w-auto`} aria-label="Filter by person">
              <option value="">Everyone</option>
              {actors.filter((a) => a.id).map((a) => <option key={a.id} value={a.id!}>{a.name}</option>)}
            </select>
            <select value={entity} onChange={(e) => setEntity(e.target.value)} className={`${inputCls} !w-auto`} aria-label="Filter by area">
              <option value="">All areas</option>
              {entities.map((e) => <option key={e} value={e}>{e}</option>)}
            </select>
          </div>
        }
      />
      {error && <Alert tone="error" onClose={() => setMoreError("")}>{error}</Alert>}

      <Card padded={false}>
        {loading && items.length === 0 ? <Skeleton rows={5} /> : items.length === 0 ? <Empty title="Nothing logged yet">Changes made in the admin area show up here.</Empty> : (
          <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Audit log">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-line bg-canvas/60"><th className={th}>When</th><th className={th}>Who</th><th className={th}>What</th><th className={th}><span className="sr-only">Details</span></th></tr></thead>
              <tbody className="divide-y divide-line">
                {items.map((e) => (
                  <Fragment key={e.id}>
                    <tr>
                      <td className={`${td} whitespace-nowrap text-xs text-muted`}>{when(e.createdAt)}</td>
                      <td className={td}><span className="font-medium">{e.actorName}</span> <Badge tone={e.actorRole === "ADMIN" ? "amber" : "slate"}>{e.actorRole === "ADMIN" ? "Admin" : e.actorRole === "STAFF" ? "Staff" : "Customer"}</Badge></td>
                      <td className={td}>{e.action.endsWith(".blocked") ? <span className="text-red-700">{e.summary}</span> : e.summary}</td>
                      <td className={`${td} text-right`}>{e.details && <button type="button" aria-expanded={open === e.id} onClick={() => setOpen(open === e.id ? null : e.id)} className="py-1.5 text-xs font-semibold text-brand-700 hover:underline">{open === e.id ? "Hide" : "Details"}</button>}</td>
                    </tr>
                    {open === e.id && e.details && (
                      <tr><td colSpan={4} className="bg-canvas/60 px-5 py-3"><pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words text-xs">{JSON.stringify(e.details, null, 2)}</pre>{e.entityId && <p className="mt-2 text-xs text-muted">{e.entity} {e.entityId}</p>}</td></tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {next && <div className="border-t border-line p-4"><button type="button" disabled={more} onClick={loadOlder} className={btn.secondary}>{more ? "Loading…" : "Load older entries"}</button></div>}
      </Card>
    </>
  );
}
