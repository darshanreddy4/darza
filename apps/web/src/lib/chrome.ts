import type { CSSProperties } from "react";
import { imgSrc } from "@/lib/api";

// Colours and pictures the admin chose for the header, search bar, category bar and footer (Admin, Appearance).
export interface ChromeSection { bg?: string; fg?: string; image?: string; overlay?: number; button?: string; buttonFg?: string }
export interface ChromeStyle { header?: ChromeSection; search?: ChromeSection; nav?: ChromeSection; footer?: ChromeSection }

export const DARK_TEXT = "#0b1220";
export const LIGHT_TEXT = "#ffffff";
// The standard colours, used when only some of a section is chosen.
export const STANDARD = { header: "#0b1220", footer: "#0b1220", nav: "#ffffff", search: "#ffffff", button: "#12b886" } as const;

const channels = (hex: string): [number, number, number] => {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
};

function luminance(hex: string): number {
  const [r, g, b] = channels(hex).map((c) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// WCAG contrast ratio between two colours, 1 (none) to 21 (black on white).
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

// Whichever of white or near-black reads better on a colour.
export const readableOn = (bg: string) => (contrast(bg, LIGHT_TEXT) >= contrast(bg, DARK_TEXT) ? LIGHT_TEXT : DARK_TEXT);

export function rgba(hex: string, alpha: number): string {
  const [r, g, b] = channels(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export interface Skin { style: CSSProperties }

// Softer text (links, small print) is the text colour at part strength; the strength rises until it is still comfortable to read on this background.
function mutedAlpha(bg: string, fg: string): number {
  const [br, bgn, bb] = channels(bg);
  const [fr, fgn, fb] = channels(fg);
  const hex = (r: number, g: number, b: number) => `#${[r, g, b].map((c) => Math.round(c).toString(16).padStart(2, "0")).join("")}`;
  // Small panels inside the bar are the colour lightened a little towards the text colour; the text must read on those too.
  const panel = hex(br * 0.88 + fr * 0.12, bgn * 0.88 + fgn * 0.12, bb * 0.88 + fb * 0.12);
  for (const a of [0.75, 0.8, 0.85, 0.9, 0.95]) {
    const blended = (base: [number, number, number]) => hex(fr * a + base[0] * (1 - a), fgn * a + base[1] * (1 - a), fb * a + base[2] * (1 - a));
    if (contrast(bg, blended([br, bgn, bb])) >= 4.6 && contrast(panel, blended(channels(panel))) >= 4.6) return a;
  }
  return 1;
}

const vars = (v: Record<string, string>) => v as CSSProperties;

// The header and footer: a colour or a picture under a tint of that colour. Text is picked to be readable unless the admin chose one.
export function barSkin(s: ChromeSection | undefined, base: string, muted = false): Skin | null {
  if (!s || (!s.bg && !s.fg && !s.image)) return null;
  const bg = s.bg ?? base;
  const fg = s.fg ?? readableOn(bg);
  const tint = rgba(bg, (s.overlay ?? 55) / 100);
  // Over a picture the background is not one colour, so softer text stays stronger.
  const soft = s.image ? 0.9 : mutedAlpha(bg, fg);
  const background = s.image ? `linear-gradient(${tint}, ${tint}), url(${JSON.stringify(imgSrc(s.image))}) center / cover no-repeat, ${bg}` : bg;
  return {
    style: vars({
      background, color: muted ? rgba(fg, soft) : fg,
      "--c-fg": fg, "--c-fg-soft": rgba(fg, soft), "--c-fg-06": rgba(fg, 0.06), "--c-fg-12": rgba(fg, 0.12), "--c-fg-18": rgba(fg, 0.18),
    }),
  };
}

export function searchSkin(s: ChromeSection | undefined): Skin | null {
  if (!s || (!s.bg && !s.fg && !s.button && !s.buttonFg)) return null;
  const bg = s.bg ?? STANDARD.search;
  const fg = s.fg ?? readableOn(bg);
  const button = s.button ?? STANDARD.button;
  const buttonFg = s.buttonFg ?? readableOn(button);
  return {
    style: vars({
      backgroundColor: bg, color: fg,
      "--sb-fg": fg, "--sb-fg-55": rgba(fg, 0.55), "--sb-fg-8": rgba(fg, 0.08), "--sb-fg-18": rgba(fg, 0.18), "--sb-btn": button, "--sb-btn-fg": buttonFg,
    }),
  };
}

export function navSkin(s: ChromeSection | undefined): Skin | null {
  if (!s || (!s.bg && !s.fg)) return null;
  const bg = s.bg ?? STANDARD.nav;
  const fg = s.fg ?? readableOn(bg);
  return { style: vars({ backgroundColor: bg, "--nv-fg": fg, "--nv-fg-60": rgba(fg, 0.6) }) };
}

// Plain-language warnings for colour pairs that are hard to read, so the admin sees them before customers do.
export function chromeWarnings(c: ChromeStyle): string[] {
  const out: string[] = [];
  const pair = (label: string, bg: string, fg: string) => {
    const ratio = contrast(bg, fg);
    if (ratio < 4.5) out.push(`${label}: the text is hard to read on this colour (contrast ${ratio.toFixed(1)}:1, 4.5:1 or more is comfortable). Pick a lighter or darker text colour, or leave it on Auto.`);
  };
  if (c.header?.bg && c.header.fg) pair("Header", c.header.bg, c.header.fg);
  if (c.nav?.bg && c.nav.fg) pair("Category bar", c.nav.bg, c.nav.fg);
  if (c.footer?.bg && c.footer.fg) pair("Footer", c.footer.bg, c.footer.fg);
  if (c.search && (c.search.bg || c.search.fg)) pair("Search bar", c.search.bg ?? STANDARD.search, c.search.fg ?? readableOn(c.search.bg ?? STANDARD.search));
  if (c.search && (c.search.button || c.search.buttonFg)) pair("Search button", c.search.button ?? STANDARD.button, c.search.buttonFg ?? readableOn(c.search.button ?? STANDARD.button));
  if (c.header?.image) out.push("Header picture: check that the text is easy to read over it; raise the tint if it is not.");
  if (c.footer?.image) out.push("Footer picture: check that the text is easy to read over it; raise the tint if it is not.");
  return out;
}
