"use client";

import Link from "next/link";
import { ProductForm } from "@/components/admin/ProductForm";
import { PageHeader } from "@/components/admin/ui";
import { useBrand } from "@/components/BrandProvider";

export default function NewProductPage() {
  const brand = useBrand();
  return (
    <>
      <PageHeader title="Add product" description={`Create a ${brand}-owned or affiliate product.`} actions={<Link href="/admin/products" className="text-sm text-muted hover:text-ink">← Back to products</Link>} />
      <ProductForm />
    </>
  );
}
