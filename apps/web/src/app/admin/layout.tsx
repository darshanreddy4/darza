import type { Metadata } from "next";
import { AdminShell } from "@/components/admin/AdminShell";
import { getBrand } from "@/lib/site-profile";

export async function generateMetadata(): Promise<Metadata> {
  return { title: { absolute: `${await getBrand()} Admin` }, robots: { index: false, follow: false } };
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <div className="bg-canvas"><AdminShell>{children}</AdminShell></div>;
}
