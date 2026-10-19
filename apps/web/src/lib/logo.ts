import type { CSSProperties } from "react";

// How the brand's logo is drawn: the uploaded picture (with an effect) or a styled text wordmark. Mirrors the API's logo-design.ts.

export type LogoMode = "IMAGE" | "TEXT";
export type LogoFontKey = "sora" | "poppins" | "montserrat" | "raleway" | "playfair" | "abril" | "cinzel" | "pacifico" | "lobster" | "bebas" | "righteous" | "fredoka" | "orbitron" | "marker";
export type LogoWeight = 300 | 400 | 500 | 600 | 700 | 800 | 900;
export type LogoSpacing = "tight" | "normal" | "wide" | "wider";
export type LogoSize = "small" | "medium" | "large";
export type LogoColorMode = "AUTO" | "SINGLE" | "PER_LETTER" | "GRADIENT";
export type LogoTextEffect = "FLAT" | "SHADOW" | "3D" | "OUTLINE" | "GLOW";
export type LogoImageEffect = "FLAT" | "SHADOW" | "3D" | "GLOW";

export interface LogoDesign {
  mode: LogoMode;
  text: string;
  font: LogoFontKey;
  weight: LogoWeight;
  italic: boolean;
  uppercase: boolean;
  spacing: LogoSpacing;
  size: LogoSize;
  colorMode: LogoColorMode;
  color: string;
  letterColors: string[];
  gradient: [string, string];
  effect: LogoTextEffect;
  depth: 1 | 2 | 3;
  imageEffect: LogoImageEffect;
}

export const DEFAULT_LOGO_DESIGN: LogoDesign = {
  mode: "IMAGE", text: "", font: "sora", weight: 800, italic: false, uppercase: false, spacing: "normal", size: "medium",
  colorMode: "AUTO", color: "#12b886", letterColors: [], gradient: ["#12b886", "#f5b942"], effect: "FLAT", depth: 2, imageEffect: "FLAT",
};

export const MAX_LOGO_TEXT = 30;

export const LOGO_FONTS: { key: LogoFontKey; label: string; family: string; weights: LogoWeight[]; note: string }[] = [
  { key: "sora", label: "Sora", family: 'var(--font-sora), "Sora", system-ui, sans-serif', weights: [400, 500, 600, 700, 800], note: "Modern" },
  { key: "poppins", label: "Poppins", family: '"Poppins", system-ui, sans-serif', weights: [300, 400, 500, 600, 700, 800, 900], note: "Friendly geometric" },
  { key: "montserrat", label: "Montserrat", family: '"Montserrat", system-ui, sans-serif', weights: [300, 400, 500, 600, 700, 800, 900], note: "Clean city" },
  { key: "raleway", label: "Raleway", family: '"Raleway", system-ui, sans-serif', weights: [300, 400, 500, 600, 700, 800, 900], note: "Elegant sans" },
  { key: "playfair", label: "Playfair Display", family: '"Playfair Display", Georgia, serif', weights: [400, 500, 600, 700, 800, 900], note: "Luxury serif" },
  { key: "abril", label: "Abril Fatface", family: '"Abril Fatface", Georgia, serif', weights: [400], note: "Fashion headline" },
  { key: "cinzel", label: "Cinzel", family: '"Cinzel", Georgia, serif', weights: [400, 500, 600, 700, 800, 900], note: "Classic capitals" },
  { key: "pacifico", label: "Pacifico", family: '"Pacifico", cursive', weights: [400], note: "Casual script" },
  { key: "lobster", label: "Lobster", family: '"Lobster", cursive', weights: [400], note: "Bold script" },
  { key: "bebas", label: "Bebas Neue", family: '"Bebas Neue", Impact, sans-serif', weights: [400], note: "Tall and strong" },
  { key: "righteous", label: "Righteous", family: '"Righteous", system-ui, sans-serif', weights: [400], note: "Retro display" },
  { key: "fredoka", label: "Fredoka", family: '"Fredoka", system-ui, sans-serif', weights: [300, 400, 500, 600, 700], note: "Rounded and playful" },
  { key: "orbitron", label: "Orbitron", family: '"Orbitron", system-ui, sans-serif', weights: [400, 500, 600, 700, 800, 900], note: "Tech" },
  { key: "marker", label: "Permanent Marker", family: '"Permanent Marker", cursive', weights: [400], note: "Hand drawn" },
];

export const fontOf = (key: LogoFontKey) => LOGO_FONTS.find((f) => f.key === key) ?? LOGO_FONTS[0];

// The closest weight the chosen font actually has.
export function weightFor(font: LogoFontKey, weight: number): LogoWeight {
  const have = fontOf(font).weights;
  return have.reduce((best, w) => (Math.abs(w - weight) < Math.abs(best - weight) ? w : best), have[0]);
}

export const LOGO_SIZE_PX: Record<LogoSize, number> = { small: 20, medium: 26, large: 34 };
const SPACING_EM: Record<LogoSpacing, string> = { tight: "-0.02em", normal: "0.01em", wide: "0.08em", wider: "0.18em" };

