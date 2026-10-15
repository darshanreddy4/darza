"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { API_URL } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { VerifyRequired } from "./VerifyRequired";

interface Question { id: string; question: string; answer: string; answeredAt: string; author: string }

export function Questions({ slug }: { slug: string }) {
  const { user } = useAuth();
  const [items, setItems] = useState<Question[] | null>(null);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let stale = false;
    fetch(`${API_URL}/products/${encodeURIComponent(slug)}/questions`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => { if (!stale) setItems(d); })
      .catch(() => { if (!stale) setItems([]); });
    return () => { stale = true; };
  }, [slug]);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(""); setSent(false); setBusy(true);
    const form = e.currentTarget;
    try {
      const res = await fetch(`${API_URL}/products/${encodeURIComponent(slug)}/questions`, {
        method: "POST", credentials: "include", headers: { "content-type": "application/json" },
        body: JSON.stringify({ question: String(new FormData(form).get("question") ?? "").trim() }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error([body?.message].flat().filter(Boolean).join(", ") || "Could not send your question");
      form.reset(); setSent(true);
    } catch (err) { setError((err as Error).message); }
    setBusy(false);
  }

  return (
    <section className="scroll-mt-44 rounded-3xl border border-line bg-white p-7 shadow-card" id="questions">
      <h2 className="text-xl font-bold">Questions and answers</h2>
      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_360px]">
        <ul className="space-y-5">
          {items && items.length === 0 && <li className="text-sm text-muted">No questions answered yet. Ask the first one.</li>}
          {items?.map((q) => (
            <li key={q.id} className="border-b border-line pb-5 text-sm last:border-0">
              <p className="font-semibold"><span className="mr-2 text-muted">Q.</span>{q.question}</p>
              <p className="mt-2 leading-relaxed text-ink-3"><span className="mr-2 font-semibold text-brand-700">A.</span>{q.answer}</p>
              <p className="mt-2 text-xs text-muted">Asked by {q.author} · answered {new Date(q.answeredAt).toLocaleDateString("en-IN", { dateStyle: "medium" })}</p>
            </li>
          ))}
        </ul>

        <div className="h-fit rounded-2xl bg-canvas p-5">
          {!user ? (
            <p className="text-sm"><Link href={`/login?next=${encodeURIComponent(`/products/${slug}`)}`} className="font-semibold text-brand-700 underline">Log in</Link> to ask a question.</p>
          ) : !user.verified ? (
            <VerifyRequired action="ask a question" className="!border-0 !bg-transparent !p-0" />
          ) : (
            <form onSubmit={submit} className="space-y-3">
              <h3 className="font-semibold">Ask a question</h3>
              <label className="sr-only" htmlFor="question">Your question</label>
              <textarea id="question" name="question" required minLength={10} maxLength={500} rows={3} placeholder="What would you like to know about this product?" className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-brand-500" />
              {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
              {sent && !error && <p role="status" className="text-sm text-brand-700">Thanks. Your question will appear here once we have answered it.</p>}
              <button disabled={busy} className="w-full rounded-lg bg-ink px-4 py-2.5 text-sm font-semibold text-white hover:bg-ink-3 disabled:opacity-60">{busy ? "Sending…" : "Send question"}</button>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
