"use client";

import { useEffect, useState } from "react";
import { API_URL, type Product } from "@/lib/api";
import { ProductCarousel } from "./ProductCarousel";

const KEY = "dmg-recent";

// Remembers the last products this visitor opened and shows the others as a carousel.
export function RecentlyViewed({ productId }: { productId: string }) {
  const [items, setItems] = useState<Product[]>([]);

  useEffect(() => {
    let stale = false;
    let ids: string[] = [];
    try { ids = JSON.parse(localStorage.getItem(KEY) ?? "[]"); } catch {}
    const others = ids.filter((id) => id !== productId).slice(0, 12);
    localStorage.setItem(KEY, JSON.stringify([productId, ...others].slice(0, 16)));
    if (others.length === 0) return;

    fetch(`${API_URL}/products/by-ids?ids=${others.join(",")}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((d: Product[]) => { if (!stale) setItems(d); })
      .catch(() => {});
    return () => { stale = true; };
  }, [productId]);

  return <ProductCarousel title="Your recently viewed items" subtitle="Pick up where you left off" items={items} />;
}
