import { OrdersView } from "@/components/OrdersView";

export const metadata = { title: "My orders", robots: { index: false, follow: false } };

export default async function OrdersPage({ searchParams }: PageProps<"/orders">) {
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const placed = one(sp.placed);
  return <OrdersView placed={placed === "1" || placed === "paid" || placed === "unpaid" ? placed : undefined} reason={one(sp.reason)} />;
}
