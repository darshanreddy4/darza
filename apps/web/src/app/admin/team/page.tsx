"use client";

import { useState } from "react";
import { useAdminApi, useAdminQuery } from "@/lib/admin";
import { Alert, Badge, Card, Empty, PageHeader, Skeleton, btn, inputCls, td, th } from "@/components/admin/ui";
import { Select } from "@/components/Select";

interface PermissionDef { key: string; label: string; description: string; sensitive?: boolean }
interface Group { key: string; label: string; permissions: PermissionDef[] }
interface Member { id: string; name: string; email: string | null }
interface TeamRole { id: string; name: string; description: string; permissions: string[]; members: Member[] }
interface Template { name: string; description: string; permissions: string[] }
interface TeamData { roles: TeamRole[]; unassigned: Member[]; legacyPermissions: string[]; groups: Group[]; requires: Record<string, string[]>; templates: Template[] }
interface Draft { id?: string; name: string; description: string; permissions: string[] }

const label = "block text-sm font-medium";

export default function TeamPage() {
  const call = useAdminApi();
  const team = useAdminQuery<TeamData>("/admin/roles");
  const data = team.data;
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const nameOf = (key: string) => data?.groups.flatMap((g) => g.permissions).find((p) => p.key === key)?.label ?? key;

  async function act(fn: () => Promise<unknown>, message: string) {
    setError(""); setNotice(""); setBusy(true);
    try { await fn(); setNotice(message); team.reload(); return true; } catch (e) { setError((e as Error).message); return false; } finally { setBusy(false); }
  }

  // Ticking something that needs another permission ticks that one too; clearing one clears what needs it.
  function toggle(key: string, on: boolean) {
    if (!draft || !data) return;
    const next = new Set(draft.permissions);
    if (on) { next.add(key); (data.requires[key] ?? []).forEach((k) => next.add(k)); }
    else { next.delete(key); for (const [k, needs] of Object.entries(data.requires)) if (needs.includes(key)) next.delete(k); }
    setDraft({ ...draft, permissions: [...next] });
  }

  async function save() {
    if (!draft) return;
    const body = JSON.stringify({ name: draft.name.trim(), description: draft.description.trim(), permissions: draft.permissions });
    const ok = await act(() => call(draft.id ? `/admin/roles/${draft.id}` : "/admin/roles", { method: draft.id ? "PUT" : "POST", body }), draft.id ? "Role saved. It applies to its members straight away." : "Role created");
    if (ok) setDraft(null);
  }

  function setMemberRole(m: Member, value: string) {
    const [role, staffRoleId] = value.split(":") as ["CUSTOMER" | "STAFF", string | undefined];
    if (role === "CUSTOMER" && !confirm(`Remove ${m.name} from the team? They become an ordinary customer.`)) return;
    void act(() => call(`/admin/users/${m.id}/role`, { method: "PATCH", body: JSON.stringify({ role, staffRoleId: role === "STAFF" ? staffRoleId || null : null }) }), role === "CUSTOMER" ? `${m.name} was removed from the team` : `${m.name} has a new role`);
  }

  const members: (Member & { roleId: string })[] = data ? [...data.roles.flatMap((r) => r.members.map((m) => ({ ...m, roleId: r.id }))), ...data.unassigned.map((m) => ({ ...m, roleId: "" }))].sort((a, b) => a.name.localeCompare(b.name)) : [];

  return (
    <>
      <PageHeader
        title="Team & roles"
        description="Only admins see this page. Make a role for each kind of job, choose exactly what it may do, then give team members a role on the Users page or below."
        actions={<button className={btn.primary} onClick={() => { setError(""); setNotice(""); setDraft({ name: "", description: "", permissions: [] }); }}>+ New role</button>}
      />
      {error && <Alert tone="error" onClose={() => setError("")}>{error}</Alert>}
      {notice && <Alert tone="success" onClose={() => setNotice("")}>{notice}</Alert>}
      {team.error && !data && <Alert tone="error">{team.error}</Alert>}

      {draft && data && (
        <Card title={draft.id ? `Edit role: ${draft.name || "role"}` : "New role"} description="Admins always have every permission and are the only ones who can manage the team and its roles.">
          <div className="space-y-5">
            {!draft.id && (
              <label className={label}>Start from a ready-made role
                <Select className={`${inputCls} mt-1.5`} aria-label="Start from a ready-made role" value="" onChange={(e) => { const t = data.templates.find((x) => x.name === e.target.value); if (t) setDraft({ ...draft, name: t.name, description: t.description, permissions: t.permissions }); }}>
                  <option value="">Blank role</option>
                  {data.templates.map((t) => <option key={t.name} value={t.name}>{t.name}</option>)}
                </Select>
              </label>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <label className={label}>Role name<input value={draft.name} maxLength={60} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Customer care executive" className={`${inputCls} mt-1.5`} /></label>
              <label className={label}>What this role is for <span className="font-normal text-muted">optional</span><input value={draft.description} maxLength={200} onChange={(e) => setDraft({ ...draft, description: e.target.value })} className={`${inputCls} mt-1.5`} /></label>
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              {data.groups.map((g) => (
                <fieldset key={g.key} className="rounded-xl border border-line p-4">
                  <legend className="px-1 text-xs font-semibold uppercase tracking-wider text-muted">{g.label}</legend>
                  <ul className="space-y-3">
                    {g.permissions.map((p) => (
                      <li key={p.key}>
                        <label className="flex cursor-pointer items-start gap-3 text-sm">
                          <input type="checkbox" className="mt-1 h-4 w-4 accent-brand-600" checked={draft.permissions.includes(p.key)} onChange={(e) => toggle(p.key, e.target.checked)} />
                          <span><span className="font-medium">{p.label}</span>{p.sensitive && <Badge tone="amber">Sensitive</Badge>}<span className="block text-xs text-muted">{p.description}</span></span>
                        </label>
                      </li>
                    ))}
                  </ul>
                </fieldset>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button className={btn.primary} disabled={busy || draft.name.trim().length < 2 || draft.permissions.length === 0} onClick={save}>{busy ? "Saving\u2026" : draft.id ? "Save role" : "Create role"}</button>
              <button className={btn.secondary} onClick={() => setDraft(null)}>Cancel</button>
              <span className="text-xs text-muted">{draft.permissions.length} {draft.permissions.length === 1 ? "permission" : "permissions"} chosen</span>
            </div>
          </div>
        </Card>
      )}

      <Card title="Roles" description="What each kind of team member can do." className={draft ? "mt-6" : ""} padded={false}>
        {team.loading && !data ? <Skeleton /> : !data || data.roles.length === 0 ? (
          <Empty title="No roles yet">Create a role such as Customer care executive or Finance, then give it to a team member. You can start from a ready-made role.</Empty>
        ) : (
          <ul className="divide-y divide-line">
            {data.roles.map((r) => (
              <li key={r.id} className="p-5" aria-label={`Role ${r.name}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold">{r.name} <span className="ml-1 text-xs font-normal text-muted">{r.members.length} {r.members.length === 1 ? "member" : "members"}</span></p>
                    {r.description && <p className="mt-0.5 text-sm text-muted">{r.description}</p>}
                  </div>
                  <div className="flex gap-2">
                    <button className={btn.secondary + " !px-3 !py-1.5"} onClick={() => { setError(""); setNotice(""); setDraft({ id: r.id, name: r.name, description: r.description, permissions: r.permissions }); window.scrollTo({ top: 0, behavior: "smooth" }); }}>Edit</button>
                    <button className={btn.danger} disabled={busy} onClick={() => confirm(`Delete the role \u201c${r.name}\u201d?`) && act(() => call(`/admin/roles/${r.id}`, { method: "DELETE" }), "Role deleted")}>Delete</button>
                  </div>
                </div>
                <p className="mt-3 flex flex-wrap gap-1.5">{r.permissions.map((k) => <span key={k} className="rounded-full bg-canvas px-2.5 py-1 text-xs font-medium text-ink-3 ring-1 ring-line">{nameOf(k)}</span>)}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Team members" description="Everyone who works in the admin area besides admins. Changing a role takes effect on their next click." className="mt-6" padded={false}>
        {!data ? <Skeleton /> : members.length === 0 ? (
          <Empty title="No team members yet">Open Users, pick a person who has an account and choose a role for them.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-line bg-canvas/60"><th className={th}>Name</th><th className={th}>Email</th><th className={th}>Role</th></tr></thead>
              <tbody className="divide-y divide-line">
                {members.map((m) => (
                  <tr key={m.id}>
                    <td className={td}>{m.name}</td>
                    <td className={`${td} text-muted`}>{m.email ?? "\u2014"}</td>
                    <td className={td}>
                      <Select className={`${inputCls} !w-auto !py-1.5`} aria-label={`Role for ${m.name}`} value={`STAFF:${m.roleId}`} disabled={busy} onChange={(e) => setMemberRole(m, e.target.value)}>
                        {!m.roleId && <option value="STAFF:">Original staff access</option>}
                        {data.roles.map((r) => <option key={r.id} value={`STAFF:${r.id}`}>{r.name}</option>)}
                        <option value="CUSTOMER">Remove from team</option>
                      </Select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data && data.unassigned.length > 0 && (
          <p className="border-t border-line px-5 py-3 text-xs text-muted">Members on &ldquo;Original staff access&rdquo; can handle orders and returns, answer questions and see products without costs ({data.legacyPermissions.map(nameOf).join(", ").toLowerCase()}). Give them a role to be exact.</p>
        )}
      </Card>
    </>
  );
}
