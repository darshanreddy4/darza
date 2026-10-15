import type { Metadata } from "next";
import { UnsubscribeView } from "@/components/UnsubscribeView";

export const metadata: Metadata = { title: "Stop cart reminders", robots: { index: false, follow: false } };

export default async function UnsubscribePage({ searchParams }: { searchParams: Promise<{ token?: string | string[] }> }) {
  const { token } = await searchParams;
  return <UnsubscribeView token={Array.isArray(token) ? token[0] : token} />;
}
