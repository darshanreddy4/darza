import { ratingTone, ratingWord } from "@/lib/labels";
import { RatingBadge } from "./ProductBadges";
import { MediaThumbs, type MediaItem } from "./ReviewMedia";

export interface ReviewItem { id: string; rating: number; title: string | null; body: string; verified: boolean; createdAt: string; author: string; media?: MediaItem[] }
export interface ReviewSummaryData { average: number | null; count: number; breakdown?: Record<number, number> }

const WORD_TONE = { good: "bg-green-50 text-green-800", fair: "bg-amber-50 text-amber-900", poor: "bg-red-50 text-red-800" } as const;
const BAR_TONE = { good: "bg-green-600", fair: "bg-amber-400", poor: "bg-red-500" } as const;

// The average with a word, how many ratings, and how they split by stars.
export function RatingSummary({ data }: { data: ReviewSummaryData }) {
  if (data.count === 0 || data.average === null) return null;
  const tone = ratingTone(data.average);
  return (
    <div className="flex flex-wrap items-center gap-x-10 gap-y-5">
      <div>
        <p className="flex items-baseline gap-2">
          <span className="font-display text-4xl font-bold">{data.average.toFixed(1)}</span>
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${WORD_TONE[tone]}`}>{ratingWord(data.average)}</span>
        </p>
        <p className="mt-1 text-sm text-muted">based on {data.count.toLocaleString("en-IN")} {data.count === 1 ? "review" : "reviews"}</p>
      </div>
      {data.breakdown && (
        <ul className="min-w-56 flex-1 space-y-1.5" aria-label="Reviews by stars">
          {[5, 4, 3, 2, 1].map((n) => {
            const c = data.breakdown?.[n] ?? 0;
            return (
              <li key={n} className="flex items-center gap-2 text-xs">
                <span className="w-6 shrink-0 font-medium">{n} ★</span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-line"><span className={`block h-full rounded-full ${BAR_TONE[ratingTone(n)]}`} style={{ width: `${(c / data.count) * 100}%` }} /></span>
                <span className="w-9 shrink-0 text-right text-muted">{c.toLocaleString("en-IN")}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function ReviewCard({ r, clamp = true }: { r: ReviewItem; clamp?: boolean }) {
  return (
    <article className="flex h-full flex-col rounded-2xl border border-line bg-canvas p-4">
      <div className="flex items-center gap-2">
        <RatingBadge value={r.rating} />
        {r.title && <h3 className="line-clamp-1 text-sm font-bold">{r.title}</h3>}
      </div>
      <p className={`mt-2 flex-1 text-sm leading-relaxed text-ink-3 ${clamp ? "line-clamp-5" : ""}`}>{r.body}</p>
      {r.media && r.media.length > 0 && <div className="mt-3"><MediaThumbs items={r.media} size={56} label="Photos and videos in this review" /></div>}
      <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
        <span className="font-medium text-ink-3">{r.author}</span>
        <span>{new Date(r.createdAt).toLocaleDateString("en-IN", { dateStyle: "medium" })}</span>
        {r.verified && <span className="rounded-full bg-brand-50 px-2 py-0.5 font-semibold text-brand-800">Verified purchase</span>}
      </p>
    </article>
  );
}
