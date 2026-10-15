"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { formatPrice } from "@/lib/api";
import { useAdminQuery } from "@/lib/admin";
import { Alert, Badge, Card, Empty, PageHeader, Skeleton, StatCard, td, th } from "@/components/admin/ui";

interface Detail {
  user: { id: string; email: string | null; phone: string | null; google: boolean; name: string; role: "CUSTOMER" | "STAFF" | "ADMIN"; emailVerified: boolean; createdAt: string };
  contact: { phone: string; address: string };
  addresses: { id: string; label: string | null; name: string; phone: string; address: string; isDefault: boolean }[];
  summary: { orders: number; items: number; spentPaise: number; returnedOrders: number; returnedItems: number; refundedPaise: number; cancelledOrders: number };
  products: { productId: string; name: string; slug: string; quantity: number; spentPaise: number; returnedQuantity: number }[];
  orders: { id: string; status: string; totalPaise: number; refundedPaise: number; paymentMethod: string; createdAt: string; itemCount: number }[];
}

const TONE: Record<string, "green" | "amber" | "slate" | "red"> = { PLACED: "amber", PAID: "green", SHIPPED: "green", DELIVERED: "green", CANCELLED: "red", REFUNDED: "red", PENDING_PAYMENT: "slate" };
const date = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { dateStyle: "medium" });

export default function UserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const query = useAdminQuery<Detail>(`/admin/users/${id}`);
  const d = query.data;

  return (
    <>
      <Link href="/admin/users" className="mb-3 inline-block text-sm text-muted hover:text-ink">‹ All users</Link>
      {query.error && !d && <Alert tone="error">{query.error}</Alert>}
      {query.loading && !d && <Skeleton />}
      {d && (
        <>
          <PageHeader
            title={d.user.name}
            description={`${d.user.email ?? d.user.phone} · joined ${date(d.user.createdAt)}`}
            actions={<><Badge tone={d.user.emailVerified ? "green" : "amber"}>{d.user.emailVerified ? (d.user.email ? "Email verified" : "Phone verified") : "Email not verified"}</Badge><Badge tone={d.user.role === "CUSTOMER" ? "slate" : "amber"}>{d.user.role === "ADMIN" ? "Admin" : d.user.role === "STAFF" ? "Staff" : "Customer"}</Badge></>}
          />

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Orders" value={d.summary.orders} tone="brand" hint={d.summary.cancelledOrders ? `${d.summary.cancelledOrders} cancelled` : undefined} />
            <StatCard label="Products bought" value={d.summary.items} hint={`${d.products.filter((p) => p.quantity > 0).length} different ${d.products.filter((p) => p.quantity > 0).length === 1 ? "product" : "products"}`} />
            <StatCard label="Total spent" value={formatPrice(d.summary.spentPaise)} tone="gold" hint="Including delivery, after discounts" />
            <StatCard label="Returned" value={d.summary.returnedItems} tone="red" hint={d.summary.refundedPaise ? `${formatPrice(d.summary.refundedPaise)} refunded` : "Nothing refunded"} />
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1.4fr]">
            <Card title="Contact" description="From their saved addresses, or their latest order">
              <dl className="space-y-3 text-sm">
                <div><dt className="text-xs font-semibold uppercase tracking-wider text-muted">Phone</dt><dd className="mt-0.5">{d.contact.phone || <span className="text-muted">Not provided</span>}</dd></div>
                <div><dt className="text-xs font-semibold uppercase tracking-wider text-muted">Address</dt><dd className="mt-0.5">{d.contact.address || <span className="text-muted">Not provided</span>}</dd></div>
              </dl>
              {d.addresses.length > 1 && (
                <ul className="mt-4 space-y-2 border-t border-line pt-4 text-xs text-ink-3">
                  {d.addresses.map((a) => <li key={a.id}><span className="font-semibold">{a.label || a.name}{a.isDefault ? " (default)" : ""}</span>: {a.address} · {a.phone}</li>)}
                </ul>
              )}
            </Card>

            <Card title="What they bought" description="Paid orders only. Cancelled and unpaid orders are left out." padded={false}>
              {d.products.length === 0 ? <Empty title="No purchases yet" /> : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b border-line bg-canvas/60"><th className={th}>Product</th><th className={th}>Bought</th><th className={th}>Value</th><th className={th}>Returned</th></tr></thead>
                    <tbody className="divide-y divide-line">
                      {d.products.map((p) => (
                        <tr key={p.productId}>
                          <td className={td}><Link href={`/products/${p.slug}`} target="_blank" className="font-medium text-brand-700 hover:underline">{p.name}</Link></td>
                          <td className={td}>{p.quantity}</td>
                          <td className={td}>{formatPrice(p.spentPaise)}</td>
                          <td className={td}>{p.returnedQuantity || <span className="text-muted">0</span>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </div>

          <Card title="Order history" className="mt-6" padded={false}>
            {d.orders.length === 0 ? <Empty title="No orders yet" /> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-line bg-canvas/60"><th className={th}>Order</th><th className={th}>Date</th><th className={th}>Items</th><th className={th}>Total</th><th className={th}>Payment</th><th className={th}>Status</th></tr></thead>
                  <tbody className="divide-y divide-line">
                    {d.orders.map((o) => (
                      <tr key={o.id}>
                        <td className={`${td} font-mono text-xs font-semibold`}>{o.id.slice(-8)}</td>
                        <td className={td}>{date(o.createdAt)}</td>
                        <td className={td}>{o.itemCount}</td>
                        <td className={td}>{formatPrice(o.totalPaise)}{o.refundedPaise > 0 && <p className="text-xs text-red-600">{formatPrice(o.refundedPaise)} refunded</p>}</td>
                        <td className={td}>{o.paymentMethod === "COD" ? "Pay on delivery" : "Online"}</td>
                        <td className={td}><Badge tone={TONE[o.status] ?? "slate"}>{o.status.replace("_", " ").toLowerCase()}</Badge></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}
    </>
  );
}
