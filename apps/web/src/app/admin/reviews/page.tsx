"use client";

import { useState } from "react";
import { imgSrc } from "@/lib/api";
import { useAdminApi, useAdminQuery } from "@/lib/admin";
import { Alert, Badge, Card, Empty, PageHeader, Skeleton, btn, inputCls } from "@/components/admin/ui";
import { Select } from "@/components/Select";
import { Stars } from "@/components/Stars";

interface Review {
  id: string; rating: number; title: string | null; body: string; verified: boolean; createdAt: string;
  user: { name: string; email: string | null };
  product: { name: string };
  media: { id: string; type: string; url: string }[];
}

// Every customer review in one place, newest first, so the ones that break the rules can be removed.
export default function ReviewsPage() {
  const call = useAdminApi();
  const { data, loading, error, reload } = useAdminQuery<Review[]>("/admin/reviews");
  const [filter, setFilter] = useState("");
  const [failure, setFailure] = useState("");
  const [notice, setNotice] = useState("");
  const rows = (data ?? []).filter((r) => (filter === "low" ? r.rating <= 2 : filter === "media" ? r.media.length > 0 : true));

  async function remove(r: Review) {
    if (!confirm("Delete this review? This cannot be undone.")) return;
    setFailure(""); setNotice("");
    try { await call(`/admin/reviews/${r.id}`, { method: "DELETE" }); setNotice("Review deleted"); reload(); } catch (e) { setFailure((e as Error).message); }
  }

  return (
    <>
      <PageHeader
        title="Reviews"
        description="The latest customer reviews. Remove the ones that break your rules: abuse, spam or private details."
        actions={
          <Select value={filter} onChange={(e) => setFilter(e.target.value)} className={`${inputCls} !w-auto`} aria-label="Filter reviews">
            <option value="">All reviews</option><option value="low">1 and 2 stars</option><option value="media">With photos or videos</option>
          </Select>
        }
      />
      {(error || failure) && <Alert tone="error" onClose={() => setFailure("")}>{error || failure}</Alert>}
      {notice && <Alert tone="success" onClose={() => setNotice("")}>{notice}</Alert>}
      {loading ? <Skeleton rows={4} /> : rows.length === 0 ? (
        <Card><Empty title="No reviews">Reviews appear here when customers rate what they bought.</Empty></Card>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r.id}>
              <Card>
                <article aria-label={`Review of ${r.product.name}`} className="flex items-start justify-between gap-4 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium">{r.product.name}</p>
                    <p className="mt-1 flex flex-wrap items-center gap-2"><Stars value={r.rating} /> {r.title && <strong>{r.title}</strong>} {r.verified && <Badge tone="green">Verified purchase</Badge>}</p>
                    <p className="mt-1 whitespace-pre-line text-ink-3">{r.body}</p>
                    {r.media.length > 0 && (
                      <p className="mt-2 flex flex-wrap gap-2">
                        {r.media.map((m) => m.type === "VIDEO"
                          ? <a key={m.id} href={imgSrc(m.url)} target="_blank" rel="noreferrer" className="text-xs font-medium text-brand-700 hover:underline">Video</a>
                          // eslint-disable-next-line @next/next/no-img-element
                          : <img key={m.id} src={imgSrc(m.url)} alt="" className="h-14 w-14 rounded-lg object-cover ring-1 ring-line" />)}
                      </p>
                    )}
                    <p className="mt-2 text-xs text-muted">{r.user.name} · {r.user.email} · {new Date(r.createdAt).toLocaleDateString("en-IN", { dateStyle: "medium" })}</p>
                  </div>
                  <button className={btn.danger} onClick={() => remove(r)}>Delete</button>
                </article>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
