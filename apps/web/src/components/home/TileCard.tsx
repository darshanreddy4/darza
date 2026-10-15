import Link from "next/link";
import type { ReactNode } from "react";
import { imgSet } from "@/lib/api";

const isExternal = (url: string) => /^https:\/\//.test(url);

export function SmartLink({ href, className, children }: { href: string; className?: string; children: ReactNode }) {
  return isExternal(href)
    ? <a href={href} target="_blank" rel="noopener noreferrer" className={className}>{children}</a>
    : <Link href={href} className={className}>{children}</Link>;
}

export interface Tile { imageUrl: string; title: string; text: string; linkUrl: string }

const SHAPES = { landscape: "aspect-4/3", square: "aspect-square", portrait: "aspect-3/4" } as const;

// A picture card with an optional caption, linked when the tile has a link.
export function TileCard({ tile: t, shape = "landscape" }: { tile: Tile; shape?: keyof typeof SHAPES }) {
  const card = (
    <div className={`group relative overflow-hidden rounded-2xl bg-canvas shadow-card ${SHAPES[shape] ?? SHAPES.landscape}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img {...imgSet(t.imageUrl, "(min-width: 1024px) 25vw, 50vw", [480, 800, 1280])} loading="lazy" alt={t.title} draggable={false} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
      {(t.title || t.text) && (
        <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-ink/80 to-transparent p-5 pt-12 text-white">
          {t.title && <h3 className="text-lg font-bold">{t.title}</h3>}
          {t.text && <p className="mt-0.5 text-sm text-white/80">{t.text}</p>}
        </div>
      )}
    </div>
  );
  return t.linkUrl ? <SmartLink href={t.linkUrl} className="block">{card}</SmartLink> : card;
}
