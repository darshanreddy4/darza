export type VideoInfo =
  | { kind: "youtube"; id: string; embedUrl: string; thumb: string }
  | { kind: "vimeo"; id: string; embedUrl: string; thumb: null }
  | { kind: "file"; embedUrl: string; thumb: null };

const YT = new Set(["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be", "www.youtu.be"]);
const VIMEO = new Set(["vimeo.com", "www.vimeo.com", "player.vimeo.com"]);

export function parseVideo(value: string): VideoInfo | null {
  let u: URL;
  try { u = new URL(value.trim()); } catch { return null; }
  if (u.protocol !== "https:") return null;

  if (YT.has(u.hostname)) {
    const parts = u.pathname.split("/").filter(Boolean);
    const id = u.hostname.includes("youtu.be") ? parts[0] : u.searchParams.get("v") ?? (["shorts", "embed", "live"].includes(parts[0]) ? parts[1] : undefined);
    if (!id || !/^[\w-]{6,20}$/.test(id)) return null;
    return { kind: "youtube", id, embedUrl: `https://www.youtube-nocookie.com/embed/${id}?rel=0`, thumb: `https://i.ytimg.com/vi/${id}/hqdefault.jpg` };
  }
  if (VIMEO.has(u.hostname)) {
    const id = u.pathname.split("/").filter(Boolean).find((s) => /^\d+$/.test(s));
    if (!id) return null;
    return { kind: "vimeo", id, embedUrl: `https://player.vimeo.com/video/${id}`, thumb: null };
  }
  if (/\.(mp4|webm|ogg)$/i.test(u.pathname)) return { kind: "file", embedUrl: u.toString(), thumb: null };
  return null;
}
