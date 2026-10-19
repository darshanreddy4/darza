import type { Metadata } from "next";
import { ThemeScope } from "@/components/ThemeScope";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <ThemeScope>{children}</ThemeScope>;
}
