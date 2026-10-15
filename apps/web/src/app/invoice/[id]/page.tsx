import { InvoiceView } from "@/components/InvoiceView";

export const metadata = { title: "Invoice", robots: { index: false } };

export default async function InvoicePage({ params }: PageProps<"/invoice/[id]">) {
  const { id } = await params;
  return <InvoiceView orderId={id} />;
}
