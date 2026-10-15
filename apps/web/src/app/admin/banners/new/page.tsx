"use client";

import Link from "next/link";
import { BannerForm } from "@/components/admin/BannerForm";
import { PageHeader } from "@/components/admin/ui";

export default function NewBannerPage() {
  return (
    <>
      <PageHeader title="New banner" description="Appears in the carousel at the top of the home page." actions={<Link href="/admin/banners" className="text-sm text-muted hover:text-ink">← Back to banners</Link>} />
      <BannerForm />
    </>
  );
}
