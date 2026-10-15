"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { API_URL } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Stars } from "./Stars";
import { VerifyRequired } from "./VerifyRequired";

interface ReviewData {
  average: number | null;
  count: number;
  items: { id: string; rating: number; title: string | null; body: string; verified: boolean; createdAt: string; author: string }[];
}

export function Reviews({ slug }: { slug: string }) {
  const { user } = useAuth();
  const [data, setData] = useState<ReviewData | null>(null);
  const [version, setVersion] = useState(0);
  const [rating, setRating] = useState(5);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let stale = false;
    fetch(`${API_URL}/products/${encodeURIComponent(slug)}/reviews`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!stale) setData(d); })
      .catch(() => {});
    return () => { stale = true; };
  }, [slug, version]);

  const submit = useCallback(async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(""); setBusy(true);
    const form = e.currentTarget;
    const f = new FormData(form);
    try {
      const res = await fetch(`${API_URL}/products/${encodeURIComponent(slug)}/reviews`, {
        method: "POST", credentials: "include", headers: { "content-type": "application/json" },
        body: JSON.stringify({ rating, title: String(f.get("title") ?? ""), body: String(f.get("body") ?? "") }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error([body?.message].flat().join(", ") || "Could not save your review");
      form.reset(); setDone(true); setVersion((v) => v + 1);
    } catch (err) { setError((err as Error).message); }
    setBusy(false);
  }, [slug, rating]);

  return (
    <section className="scroll-mt-44 rounded-3xl border border-line bg-white p-7 shadow-card" id="reviews">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 className="text-xl font-bold">Customer reviews</h2>
        {data && data.count > 0 && data.average !== null && (
          <p className="flex items-center gap-2 text-sm"><Stars value={data.average} size={18} /> <strong>{data.average}</strong> <span className="text-muted">from {data.count} {data.count === 1 ? "review" : "reviews"}</span></p>
        )}
      </div>

      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_360px]">
        <ul className="space-y-5">
          {data && data.items.length === 0 && <li className="text-sm text-muted">No reviews yet. Be the first to share your experience.</li>}
          {data?.items.map((r) => (
            <li key={r.id} className="border-b border-line pb-5 last:border-0">
              <div className="flex items-center gap-2"><Stars value={r.rating} /> {r.title && <strong className="text-sm">{r.title}</strong>}</div>
              <p className="mt-2 text-sm leading-relaxed text-ink-3">{r.body}</p>
              <p className="mt-2 text-xs text-muted">
                {r.author} · {new Date(r.createdAt).toLocaleDateString("en-IN", { dateStyle: "medium" })}
                {r.verified && <span className="ml-2 rounded-full bg-brand-50 px-2 py-0.5 font-semibold text-brand-800">Verified purchase</span>}
              </p>
            </li>
          ))}
        </ul>

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
              {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
              {done && !error && <p role="status" className="text-sm text-brand-700">Thanks — your review has been saved.</p>}
              <button disabled={busy} className="w-full rounded-lg bg-ink px-4 py-2.5 text-sm font-semibold text-white hover:bg-ink-3 disabled:opacity-60">{busy ? "Saving…" : "Submit review"}</button>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
