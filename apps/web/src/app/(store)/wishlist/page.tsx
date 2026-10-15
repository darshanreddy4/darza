"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { API_URL, type Product } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { ProductCard } from "@/components/ProductCard";

export default function WishlistPage() {
  const { user, ready } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<Product[] | null>(null);

  useEffect(() => {
    if (ready && !user) router.replace("/login?next=/wishlist");
  }, [ready, user, router]);

  const userId = user?.id;
  useEffect(() => {
    if (!userId) return;
    let stale = false;
    fetch(`${API_URL}/wishlist`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => { if (!stale) setItems(d); })
      .catch(() => { if (!stale) setItems([]); });
    return () => { stale = true; };
  }, [userId]);

  if (!ready || !user) return <p className="text-sm text-muted">Loading…</p>;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">My wishlist</h1>
      {items === null ? <p className="text-sm text-muted">Loading…</p> : items.length === 0 ? (
        <p className="text-muted">Nothing saved yet. Tap the heart on a product to save it. <Link href="/products" className="text-brand-700 underline">Browse products</Link></p>
      ) : (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">{items.map((p) => <ProductCard key={p.id} product={p} />)}</div>
      )}
    </div>
  );
}
