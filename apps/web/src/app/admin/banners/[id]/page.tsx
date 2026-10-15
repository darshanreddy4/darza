"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useAdminQuery, type AdminBanner } from "@/lib/admin";
import { BannerForm } from "@/components/admin/BannerForm";
import { Alert, PageHeader, Skeleton } from "@/components/admin/ui";

export default function EditBannerPage() {
  const { id } = useParams<{ id: string }>();
  const { data, error, loading } = useAdminQuery<AdminBanner>(`/admin/banners/${encodeURIComponent(id)}`);

  return (
    <>
      <PageHeader title={data ? `Edit: ${data.title}` : "Edit banner"} actions={<Link href="/admin/banners" className="text-sm text-muted hover:text-ink">← Back to banners</Link>} />
      {loading && <Skeleton rows={6} />}
      {error && <Alert tone="error">{error}</Alert>}
      {data && <BannerForm key={data.id} initial={data} />}
    </>
  );
}
