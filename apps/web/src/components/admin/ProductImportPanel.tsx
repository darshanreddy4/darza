"use client";

import { useRef, useState } from "react";
import { useAdminApi } from "@/lib/admin";
import { Alert, Card, btn } from "./ui";

interface Report { dryRun: boolean; rows: number; created: number; updated: number; applied: boolean; errors: { row: number; slug: string; message: string }[] }

const COLUMNS = "slug, name, type, status, category, brand, sku, price, mrp, cost, stock, gst_percent, featured, platform, affiliate_url, highlights, images, description";

export function ProductImportPanel({ onClose, onDone }: { onClose: () => void; onDone: (message: string) => void }) {
  const call = useAdminApi();
  const input = useRef<HTMLInputElement>(null);
  const [csv, setCsv] = useState<{ name: string; text: string } | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function send(text: string, dryRun: boolean) {
    setError(""); setBusy(true);
    try {
      const r = await call<Report>(`/admin/products/import${dryRun ? "?dryRun=true" : ""}`, { method: "POST", headers: { "content-type": "text/csv" }, body: text });
      setReport(r);
      if (r.applied) onDone(`Imported ${r.created + r.updated} products (${r.created} new, ${r.updated} updated)`);
    } catch (e) { setError((e as Error).message); setReport(null); }
    setBusy(false);
  }

  async function choose(file: File | undefined) {
    if (!file) return;
    const text = await file.text();
    setCsv({ name: file.name, text });
    void send(text, true);
  }

  const ready = !!report && report.dryRun && report.errors.length === 0 && report.created + report.updated > 0;

  return (
    <Card title="Import products from a CSV file" description="Existing products are matched by slug and updated; new slugs are created. A blank cell leaves the current value alone." actions={<button type="button" onClick={onClose} className="text-sm text-muted hover:text-ink">Close</button>}>
      <div className="space-y-4 text-sm">
        <p className="text-xs text-muted">Columns: {COLUMNS}. Only <strong>slug</strong> is always needed. Prices are in rupees. Separate several highlights or image links with | . Category is the category slug. The easiest start is to export your products, edit the file in a spreadsheet and import it back.</p>
        {error && <Alert tone="error" onClose={() => setError("")}>{error}</Alert>}
        <div className="flex flex-wrap items-center gap-3">
          <input ref={input} type="file" accept=".csv,text/csv" aria-label="CSV file" onChange={(e) => choose(e.target.files?.[0])} className="text-sm" />
          {csv && <span className="text-xs text-muted">{csv.name}</span>}
        </div>

        {busy && <p role="status" className="text-muted">Checking the file…</p>}
        {report && (
          <div role="status" className="space-y-3">
            {report.errors.length === 0 ? (
              <p className="rounded-lg bg-brand-50 px-3 py-2 text-brand-800">{report.applied ? "Imported." : "The file looks good."} {report.rows} rows: {report.created} new, {report.updated} updated.</p>
            ) : (
              <div className="rounded-lg bg-red-50 px-3 py-2 text-red-800">
                <p className="font-medium">{report.errors.length} problem{report.errors.length > 1 ? "s" : ""} found. Nothing was imported. Fix the file and choose it again.</p>
                <ul className="mt-2 max-h-48 list-disc space-y-0.5 overflow-auto pl-5 text-xs">
                  {report.errors.slice(0, 50).map((e, i) => <li key={i}>Row {e.row}{e.slug ? ` (${e.slug})` : ""}: {e.message}</li>)}
                </ul>
                {report.errors.length > 50 && <p className="mt-1 text-xs">…and {report.errors.length - 50} more.</p>}
              </div>
            )}
            {ready && csv && !report.applied && (
              <button type="button" disabled={busy} onClick={() => send(csv.text, false)} className={btn.primary}>Import {report.created + report.updated} products</button>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
