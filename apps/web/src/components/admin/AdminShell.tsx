"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { Logo } from "@/components/Logo";
import { useAuth, accountLabel } from "@/lib/auth";
import { useBrandProfile } from "@/components/BrandProvider";
import { isTeam, staffMayVisit } from "@/lib/permissions";

const NAV = [
  { href: "/admin", label: "Overview", icon: "M3 12l9-9 9 9M5 10v10h5v-6h4v6h5V10" },
  { href: "/admin/home", label: "Home page", icon: "M3 3h8v8H3zM13 3h8v5h-8zM13 11h8v10h-8zM3 14h8v7H3z" },
  { href: "/admin/analytics", label: "Analytics", icon: "M4 20V10M10 20V4M16 20v-7M22 20H2" },
  { href: "/admin/orders", label: "Orders", icon: "M6 2l-3 4v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4zM3 6h18M16 10a4 4 0 0 1-8 0" },
  { href: "/admin/returns", label: "Returns", icon: "M9 14L4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3" },
  { href: "/admin/abandoned-carts", label: "Abandoned carts", icon: "M6 2l-3 4v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4zM3 6h18M9 12l6 4M15 12l-6 4" },
  { href: "/admin/products", label: "Products", icon: "M21 8l-9-5-9 5v8l9 5 9-5zM3 8l9 5 9-5M12 13v8" },
  { href: "/admin/questions", label: "Questions", icon: "M9 9a3 3 0 1 1 4.2 2.8c-.8.4-1.2 1-1.2 1.700M12 17h.01M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z" },
  { href: "/admin/categories", label: "Categories", icon: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" },
  { href: "/admin/users", label: "Users", icon: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8" },
  { href: "/admin/coupons", label: "Coupons", icon: "M20 12a2 2 0 0 0 2 2v4a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-4a2 2 0 0 0 0-4V6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v4a2 2 0 0 0-2 2zM9 9l6 6M9.5 9.5h.01M14.5 14.5h.01" },
  { href: "/admin/banners", label: "Banners", icon: "M3 5h18v10H3zM8 19h8M12 15v4" },
  { href: "/admin/clicks", label: "Affiliate clicks", icon: "M9 3l-6 6 6 6M15 21l6-6-6-6M14 4l-4 16" },
  { href: "/admin/appearance", label: "Appearance & currency", icon: "M12 3a9 9 0 1 0 0 18c1.1 0 2-.9 2-2 0-.5-.2-1-.5-1.300-.3-.3-.5-.8-.5-1.300 0-1.100.9-2 2-2h2.300a3.900 3.900 0 0 0 3.700-4C21 6.100 17 3 12 3zM7.500 12a1 1 0 1 0 0-.01M10 8a1 1 0 1 0 0-.01M14.500 8a1 1 0 1 0 0-.01" },
  { href: "/admin/pages", label: "Pages & policies", icon: "M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5M9 13h6M9 17h6" },
  { href: "/admin/brand", label: "Brand & contact", icon: "M12 2l3 6 6 .9-4.500 4.300 1.100 6.300L12 16.500 6.400 19.500l1.100-6.300L3 8.900 9 8z" },
  { href: "/admin/audit-log", label: "Audit log", icon: "M9 11l3 3 8-8M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h9" },
  { href: "/admin/settings", label: "Settings", icon: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const brand = useBrandProfile();
  const { user, ready, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const staff = user?.role === "STAFF";
  useEffect(() => {
    if (ready && !user) router.replace("/login");
    // Staff land on orders and are sent back there from anything that is for admins only.
    if (staff && !staffMayVisit(pathname)) router.replace("/admin/orders");
  }, [ready, user, staff, pathname, router]);

  if (!ready || !user) return <div className="grid min-h-screen place-items-center text-sm text-muted">Loading…</div>;
  if (!isTeam(user)) {
    return (
      <div className="grid min-h-screen place-items-center px-6">
        <div className="max-w-sm rounded-2xl border border-line bg-white p-8 text-center shadow-card">
          <h1 className="text-xl font-bold">Admin access required</h1>
          <p className="mt-2 text-sm text-muted">Your account does not have permission to view this area.</p>
          <Link href="/" className="mt-6 inline-block rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white">Back to store</Link>
        </div>
      </div>
    );
  }

  if (staff && !staffMayVisit(pathname)) return <div className="grid min-h-screen place-items-center text-sm text-muted">Loading…</div>;
  const nav = NAV.filter((n) => !staff || staffMayVisit(n.href));
  const isActive = (href: string) => (href === "/admin" ? pathname === "/admin" : pathname.startsWith(href));

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[256px_1fr]">
      <aside className="bg-ink text-white/70 lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col">
        <div className="flex items-center justify-between px-5 py-5 lg:block">
          <Link href="/admin"><Logo name={brand.name} logoUrl={brand.logoUrl || undefined} onBadge={brand.logoOnBadge} design={brand.logoDesign} /></Link>
          <p className="hidden pt-2 text-[11px] font-semibold uppercase tracking-widest text-white/60 lg:block">{staff ? "Staff console" : "Admin console"}</p>
        </div>
        <nav className="no-scrollbar flex gap-1 overflow-x-auto px-3 pb-3 lg:min-h-0 lg:flex-1 lg:flex-col lg:overflow-y-auto lg:overflow-x-hidden lg:pb-0" aria-label="Admin">
          {nav.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              aria-current={isActive(n.href) ? "page" : undefined}
              className={`flex shrink-0 items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${isActive(n.href) ? "bg-white/10 text-white" : "hover:bg-white/5 hover:text-white"}`}
            >
              <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={n.icon} /></svg>
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="hidden border-t border-white/10 p-4 lg:block">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-linear-to-br from-brand-500 to-gold text-sm font-bold text-ink">{user.name.charAt(0).toUpperCase()}</span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">{user.name}</p>
              <p className="truncate text-xs text-white/50">{accountLabel(user)}</p>
            </div>
          </div>
          <button onClick={() => { logout(); router.replace("/login"); }} className="mt-3 w-full rounded-lg border border-white/15 px-3 py-2 text-sm font-medium text-white/80 hover:bg-white/5">Log out</button>
        </div>
      </aside>

      <div className="min-w-0">
        <div className="flex items-center justify-between border-b border-line bg-white px-6 py-3 text-sm">
          <span className="text-muted">{brand.name} {staff ? "staff" : "administration"}</span>
          <div className="flex items-center gap-4">
            <Link href="/" target="_blank" className="font-medium text-brand-700 hover:underline">View store ↗</Link>
            <button onClick={() => { logout(); router.replace("/login"); }} className="px-2 py-1.5 font-medium text-muted hover:text-ink lg:hidden">Log out</button>
          </div>
        </div>
        <main className="mx-auto max-w-6xl p-6">{children}</main>
      </div>
    </div>
  );
}
