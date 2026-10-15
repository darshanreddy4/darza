export interface ParsedAd {
  publisherId: string;
  slotId: string;
  format: string;
  layout: string;
  layoutKey: string;
  responsive: boolean;
  width: number;
  height: number;
}

const FORMATS = ["auto", "fluid", "rectangle", "horizontal", "vertical", "autorelaxed"];

// Reads the values out of the code Google gives you. The pasted code itself is never stored or run;
// the page builds its own ad tag from these values.
export function parseAdsenseCode(code: string): { ok: true; ad: ParsedAd } | { ok: false; error: string } {
  const attr = (name: string) => new RegExp(`${name}\\s*=\\s*["']([^"']*)["']`, "i").exec(code)?.[1]?.trim() ?? "";
  const publisherId = attr("data-ad-client") || /[?&]client=(ca-pub-\d+)/i.exec(code)?.[1] || "";
  const slotId = attr("data-ad-slot");

  if (!publisherId) return { ok: false, error: "No AdSense publisher ID (ca-pub-…) found. Paste the full code from your AdSense ad unit." };
  if (!slotId) {
    return { ok: false, error: "This looks like the site-wide script without an ad unit. In AdSense choose Ads → By ad unit → Display ads, create a unit, and paste its code." };
  }

  const style = /style\s*=\s*["']([^"']*)["']/i.exec(code)?.[1] ?? "";
  const px = (prop: string) => Number(new RegExp(`${prop}\\s*:\\s*(\\d+)px`, "i").exec(style)?.[1] ?? 0);
  const format = attr("data-ad-format").toLowerCase();

  return {
    ok: true,
    ad: {
      publisherId, slotId,
      format: FORMATS.includes(format) ? format : "",
      layout: attr("data-ad-layout") === "in-article" ? "in-article" : "",
      layoutKey: attr("data-ad-layout-key"),
      responsive: attr("data-full-width-responsive").toLowerCase() === "true",
      width: px("width"), height: px("height"),
    },
  };
}

export const adsenseSummary = (c: { publisherId: string; slotId: string; format: string; width: number; height: number }) =>
  `${c.publisherId} · slot ${c.slotId} · ${c.format || `${c.width}×${c.height}`}`;
