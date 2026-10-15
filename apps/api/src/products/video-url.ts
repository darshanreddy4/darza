const YOUTUBE_HOSTS = new Set(["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be", "www.youtu.be"]);
const VIMEO_HOSTS = new Set(["vimeo.com", "www.vimeo.com", "player.vimeo.com"]);

// Accepts YouTube/Vimeo links and direct HTTPS links to video files.
export function isSupportedVideoUrl(value: string): boolean {
  let u: URL;
  try { u = new URL(value); } catch { return false; }
  if (u.protocol !== "https:") return false;
  if (YOUTUBE_HOSTS.has(u.hostname) || VIMEO_HOSTS.has(u.hostname)) return true;
  return /\.(mp4|webm|ogg)$/i.test(u.pathname);
}
