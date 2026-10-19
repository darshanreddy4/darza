"use client";

import Link from "next/link";
import { useState } from "react";
import { useAdminApi, useAdminQuery } from "@/lib/admin";
import { Alert, Badge, Card, Empty, PageHeader, Skeleton, btn, inputCls } from "@/components/admin/ui";
import { Select } from "@/components/Select";

interface Row {
  id: string; question: string; answer: string | null; createdAt: string;
  user: { name: string; email: string | null; phone: string | null };
  product: { name: string; slug: string };
}

export default function QuestionsAdminPage() {
  const call = useAdminApi();
  const [filter, setFilter] = useState("open");
  const rows = useAdminQuery<Row[]>(`/admin/questions${filter ? `?status=${filter}` : ""}`);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  async function save(r: Row) {
    const answer = (drafts[r.id] ?? r.answer ?? "").trim();
    if (answer.length < 2) return setError("Write an answer first");
    setError(""); setNotice(""); setBusy(r.id);
    try {
      await call(`/admin/questions/${r.id}`, { method: "PATCH", body: JSON.stringify({ answer }) });
      setNotice("Answer published on the product page");
      setDrafts((d) => Object.fromEntries(Object.entries(d).filter(([id]) => id !== r.id)));
      rows.reload();
    } catch (e) { setError((e as Error).message); }
    setBusy(null);
  }

  async function remove(r: Row) {
    if (!confirm("Delete this question?")) return;
    setError(""); setNotice("");
    try { await call(`/admin/questions/${r.id}`, { method: "DELETE" }); setNotice("Question deleted"); rows.reload(); } catch (e) { setError((e as Error).message); }
  }

  return (
    <>
      <PageHeader
        title="Questions"
        description="Shoppers' questions about products. An answer is shown on the product page and emailed to the person who asked."
        actions={
          <Select value={filter} onChange={(e) => setFilter(e.target.value)} className={`${inputCls} !w-auto`} aria-label="Filter by status">
            <option value="open">Waiting for an answer</option>
            <option value="answered">Answered</option>
            <option value="">All questions</option>
          </Select>
        }
      />
      {error && <Alert tone="error" onClose={() => setError("")}>{error}</Alert>}
      {notice && <Alert tone="success" onClose={() => setNotice("")}>{notice}</Alert>}

      {rows.loading ? <Skeleton rows={3} /> : (rows.data ?? []).length === 0 ? (
        <Card><Empty title="No questions here">Questions appear when shoppers ask about a product.</Empty></Card>
      ) : (
        <ul className="space-y-4">
          {rows.data!.map((r) => (
            <li key={r.id}>
              <Card>
                <article aria-label={`Question about ${r.product.name}`} className="space-y-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Link href={`/products/${r.product.slug}#questions`} target="_blank" className="font-semibold text-brand-700 hover:underline">{r.product.name}</Link>
                    <Badge tone={r.answer ? "green" : "amber"}>{r.answer ? "Answered" : "Waiting"}</Badge>
                  </div>
                  <p className="font-medium">{r.question}</p>
                  <p className="text-xs text-muted">{r.user.name} · {r.user.email ?? r.user.phone} · {new Date(r.createdAt).toLocaleDateString("en-IN", { dateStyle: "medium" })}</p>
                  <label className="block text-xs font-medium">Your answer
                    <textarea rows={2} maxLength={1000} value={drafts[r.id] ?? r.answer ?? ""} onChange={(e) => setDrafts({ ...drafts, [r.id]: e.target.value })} className={`${inputCls} mt-1`} />
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <button disabled={busy === r.id} onClick={() => save(r)} className={btn.primary}>{r.answer ? "Update answer" : "Publish answer"}</button>
                    <button onClick={() => remove(r)} className={btn.danger}>Delete</button>
                  </div>
                </article>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
