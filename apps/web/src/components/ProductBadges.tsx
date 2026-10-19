import { ratingTone, SALE_TAG_TEXT, type SaleTag } from "@/lib/labels";

const TONE = {
  good: "bg-green-700 text-white",
  fair: "bg-amber-400 text-ink",
  poor: "bg-red-600 text-white",
} as const;

// "4.2 ★" in green, amber or red by rating.
export function RatingBadge({ value, count }: { value: number; count?: number }) {
  return (
    <span className={`inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-xs font-bold ${TONE[ratingTone(value)]}`}
      role="img" aria-label={`Rated ${value} out of 5${count ? ` by ${count} ${count === 1 ? "customer" : "customers"}` : ""}`}>
      <span aria-hidden>{value.toFixed(1)}</span>
      <svg aria-hidden width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3 6.9 7.5.7-5.7 5 1.7 7.4L12 18l-6.5 4 1.7-7.4-5.7-5 7.5-.7z" /></svg>
    </span>
  );
}

export function SaleTagBadge({ tag }: { tag: SaleTag }) {
  const style = tag === "TOP_DISCOUNT" ? "bg-violet-50 text-violet-800" : "bg-green-50 text-green-800";
  return <span className={`inline-block rounded px-2 py-1 text-xs font-semibold ${style}`}>{SALE_TAG_TEXT[tag]}</span>;
}
