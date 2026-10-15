"use client";

import Link from "next/link";
import { useState } from "react";
import { imgSrc } from "@/lib/api";
import { bannerStatus, useAdminApi, useAdminQuery, type AdminBanner, type BannerStatus } from "@/lib/admin";
import { Alert, Badge, Card, Empty, PageHeader, Skeleton, btn } from "@/components/admin/ui";

const STATUS: Record<BannerStatus, { label: string; tone: "green" | "amber" | "slate" | "red" }> = {
  live: { label: "Live", tone: "green" },
  scheduled: { label: "Scheduled", tone: "amber" },
  expired: { label: "Expired", tone: "red" },
  off: { label: "Off", tone: "slate" },
};

const fmt = (iso: string) => new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });

export default function BannersAdminPage() {
  const call = useAdminApi();
  const banners = useAdminQuery<AdminBanner[]>("/admin/banners");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const list = banners.data ?? [];

  async function act(fn: () => Promise<unknown>, message: string) {
    setError(""); setNotice("");
    try { await fn(); setNotice(message); banners.reload(); } catch (e) { setError((e as Error).message); }
  }

  const move = (i: number, d: -1 | 1) => {
    const ids = list.map((b) => b.id);
    [ids[i], ids[i + d]] = [ids[i + d], ids[i]];
    return act(() => call("/admin/banners-order", { method: "PUT", body: JSON.stringify({ ids }) }), "Order updated");
  };

  const toggle = (b: AdminBanner) =>
    act(() => call(`/admin/banners/${b.id}`, {
      method: "PUT",
      body: JSON.stringify({ title: b.title, subtitle: b.subtitle, imageUrl: b.imageUrl, ctaLabel: b.ctaLabel, linkUrl: b.linkUrl, textTone: b.textTone, active: !b.active, startsAt: b.startsAt, endsAt: b.endsAt, showCountdown: b.showCountdown, videoUrl: b.videoUrl, sponsorName: b.sponsorName, textPosition: b.textPosition, buttonPosition: b.buttonPosition }),
    }), b.active ? "Banner switched off" : "Banner switched on");

  const live = list.filter((b) => bannerStatus(b) === "live").length;

  return (
    <>
      <PageHeader
        title="Banners"
        description={`Home page carousel. ${live} live now. Banners show in the order below; with none live, the default hero is used.`}
        actions={<Link href="/admin/banners/new" className={btn.primary}>+ Add banner</Link>}
      />
      {error && <Alert tone="error" onClose={() => setError("")}>{error}</Alert>}
      {notice && <Alert tone="success" onClose={() => setNotice("")}>{notice}</Alert>}

      {banners.loading ? <Card padded={false}><Skeleton /></Card> : list.length === 0 ? (
        <Card><Empty title="No banners yet">Create one to feature an offer or collection on the home page.</Empty></Card>
      ) : (
        <ul className="space-y-4">
          {list.map((b, i) => {
            const s = STATUS[bannerStatus(b)];
            return (
              <li key={b.id} className="overflow-hidden rounded-2xl border border-line bg-white shadow-card md:flex">
                <div className="relative aspect-[8/3] shrink-0 bg-canvas md:aspect-auto md:w-72 lg:w-96">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={imgSrc(b.imageUrl)} alt="" className="h-full w-full object-cover" />
                  {b.title && (
                    <span className={`absolute inset-0 flex flex-col justify-center gap-1 bg-linear-to-r px-4 ${b.textTone === "LIGHT" ? "from-ink/70 to-transparent text-white" : "from-white/80 to-transparent text-ink"}`}>
                      <span className="line-clamp-2 text-lg font-extrabold leading-tight">{b.title}</span>
                    </span>
                  )}
                </div>
                <div className="flex flex-1 flex-col justify-between gap-4 p-5">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={`/admin/banners/${b.id}`} className="font-semibold hover:text-brand-700">{b.title || "Untitled banner"}</Link>
                      <Badge tone={s.tone}>{s.label}</Badge>
                      {b.showCountdown && b.endsAt && <Badge>⏱ Countdown</Badge>}
                      {b.videoUrl && <Badge tone="green">▶ Video</Badge>}
                      {b.sponsorName && <Badge tone="amber">Ad · {b.sponsorName}</Badge>}
                    </div>
                    {b.subtitle && <p className="mt-1 text-sm text-muted">{b.subtitle}</p>}
                    <dl className="mt-3 grid gap-x-6 gap-y-1 text-xs text-muted sm:grid-cols-2">
                      <div><dt className="inline font-semibold text-ink-3">Link: </dt><dd className="inline break-all">{b.linkUrl ?? "none"}</dd></div>
                      <div><dt className="inline font-semibold text-ink-3">Impressions: </dt><dd className="inline">{b.impressionCount.toLocaleString("en-IN")}</dd></div>
                      <div><dt className="inline font-semibold text-ink-3">Clicks: </dt><dd className="inline">{b.clickCount.toLocaleString("en-IN")}{b.impressionCount > 0 ? ` (${((b.clickCount / b.impressionCount) * 100).toFixed(1)}% CTR)` : ""}</dd></div>
                      {b.startsAt && <div><dt className="inline font-semibold text-ink-3">From: </dt><dd className="inline">{fmt(b.startsAt)}</dd></div>}
                      {b.endsAt && <div><dt className="inline font-semibold text-ink-3">Until: </dt><dd className="inline">{fmt(b.endsAt)}</dd></div>}
                    </dl>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button className={btn.secondary + " !px-2.5 !py-1.5"} disabled={i === 0} onClick={() => move(i, -1)} aria-label={`Move ${b.title || "untitled banner"} earlier`}>↑</button>
                    <button className={btn.secondary + " !px-2.5 !py-1.5"} disabled={i === list.length - 1} onClick={() => move(i, 1)} aria-label={`Move ${b.title || "untitled banner"} later`}>↓</button>
                    <button className={btn.secondary + " !py-1.5"} onClick={() => toggle(b)}>{b.active ? "Switch off" : "Switch on"}</button>
                    <Link href={`/admin/banners/${b.id}`} className={btn.secondary + " !py-1.5"}>Edit</Link>
                    <button className={btn.danger} onClick={() => confirm(`Delete “${b.title || "Untitled banner"}”?`) && act(() => call(`/admin/banners/${b.id}`, { method: "DELETE" }), "Banner deleted")}>Delete</button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
