"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { API_URL, formatPrice } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { useAdminApi, useAdminQuery } from "@/lib/admin";
import { Alert, Badge, Card, Empty, PageHeader, Skeleton, btn, inputCls, td, th } from "@/components/admin/ui";
import { Select } from "@/components/Select";

type Role = "CUSTOMER" | "STAFF" | "ADMIN";
interface UserRow { id: string; email: string | null; signIn: string[]; name: string; role: Role; staffRole: { id: string; name: string } | null; emailVerified: boolean; createdAt: string; phone: string; address: string; orders: number; spentPaise: number }
interface UserList { total: number; page: number; pageSize: number; admins: number; roles: { id: string; name: string }[]; items: UserRow[] }

const who = (u: { email: string | null; phone: string; name: string }) => u.email ?? (u.phone || u.name);

export default function UsersPage() {
  const call = useAdminApi();
  const { user: me } = useAuth();
  // Admins manage accounts and team roles; everyone else with access here only looks at customers.
  const admin = me?.role === "ADMIN";
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const [verified, setVerified] = useState("");
  const [page, setPage] = useState(1);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [exporting, setExporting] = useState(false);
  // Search waits for a short pause in typing.
  useEffect(() => {
    const t = setTimeout(() => { setSearch(q.trim()); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [q]);

  const params = new URLSearchParams({ page: String(page) });
  if (search) params.set("q", search);
  if (role) params.set("role", role);
  if (verified) params.set("verified", verified);
  const users = useAdminQuery<UserList>(`/admin/users?${params}`);
  const data = users.data;
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  // Exports everyone matching the filters, not just this page.
  async function exportCsv() {
    setError(""); setExporting(true);
    try {
      const filters = new URLSearchParams();
      if (search) filters.set("q", search);
      if (role) filters.set("role", role);
      if (verified) filters.set("verified", verified);
      const res = await fetch(`${API_URL}/admin/users/export?${filters}`, { credentials: "include" });
      if (!res.ok) throw new Error(`Export failed (${res.status})`);
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = `dmg-users-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) { setError((e as Error).message); } finally { setExporting(false); }
  }

  async function act(fn: () => Promise<unknown>, message: string) {
    setError(""); setNotice("");
    try { await fn(); setNotice(message); users.reload(); } catch (e) { setError((e as Error).message); }
  }

  // The role select holds CUSTOMER, ADMIN or STAFF:<team role id> (empty id: staff from before roles existed).
  const roleValue = (u: UserRow) => (u.role === "STAFF" ? `STAFF:${u.staffRole?.id ?? ""}` : u.role);

  function changeRole(u: UserRow, next: string) {
    if (next === roleValue(u)) return;
    const [role, staffRoleId] = next.split(":") as [Role, string | undefined];
    const teamRole = data?.roles.find((r) => r.id === staffRoleId);
    const text = role === "ADMIN"
      ? `Make ${who(u)} an admin? They will get full access, including the team, roles and store settings.`
      : role === "STAFF"
        ? `Give ${who(u)} the role ${teamRole ? `“${teamRole.name}”` : "staff (the original staff access)"}? They will only see and do what that role allows. You can change a role on the Team & roles page.`
        : `Remove team access from ${who(u)}?`;
    if (!confirm(text)) return;
    void act(() => call(`/admin/users/${u.id}/role`, { method: "PATCH", body: JSON.stringify({ role, staffRoleId: role === "STAFF" ? staffRoleId || null : null }) }), `${who(u)} is now ${role === "ADMIN" ? "an admin" : role === "STAFF" ? (teamRole ? `in the role ${teamRole.name}` : "staff") : "a customer"}`);
  }

  return (
    <>
      <PageHeader title={admin ? "Users" : "Customers"} description={admin ? "Everyone with an account, and who can use this admin area. Give team members a role to control what they can do." : "Everyone who has an account with the store."} actions={can(me, "customers.export") ? <button className={btn.secondary} disabled={exporting || !data?.total} onClick={exportCsv}>{exporting ? "Preparing…" : "Export CSV"}</button> : undefined} />
      {error && <Alert tone="error" onClose={() => setError("")}>{error}</Alert>}
      {notice && <Alert tone="success" onClose={() => setNotice("")}>{notice}</Alert>}
      {users.error && !data && <Alert tone="error">{users.error}</Alert>}

      <div className={`mb-4 grid gap-3 ${admin ? "sm:grid-cols-[1fr_auto_auto]" : "sm:grid-cols-[1fr_auto]"}`}>
        <input className={inputCls} placeholder="Search name, email or phone" aria-label="Search users" value={q} onChange={(e) => setQ(e.target.value)} />
        {admin && <Select className={inputCls} aria-label="Filter by role" value={role} onChange={(e) => { setRole(e.target.value); setPage(1); }}>
          <option value="">All roles</option><option value="ADMIN">Admins</option><option value="STAFF">Team members</option><option value="CUSTOMER">Customers</option>
        </Select>}
        <Select className={inputCls} aria-label="Filter by email status" value={verified} onChange={(e) => { setVerified(e.target.value); setPage(1); }}>
          <option value="">Any email status</option><option value="true">Verified</option><option value="false">Not verified</option>
        </Select>
      </div>

      <Card padded={false}>
        {users.loading && !data ? <Skeleton /> : !data || data.items.length === 0 ? <Empty title="No users found">Try a different search or filter.</Empty> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-line bg-canvas/60"><th className={th}>User</th><th className={th}>Email</th><th className={th}>Phone</th><th className={th}>Address</th><th className={th}>Orders</th><th className={th}>Joined</th>{admin && <th className={th}>Role</th>}{admin && <th className={`${th} text-right`}>Actions</th>}</tr></thead>
              <tbody className="divide-y divide-line">
                {data.items.map((u) => {
                  const self = u.id === me?.id;
                  return (
                    <tr key={u.id} className="hover:bg-canvas/60">
                      <td className={td}><p className="font-semibold"><Link href={`/admin/users/${u.id}`} className="text-brand-700 hover:underline">{u.name}</Link>{self && <span className="ml-2 text-xs font-normal text-muted">(you)</span>}</p></td>
                      <td className={td}>
                        <p>{u.email ?? <span className="text-muted">No email</span>}</p>
                        <span className="flex flex-wrap gap-1"><Badge tone={u.emailVerified ? "green" : "amber"}>{u.emailVerified ? "Verified" : "Not verified"}</Badge>{u.signIn.filter((m) => m !== "email").map((m) => <Badge key={m} tone="slate">{m === "google" ? "Google" : "Phone"}</Badge>)}</span>
                      </td>
                      <td className={`${td} whitespace-nowrap`}>{u.phone || <span className="text-muted">Not provided</span>}</td>
                      <td className={`${td} max-w-64 text-xs text-ink-3`} title={u.address}>{u.address ? <span className="line-clamp-2">{u.address}</span> : <span className="text-muted">Not provided</span>}</td>
                      <td className={td}>{u.orders}{u.spentPaise > 0 && <p className="text-xs text-muted">{formatPrice(u.spentPaise)} spent</p>}</td>
                      <td className={`${td} text-muted`}>{new Date(u.createdAt).toLocaleDateString("en-IN", { dateStyle: "medium" })}</td>
                      {admin && <td className={td}>
                        <Select
                          className={`${inputCls} !w-auto !py-1.5`}
                          aria-label={`Role for ${who(u)}`}
                          value={roleValue(u)}
                          disabled={self}
                          title={self ? "You cannot change your own role" : undefined}
                          onChange={(e) => changeRole(u, e.target.value)}
                        >
                          <option value="CUSTOMER">Customer</option>
                          {u.role === "STAFF" && !u.staffRole && <option value="STAFF:">Staff (original access)</option>}
                          {(data?.roles ?? []).map((r) => <option key={r.id} value={`STAFF:${r.id}`}>{r.name}</option>)}
                          <option value="ADMIN">Admin</option>
                        </Select>
                      </td>}
                      {admin && <td className={`${td} text-right`}>
                        {!self && (
                          <button
                            className={btn.secondary + " !px-3 !py-1.5"}
                            onClick={() => confirm(`Sign ${who(u)} out of every device? They can log in again with their password.`) && act(() => call(`/admin/users/${u.id}/sign-out`, { method: "POST" }), `${who(u)} was signed out everywhere`)}
                          >Sign out everywhere</button>
                        )}
                      </td>}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {data && data.total > 0 && (
        <div className="mt-4 flex items-center justify-between text-sm text-muted">
          <p>{data.total} {data.total === 1 ? "user" : "users"}{admin && <> · {data.admins} {data.admins === 1 ? "admin" : "admins"}</>}</p>
          <div className="flex items-center gap-2">
            <button className={btn.secondary} disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
            <span>Page {page} of {pages}</span>
            <button className={btn.secondary} disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</button>
          </div>
        </div>
      )}
    </>
  );
}
