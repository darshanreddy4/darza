import { registerDecorator, type ValidationOptions } from "class-validator";

const YOUTUBE_HOSTS = new Set(["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be", "www.youtu.be"]);
const FILE = /^(https:\/\/\S+\.(mp4|webm)(\?\S*)?|\/uploads\/[A-Za-z0-9._-]+\.(mp4|webm))$/i;

export function youtubeId(value: string): string | null {
  let u: URL;
  try { u = new URL(value); } catch { return null; }
  if (u.protocol !== "https:" || !YOUTUBE_HOSTS.has(u.hostname)) return null;
  const parts = u.pathname.split("/").filter(Boolean);
  const id = u.hostname.includes("youtu.be") ? parts[0] : u.searchParams.get("v") ?? (["shorts", "embed", "live"].includes(parts[0]) ? parts[1] : undefined);
  return id && /^[\w-]{6,20}$/.test(id) ? id : null;
}

// Banner videos: an uploaded or https MP4/WebM, or a YouTube link.
export function isBannerVideoUrl(value: string): boolean {
  return FILE.test(value) || youtubeId(value) !== null;
}

export function IsBannerVideoUrl(options?: ValidationOptions) {
  return (target: object, propertyName: string) =>
    registerDecorator({
      target: target.constructor, propertyName, options: { message: "videoUrl must be an uploaded MP4/WebM, an https link ending in .mp4/.webm, or a YouTube link", ...options },
      validator: { validate: (v: unknown) => typeof v === "string" && isBannerVideoUrl(v) },
    });
}
