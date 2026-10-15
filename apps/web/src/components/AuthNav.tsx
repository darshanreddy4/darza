"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { useAuth, accountLabel } from "@/lib/auth";

export function AuthNav() {
  const { user, logout } = useAuth();
  const menu = useRef<HTMLDetailsElement>(null);

  // The menu is a <details>, which only closes when its own summary is clicked; close it for outside clicks, Escape and page changes too.
  useEffect(() => {
    const el = menu.current;
    if (!el) return;
    const close = () => el.removeAttribute("open");
    const onPointer = (e: PointerEvent) => { if (el.open && !el.contains(e.target as Node)) close(); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && el.open) { close(); el.querySelector("summary")?.focus(); } };
    const onLink = (e: MouseEvent) => { if ((e.target as HTMLElement).closest("a")) close(); };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    el.addEventListener("click", onLink);
    return () => { document.removeEventListener("pointerdown", onPointer); document.removeEventListener("keydown", onKey); el.removeEventListener("click", onLink); };
  }, [user]);

  if (!user) {
    return (
      <div className="flex items-center gap-1">
        <Link href="/login" className="rounded-xl px-3 py-2 text-sm font-medium text-white/90 hover:bg-white/10">Log in</Link>
        <Link href="/signup" className="rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-ink hover:bg-brand-600">Sign up</Link>
      </div>
    );
  }

  return (
    <details ref={menu} className="group relative">
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-xl px-2 py-1.5 text-white/90 hover:bg-white/10 [&::-webkit-details-marker]:hidden">
        <span className="grid h-8 w-8 place-items-center rounded-full bg-linear-to-br from-brand-500 to-gold text-sm font-bold text-ink">{user.name.charAt(0).toUpperCase()}</span>
        <span className="hidden max-w-28 truncate text-sm font-medium md:inline">{user.name}</span>
      </summary>
      <div className="absolute right-0 mt-2 w-56 overflow-hidden rounded-2xl border border-line bg-white py-1 text-sm text-ink shadow-lift">
        <div className="border-b border-line px-4 py-3">
          <p className="truncate font-semibold">{user.name}</p>
          <p className="truncate text-xs text-muted">{accountLabel(user)}</p>
        </div>
        {user.role !== "CUSTOMER" && <Link href="/admin" className="block px-4 py-2.5 hover:bg-canvas">{user.role === "ADMIN" ? "Admin dashboard" : "Staff console"}</Link>}
        <Link href="/orders" className="block px-4 py-2.5 hover:bg-canvas">My orders</Link>
        <Link href="/wishlist" className="block px-4 py-2.5 hover:bg-canvas">Wishlist</Link>
        <Link href="/cart" className="block px-4 py-2.5 hover:bg-canvas">My cart</Link>
        <Link href="/account" className="block px-4 py-2.5 hover:bg-canvas">Account &amp; security</Link>
        <button onClick={logout} className="block w-full px-4 py-2.5 text-left text-red-600 hover:bg-canvas">Log out</button>
      </div>
    </details>
  );
}
