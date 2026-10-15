"use client";

import { useCallback, useEffect, useState } from "react";
import { API_URL } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export interface AdminProduct {
  id: string; name: string; slug: string; description: string; brand: string | null; specifications: Record<string, string>;
  categoryId: string; productType: "OWN" | "AFFILIATE"; status: "DRAFT" | "PUBLISHED"; featured: boolean;
  pricePaise: number; mrpPaise: number | null; sellerName: string; deliveryInfo: string | null; returnPolicy: string | null;
  sku: string | null; stock: number | null; costPaise: number | null; platform: string | null; affiliateUrl: string | null; affiliateDisclosure: string | null;
  images: { url: string; alt: string | null }[]; videoUrls: string[]; highlights: string[]; createdAt: string; updatedAt: string;
  showRating: boolean; dealLabel: string | null; deliveryDays: number | null; freeDelivery: boolean; showAddToCart: boolean; gstRatePercent: number;
}
export interface AdminCategory { id: string; name: string; slug: string; parentId: string | null }
export interface ClickRow { product?: { name: string; slug: string }; platform: string | null; clicks: number }

export interface AdminBanner {
  id: string; title: string; subtitle: string | null; imageUrl: string; ctaLabel: string | null; linkUrl: string | null;
  textTone: "LIGHT" | "DARK"; position: number; active: boolean; startsAt: string | null; endsAt: string | null; showCountdown: boolean; clickCount: number;
  videoUrl: string | null; sponsorName: string | null; impressionCount: number;
  textPosition: string; buttonPosition: string | null;
}

export type BannerStatus = "live" | "scheduled" | "expired" | "off";
export function bannerStatus(b: Pick<AdminBanner, "active" | "startsAt" | "endsAt">, now = Date.now()): BannerStatus {
  if (!b.active) return "off";
  if (b.startsAt && new Date(b.startsAt).getTime() > now) return "scheduled";
  if (b.endsAt && new Date(b.endsAt).getTime() <= now) return "expired";
  return "live";
}

export function useAdminApi() {
  const { logout } = useAuth();
  return useCallback(async <T,>(path: string, init: RequestInit = {}): Promise<T> => {
    const res = await fetch(`${API_URL}${path}`, {
      ...init,
      credentials: "include",
      headers: { "content-type": "application/json", ...init.headers },
    });
    if (res.status === 401) { await logout(); throw new Error("Session expired. Please log in again."); }
    const body = await res.json().catch(() => null);
    if (!res.ok) throw new Error([body?.message].flat().filter(Boolean).join(", ") || `Request failed (${res.status})`);
    return body as T;
  }, [logout]);
}

export function useAdminQuery<T>(path: string) {
  const call = useAdminApi();
  const [state, setState] = useState<{ data: T | null; error: string; loading: boolean }>({ data: null, error: "", loading: true });
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let stale = false;
    call<T>(path)
      .then((data) => { if (!stale) setState({ data, error: "", loading: false }); })
      .catch((e: Error) => { if (!stale) setState((s) => ({ ...s, error: e.message, loading: false })); });
    return () => { stale = true; };
  }, [call, path, version]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  return { ...state, reload };
}

// Builds the PUT payload from a stored product; null fields are omitted so DTO validation accepts them.
export function productToDto(p: AdminProduct, over: Partial<AdminProduct> = {}) {
  const m = { ...p, ...over };
  const v = <V,>(x: V | null) => (x === null ? undefined : x);
  return {
    name: m.name, slug: m.slug, description: m.description, brand: v(m.brand), specifications: m.specifications,
    categoryId: m.categoryId, productType: m.productType, status: m.status, featured: m.featured,
    pricePaise: m.pricePaise, mrpPaise: v(m.mrpPaise), sellerName: m.sellerName, deliveryInfo: v(m.deliveryInfo),
    returnPolicy: v(m.returnPolicy), sku: v(m.sku), stock: v(m.stock), costPaise: v(m.costPaise), platform: v(m.platform),
    affiliateUrl: v(m.affiliateUrl), affiliateDisclosure: v(m.affiliateDisclosure),
    showRating: m.showRating, dealLabel: v(m.dealLabel), deliveryDays: v(m.deliveryDays), freeDelivery: m.freeDelivery, showAddToCart: m.showAddToCart, gstRatePercent: m.gstRatePercent,
    images: m.images.map((i) => ({ url: i.url, alt: v(i.alt) })), videoUrls: m.videoUrls, highlights: m.highlights,
  };
}

export const slugify = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
