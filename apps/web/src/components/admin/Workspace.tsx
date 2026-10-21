"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { mayVisit } from "@/lib/permissions";
import { NAV } from "@/components/admin/AdminShell";
import { Card, PageHeader } from "@/components/admin/ui";

// The start page for team members whose role is about one part of the business: a way into the sections they may use.
export function Workspace() {
  const { user } = useAuth();
  const sections = NAV.filter((n) => n.href !== "/admin" && mayVisit(user, n.href));
  const role = user?.staffRoleName;

  return (
    <>
      <PageHeader title={`Welcome, ${user?.name.split(" ")[0] ?? ""}`} description={role ? `You are signed in as ${role}. These are the parts of the store your role covers.` : "These are the parts of the store your role covers."} />
      {sections.length === 0 ? (
        <Card><p className="text-sm text-muted">Your role has no admin sections yet. Ask an admin to update your role.</p></Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sections.map((n) => (
            <Link key={n.href} href={n.href} className="flex items-center gap-3 rounded-2xl border border-line bg-white p-5 shadow-card transition hover:-translate-y-0.5 hover:border-brand-500">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-canvas text-brand-700">
                <svg aria-hidden width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={n.icon} /></svg>
              </span>
              <span className="font-semibold">{n.label}</span>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
