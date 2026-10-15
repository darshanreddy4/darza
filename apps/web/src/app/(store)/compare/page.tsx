import type { Metadata } from "next";
import { CompareView } from "@/components/CompareView";

export const metadata: Metadata = { title: "Compare products", robots: { index: false, follow: true } };

export default function ComparePage() {
  return <CompareView />;
}
