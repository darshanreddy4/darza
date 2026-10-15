"use client";

import { formatPrice } from "@/lib/api";
import { useAdminQuery } from "@/lib/admin";
import { Badge, Card, Empty, PageHeader, Skeleton, td, th } from "@/components/admin/ui";

interface Row { userId: string; name: string; email: string | null; phone: string | null; itemCount: number; valuePaise: number; savedAt: string; remindedAt: string | null }

const when = (iso: string) => new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });

export default function AbandonedCartsPage() {
  const rows = useAdminQuery<Row[]>("/admin/abandoned-carts");
  const data = rows.data ?? [];
  const reminded = data.filter((r) => r.remindedAt).length;

  return (
    <>
      <PageHeader title="Abandoned carts" description="Signed-in customers who left items in their cart. Customers with a verified email get one reminder an hour after leaving, unless they have turned reminders off." />
      {rows.loading ? <Skeleton rows={3} /> : data.length === 0 ? (
        <Card><Empty title="No abandoned carts">Carts left behind by signed-in customers appear here.</Empty></Card>
      ) : (
        <Card padded={false}>
          <p className="border-b border-line px-5 py-3 text-xs text-muted">{data.length} waiting · {reminded} reminded · worth {formatPrice(data.reduce((n, r) => n + r.valuePaise, 0))} at today&apos;s prices</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-line bg-canvas/60"><th className={th}>Customer</th><th className={th}>Items</th><th className={`${th} text-right`}>Value</th><th className={th}>Left</th><th className={th}>Reminder</th></tr></thead>
              <tbody className="divide-y divide-line">
                {data.map((r) => (
                  <tr key={r.userId}>
                    <td className={td}><p className="font-medium">{r.name}</p><p className="text-xs text-muted">{r.email ?? r.phone}</p></td>
                    <td className={td}>{r.itemCount}</td>
                    <td className={`${td} text-right font-semibold`}>{formatPrice(r.valuePaise)}</td>
                    <td className={td}>{when(r.savedAt)}</td>
                    <td className={td}>{r.remindedAt ? <Badge tone="green">Sent {when(r.remindedAt)}</Badge> : <Badge tone="slate">Not sent</Badge>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </>
  );
}
