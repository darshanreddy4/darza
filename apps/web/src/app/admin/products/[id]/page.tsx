"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useAdminQuery, type AdminProduct } from "@/lib/admin";
import { ProductForm } from "@/components/admin/ProductForm";
import { Alert, PageHeader, Skeleton } from "@/components/admin/ui";

export default function EditProductPage() {
  const { id } = useParams<{ id: string }>();
  const { data, error, loading } = useAdminQuery<AdminProduct>(`/admin/products/${encodeURIComponent(id)}`);

  return (
    <>
      <PageHeader title={data ? `Edit: ${data.name}` : "Edit product"} actions={<Link href="/admin/products" className="text-sm text-muted hover:text-ink">← Back to products</Link>} />
      {loading && <Skeleton rows={6} />}
      {error && <Alert tone="error">{error}</Alert>}
      {data && <ProductForm key={data.updatedAt} initial={data} />}
    </>
  );
}
