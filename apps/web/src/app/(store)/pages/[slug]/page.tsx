import { CustomPageView, customPageMetadata } from "@/components/PolicyView";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  return customPageMetadata((await params).slug);
}

export default async function CustomPage({ params }: { params: Promise<{ slug: string }> }) {
  return <CustomPageView slug={(await params).slug} />;
}
