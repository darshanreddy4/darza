"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { API_URL, imgSrc } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { SlideRow } from "./home/SlideRow";
import { MediaThumbs, type MediaItem } from "./ReviewMedia";
import { RatingSummary, ReviewCard, type ReviewItem } from "./ReviewParts";
import { VerifyRequired } from "./VerifyRequired";

interface ReviewData {
  average: number | null;
  count: number;
  breakdown?: Record<number, number>;
  items: ReviewItem[];
  // Pictures and videos from all reviews, newest first, and how many there are in all.
  gallery?: MediaItem[];
  mediaCount?: number;
}

const MAX_PHOTOS = 5;
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const MAX_VIDEO_BYTES = 30 * 1024 * 1024;

// The page shows the latest few in a slider; everything else is on the all-reviews page.
const SHOWN = 8;

export function Reviews({ slug }: { slug: string }) {
  const { user } = useAuth();
  const [data, setData] = useState<ReviewData | null>(null);
  const [version, setVersion] = useState(0);
  const [rating, setRating] = useState(5);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [files, setFiles] = useState<MediaItem[]>([]);
  const [uploading, setUploading] = useState(0);
  const [mediaError, setMediaError] = useState("");

  useEffect(() => {
    let stale = false;
    fetch(`${API_URL}/products/${encodeURIComponent(slug)}/reviews?limit=${SHOWN}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!stale) setData(d); })
      .catch(() => {});
    return () => { stale = true; };
  }, [slug, version]);

  async function addFiles(list: FileList | null) {
    if (!list) return;
    setMediaError("");
    let photos = files.filter((f) => f.type === "IMAGE").length;
    let video = files.some((f) => f.type === "VIDEO");
    for (const file of Array.from(list)) {
      const isVideo = file.type.startsWith("video/");
      if (!isVideo && !file.type.startsWith("image/")) { setMediaError(`${file.name} is not a photo or video`); continue; }
      if (isVideo ? video : photos >= MAX_PHOTOS) { setMediaError(isVideo ? "You can add one video." : `You can add up to ${MAX_PHOTOS} photos.`); continue; }
      if (file.size > (isVideo ? MAX_VIDEO_BYTES : MAX_PHOTO_BYTES)) { setMediaError(`${file.name} is larger than ${isVideo ? 30 : 5} MB`); continue; }
      if (isVideo) video = true; else photos++;
      setUploading((n) => n + 1);
      try {
        const body = new FormData();
        body.append("file", file, file.name);
        const res = await fetch(`${API_URL}/reviews/uploads${isVideo ? "/video" : ""}`, { method: "POST", credentials: "include", body });
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error([data?.message].flat().filter(Boolean).join(", ") || "Upload failed");
        setFiles((cur) => [...cur, { type: data.type, url: data.url }]);
      } catch (err) {
        if (isVideo) video = false; else photos--;
        setMediaError(`${file.name}: ${(err as Error).message}`);
      } finally { setUploading((n) => n - 1); }
    }
  }

  const submit = useCallback(async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(""); setBusy(true);
    const form = e.currentTarget;
    const f = new FormData(form);
    try {
      const res = await fetch(`${API_URL}/products/${encodeURIComponent(slug)}/reviews`, {
        method: "POST", credentials: "include", headers: { "content-type": "application/json" },
        body: JSON.stringify({ rating, title: String(f.get("title") ?? ""), body: String(f.get("body") ?? ""), ...(files.length > 0 && { media: files.map(({ type, url }) => ({ type, url })) }) }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error([body?.message].flat().join(", ") || "Could not save your review");
      form.reset(); setFiles([]); setDone(true); setVersion((v) => v + 1);
    } catch (err) { setError((err as Error).message); }
    setBusy(false);
  }, [slug, rating, files]);

  return (
    <section className="scroll-mt-44 rounded-3xl border border-line bg-white p-7 shadow-card" id="reviews">
      <h2 className="text-xl font-bold">Customer reviews</h2>

      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_360px]">
        <div className="min-w-0 space-y-6">
          {data && data.count > 0 && <RatingSummary data={data} />}
          {data?.gallery && data.gallery.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-semibold">Photos and videos from customers</p>
              <MediaThumbs items={data.gallery} size={72} more={Math.max(0, (data.mediaCount ?? 0) - data.gallery.length)} moreHref={`/products/${encodeURIComponent(slug)}/reviews`} />
            </div>
          )}
          {data && data.items.length === 0 && <p className="text-sm text-muted">No reviews yet. Be the first to share your experience.</p>}
          {data && data.items.length > 0 && (
            <SlideRow label="reviews" perView={2}>
              {data.items.map((r) => <ReviewCard key={r.id} r={r} />)}
            </SlideRow>
          )}
          {data && data.count > SHOWN && (
            <Link href={`/products/${encodeURIComponent(slug)}/reviews`} className="flex w-full items-center justify-center gap-2 rounded-xl border border-line px-4 py-3 text-sm font-semibold hover:border-ink">
              View all {data.count.toLocaleString("en-IN")} reviews
              <svg aria-hidden width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 5l7 7-7 7" /></svg>
            </Link>
          )}
        </div>

        <div className="h-fit rounded-2xl bg-canvas p-5">
          {!user ? (
            <p className="text-sm">
              <Link href={`/login?next=${encodeURIComponent(`/products/${slug}`)}`} className="font-semibold text-brand-700 underline">Log in</Link> to write a review.
            </p>
          ) : !user.verified ? (
            <VerifyRequired action="write a review" className="!border-0 !bg-transparent !p-0" />
          ) : (
            <form onSubmit={submit} className="space-y-3">
              <h3 className="font-semibold">Write a review</h3>
              <div className="flex gap-1" role="radiogroup" aria-label="Rating">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n} star${n > 1 ? "s" : ""}`} onClick={() => setRating(n)} className="text-2xl leading-none">
                    <span className={n <= rating ? "text-gold" : "text-line"}>★</span>
                  </button>
                ))}
              </div>
              <input name="title" maxLength={120} placeholder="Headline (optional)" className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-brand-500" />
              <textarea name="body" required minLength={3} maxLength={2000} rows={4} placeholder="What did you like or dislike?" className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-brand-500" />
              <div>
                <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-line bg-white px-3 py-3 text-sm font-medium hover:border-brand-500">
                  <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="9" cy="11" r="2" /><path d="M21 16l-5-5-7 8" /></svg>
                  {uploading > 0 ? "Uploading…" : "Add photos or a video"}
                  <input type="file" multiple hidden aria-label="Add photos or a video" accept="image/jpeg,image/png,image/webp,video/mp4,video/webm" onChange={(e) => { void addFiles(e.target.files); e.target.value = ""; }} />
                </label>
                <p className="mt-1 text-xs text-muted">Up to {MAX_PHOTOS} photos (5 MB each) and one video (30 MB, 30 seconds).</p>
                {files.length > 0 && (
                  <ul className="mt-2 flex flex-wrap gap-2" aria-label="Attached photos and videos">
                    {files.map((m) => (
                      <li key={m.url} className="relative h-16 w-16 overflow-hidden rounded-lg border border-line bg-white">
                        {m.type === "VIDEO"
                          ? <video src={imgSrc(m.url)} muted playsInline preload="metadata" className="h-full w-full object-cover" />
                          // eslint-disable-next-line @next/next/no-img-element
                          : <img src={imgSrc(m.url)} alt="" className="h-full w-full object-cover" />}
                        <button type="button" onClick={() => setFiles((cur) => cur.filter((x) => x.url !== m.url))} aria-label={`Remove ${m.type === "VIDEO" ? "video" : "photo"}`} className="absolute right-0.5 top-0.5 grid h-5 w-5 place-items-center rounded-full bg-ink/80 text-xs text-white">×</button>
                      </li>
                    ))}
                  </ul>
                )}
                {mediaError && <p role="alert" className="mt-1 text-xs text-red-600">{mediaError}</p>}
              </div>
              {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
              {done && !error && <p role="status" className="text-sm text-brand-700">Thanks — your review has been saved.</p>}
              <button disabled={busy || uploading > 0} className="w-full rounded-lg bg-ink px-4 py-2.5 text-sm font-semibold text-white hover:bg-ink-3 disabled:opacity-60">{busy ? "Saving…" : "Submit review"}</button>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
