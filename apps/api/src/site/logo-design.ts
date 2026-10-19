// How the brand's logo is drawn on the storefront: the uploaded picture (with an optional effect) or a styled text wordmark.

export const LOGO_FONTS = ["sora", "poppins", "montserrat", "raleway", "playfair", "abril", "cinzel", "pacifico", "lobster", "bebas", "righteous", "fredoka", "orbitron", "marker"] as const;
export const LOGO_WEIGHTS = [300, 400, 500, 600, 700, 800, 900] as const;
export const LOGO_MODES = ["IMAGE", "TEXT"] as const;
export const LOGO_SPACING = ["tight", "normal", "wide", "wider"] as const;
export const LOGO_SIZES = ["small", "medium", "large"] as const;
export const LOGO_COLOR_MODES = ["AUTO", "SINGLE", "PER_LETTER", "GRADIENT"] as const;
export const LOGO_TEXT_EFFECTS = ["FLAT", "SHADOW", "3D", "OUTLINE", "GLOW"] as const;
export const LOGO_IMAGE_EFFECTS = ["FLAT", "SHADOW", "3D", "GLOW"] as const;
export const MAX_LOGO_TEXT = 30;

export interface LogoDesign {
  mode: (typeof LOGO_MODES)[number];
  // Text wordmark. An empty text uses the brand name.
  text: string;
  font: (typeof LOGO_FONTS)[number];
  weight: (typeof LOGO_WEIGHTS)[number];
  italic: boolean;
  uppercase: boolean;
  spacing: (typeof LOGO_SPACING)[number];
  size: (typeof LOGO_SIZES)[number];
  // AUTO follows the surface it sits on (light on dark, dark on light); the others use the colours below.
  colorMode: (typeof LOGO_COLOR_MODES)[number];
  color: string;
  letterColors: string[];
  gradient: [string, string];
  effect: (typeof LOGO_TEXT_EFFECTS)[number];
  // How deep the 3D extrusion is, 1 to 3.
  depth: 1 | 2 | 3;
  // Effect for an uploaded picture.
  imageEffect: (typeof LOGO_IMAGE_EFFECTS)[number];
}

export const DEFAULT_LOGO_DESIGN: LogoDesign = {
  mode: "IMAGE", text: "", font: "sora", weight: 800, italic: false, uppercase: false, spacing: "normal", size: "medium",
  colorMode: "AUTO", color: "#12b886", letterColors: [], gradient: ["#12b886", "#f5b942"], effect: "FLAT", depth: 2, imageEffect: "FLAT",
};

const HEX = /^#[0-9a-fA-F]{6}$/;

const pick = <T extends string | number>(list: readonly T[], v: unknown, fallback: T, label: string, errors: string[]): T => {
  if (v === undefined || v === null || v === "") return fallback;
  if ((list as readonly unknown[]).includes(v)) return v as T;
  errors.push(`The logo ${label} is not one of the available choices`);
  return fallback;
};

const color = (v: unknown, fallback: string, label: string, errors: string[]) => {
  if (v === undefined || v === null || v === "") return fallback;
  if (typeof v === "string" && HEX.test(v)) return v.toLowerCase();
  errors.push(`The logo ${label} must be a colour like #12b886`);
  return fallback;
};

export function sanitizeLogoDesign(input: unknown): { design: LogoDesign } | { errors: string[] } {
  const c = (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;
  const d = DEFAULT_LOGO_DESIGN;
  const errors: string[] = [];

  // eslint-disable-next-line no-control-regex
  const text = typeof c.text === "string" ? c.text.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, MAX_LOGO_TEXT) : "";

  const letterColors: string[] = [];
  for (const v of Array.isArray(c.letterColors) ? c.letterColors.slice(0, MAX_LOGO_TEXT) : []) {
    if (typeof v === "string" && HEX.test(v)) letterColors.push(v.toLowerCase());
    else errors.push("Each letter colour must be a colour like #12b886");
  }

  const rawGradient = Array.isArray(c.gradient) ? c.gradient : [];
  const gradient: [string, string] = [color(rawGradient[0], d.gradient[0], "gradient colour", errors), color(rawGradient[1], d.gradient[1], "gradient colour", errors)];

  const depth = c.depth === undefined ? d.depth : c.depth;
  if (depth !== 1 && depth !== 2 && depth !== 3) errors.push("The logo 3D depth must be 1, 2 or 3");

  const design: LogoDesign = {
    mode: pick(LOGO_MODES, c.mode, d.mode, "style", errors),
    text,
    font: pick(LOGO_FONTS, c.font, d.font, "font", errors),
    weight: pick(LOGO_WEIGHTS, c.weight, d.weight, "weight", errors),
    italic: c.italic === true,
    uppercase: c.uppercase === true,
    spacing: pick(LOGO_SPACING, c.spacing, d.spacing, "letter spacing", errors),
    size: pick(LOGO_SIZES, c.size, d.size, "size", errors),
    colorMode: pick(LOGO_COLOR_MODES, c.colorMode, d.colorMode, "colour style", errors),
    color: color(c.color, d.color, "colour", errors),
    letterColors,
    gradient,
    effect: pick(LOGO_TEXT_EFFECTS, c.effect, d.effect, "effect", errors),
    depth: depth as 1 | 2 | 3,
    imageEffect: pick(LOGO_IMAGE_EFFECTS, c.imageEffect, d.imageEffect, "picture effect", errors),
  };
  if (errors.length) return { errors: [...new Set(errors)] };
  return { design };
}