export const LOGO_PALETTES: { name: string; colors: string[] }[] = [
  { name: "Google", colors: ["#4285f4", "#ea4335", "#fbbc05", "#4285f4", "#34a853", "#ea4335"] },
  { name: "Rainbow", colors: ["#ef4444", "#f97316", "#eab308", "#22c55e", "#3b82f6", "#8b5cf6"] },
  { name: "Sunset", colors: ["#f43f5e", "#fb7185", "#f97316", "#fb923c", "#f59e0b"] },
  { name: "Ocean", colors: ["#0ea5e9", "#06b6d4", "#14b8a6", "#3b82f6", "#6366f1"] },
  { name: "Berry", colors: ["#be185d", "#c026d3", "#7c3aed", "#db2777", "#9333ea"] },
  { name: "Forest", colors: ["#166534", "#15803d", "#65a30d", "#4d7c0f", "#a16207"] },
];

// The letters that can have their own colour (spaces never do).
export const colourableLetters = (text: string) => [...text].filter((ch) => ch.trim() !== "");

// What the wordmark says: the chosen text, else the brand name, in capitals when asked.
export function logoText(design: LogoDesign, brandName: string) {
  const t = design.text.trim() || brandName;
  return design.uppercase ? t.toUpperCase() : t;
}

export function letterColour(design: LogoDesign, index: number) {
  const list = design.letterColors;
  return list.length ? list[index % list.length] : design.color;
}

const shade = (c: string) => `color-mix(in srgb, ${c} 45%, black)`;
const light = (c: string) => `color-mix(in srgb, ${c} 65%, white)`;

function extrusion(c: string, depth: number) {
  const steps = depth === 1 ? 3 : depth === 2 ? 6 : 10;
  const layers = [`-0.012em -0.012em 0 ${light(c)}`];
  for (let i = 1; i <= steps; i++) layers.push(`${(i * 0.02).toFixed(3)}em ${(i * 0.02).toFixed(3)}em 0 ${shade(c)}`);
  layers.push(`${(steps * 0.02 + 0.03).toFixed(3)}em ${(steps * 0.02 + 0.05).toFixed(3)}em 0.1em rgb(0 0 0 / 0.45)`);
  return layers.join(", ");
}

// Style for one solid-colour piece of text (a whole word or a single letter). "currentColor" leaves the text colour to the page.
export function solidStyle(effect: LogoTextEffect, c: string, depth: number): CSSProperties {
  const own: CSSProperties = c === "currentColor" ? {} : { color: c };
  switch (effect) {
    case "SHADOW": return { ...own, textShadow: "0.05em 0.07em 0.12em rgb(0 0 0 / 0.45)" };
    case "3D": return { ...own, textShadow: extrusion(c, depth) };
    case "OUTLINE": return { color: "transparent", WebkitTextStroke: `0.035em ${c}` };
    case "GLOW": return { ...own, textShadow: `0 0 0.12em ${c}, 0 0 0.35em ${c}` };
    default: return own;
  }
}

// Gradient text paints through the glyphs, so its effects use drop-shadow filters instead of text-shadow.
export function gradientStyle(design: LogoDesign): CSSProperties {
  const [a, b] = design.gradient;
  const fill: CSSProperties = { backgroundImage: `linear-gradient(90deg, ${a}, ${b})`, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent", WebkitTextFillColor: "transparent" };
  switch (design.effect) {
    case "SHADOW": return { ...fill, filter: "drop-shadow(0.05em 0.07em 0.08em rgb(0 0 0 / 0.45))" };
    case "3D": {
      const steps = design.depth === 1 ? 3 : design.depth === 2 ? 5 : 8;
      const chain = Array.from({ length: steps }, () => `drop-shadow(0.02em 0.02em 0 ${shade(b)})`);
      return { ...fill, filter: [...chain, "drop-shadow(0.05em 0.1em 0.1em rgb(0 0 0 / 0.4))"].join(" ") };
    }
    case "OUTLINE": return { color: "transparent", WebkitTextStroke: `0.035em ${a}` };
    case "GLOW": return { ...fill, filter: `drop-shadow(0 0 0.15em ${a}) drop-shadow(0 0 0.35em ${b})` };
    default: return fill;
  }
}

export function wordStyle(design: LogoDesign): CSSProperties {
  const px = LOGO_SIZE_PX[design.size];
  return {
    fontFamily: fontOf(design.font).family,
    fontWeight: weightFor(design.font, design.weight),
    fontStyle: design.italic ? "italic" : "normal",
    letterSpacing: SPACING_EM[design.spacing],
    fontSize: `clamp(${Math.round(px * 0.78)}px, 5.5vw, ${px}px)`,
    lineHeight: 1.15,
    whiteSpace: "pre",
    display: "inline-block",
    paddingBottom: "0.12em",
  };
}

// Effect for an uploaded picture; the picture keeps its own colours, so effects are light and dark shadows only.
export function imageEffectStyle(effect: LogoImageEffect): CSSProperties {
  switch (effect) {
    case "SHADOW": return { filter: "drop-shadow(0 3px 4px rgb(0 0 0 / 0.45))" };
    case "3D": return { filter: ["drop-shadow(-1px -1px 0 rgb(255 255 255 / 0.4))", ...Array.from({ length: 4 }, () => "drop-shadow(1px 1px 0 rgb(0 0 0 / 0.6))"), "drop-shadow(0 7px 8px rgb(0 0 0 / 0.4))"].join(" ") };
    case "GLOW": return { filter: "drop-shadow(0 0 5px currentColor) drop-shadow(0 0 14px currentColor)" };
    default: return {};
  }
}
