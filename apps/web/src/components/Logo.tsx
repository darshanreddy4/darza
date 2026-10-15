import { imgSrc } from "@/lib/api";

// The brand's own logo when one has been uploaded, otherwise the built-in mark and name.
export function Logo({ light = true, logoUrl, name = "DMG", onBadge = false }: { light?: boolean; logoUrl?: string; name?: string; onBadge?: boolean }) {
  if (logoUrl) {
    return (
      <span className={onBadge && light ? "inline-flex rounded-xl bg-white px-3 py-1.5" : "inline-flex"}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imgSrc(logoUrl)} alt={name} className="h-9 w-auto max-w-[200px] object-contain" />
      </span>
    );
  }
  return (
    <span className="flex items-center gap-2.5">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-linear-to-br from-brand-500 to-gold font-display text-lg font-extrabold text-ink shadow-lg shadow-brand-500/20 before:content-[attr(data-letter)]" data-letter={name.charAt(0).toUpperCase()} aria-hidden />
      <span className={`font-display text-xl font-extrabold tracking-[0.12em] ${light ? "text-white" : "text-ink"}`}>{name.toUpperCase()}</span>
    </span>
  );
}
