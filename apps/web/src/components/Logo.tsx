import { imgSrc } from "@/lib/api";
import { DEFAULT_LOGO_DESIGN, gradientStyle, imageEffectStyle, letterColour, logoText, solidStyle, wordStyle, type LogoDesign } from "@/lib/logo";

type Props = { light?: boolean; logoUrl?: string; name?: string; onBadge?: boolean; design?: LogoDesign };

// The brand's logo: a styled text wordmark, the uploaded picture (with its effect), or the built-in mark and name.
export function Logo({ light = true, logoUrl, name = "DMG", onBadge = false, design = DEFAULT_LOGO_DESIGN }: Props) {
  if (design.mode === "TEXT") return <TextLogo light={light} name={name} design={design} />;
  if (logoUrl) {
    return (
      <span className={onBadge && light ? "inline-flex rounded-xl bg-white px-3 py-1.5" : "inline-flex"}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imgSrc(logoUrl)} alt={name} style={imageEffectStyle(design.imageEffect)} className={`h-9 w-auto max-w-[200px] object-contain ${light ? "text-white" : "text-ink"}`} />
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

// Text with no background of its own, so the website shows through; "match the page" colours follow the surface it sits on.
function TextLogo({ light, name, design }: { light: boolean; name: string; design: LogoDesign }) {
  const text = logoText(design, name);
  const base = wordStyle(design);

  if (design.colorMode === "PER_LETTER") {
    let n = 0;
    return (
      <span role="img" aria-label={text} style={base}>
        {[...text].map((ch, i) => {
          if (ch.trim() === "") return <span key={i} aria-hidden>{ch}</span>;
          const style = solidStyle(design.effect, letterColour(design, n++), design.depth);
          return <span key={i} aria-hidden style={style}>{ch}</span>;
        })}
      </span>
    );
  }
  if (design.colorMode === "GRADIENT") return <span style={{ ...base, ...gradientStyle(design) }}>{text}</span>;
  if (design.colorMode === "SINGLE") return <span style={{ ...base, ...solidStyle(design.effect, design.color, design.depth) }}>{text}</span>;
  // An outline is painted in the stroke colour, so it cannot rely on the (transparent) text colour.
  const auto = design.effect === "OUTLINE" ? `var(--s-fg, ${light ? "#ffffff" : "#0b1220"})` : "currentColor";
  return <span className={light ? "text-white" : "text-ink"} style={{ ...base, ...solidStyle(design.effect, auto, design.depth) }}>{text}</span>;
}
