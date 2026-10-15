"use client";

import { BANNER_POSITIONS, type BannerPosition } from "@/lib/banner-position";

const NAMES: Record<BannerPosition, string> = {
  "top-left": "Top left", "top-center": "Top centre", "top-right": "Top right",
  "middle-left": "Middle left", "middle-center": "Centre", "middle-right": "Middle right",
  "bottom-left": "Bottom left", "bottom-center": "Bottom centre", "bottom-right": "Bottom right",
};

export function PositionPicker({ value, onChange, label, disabled }: {
  value: BannerPosition; onChange: (p: BannerPosition) => void; label: string; disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <div role="radiogroup" aria-label={label} className={`grid w-36 grid-cols-3 gap-1 rounded-xl border border-line bg-canvas p-1.5 ${disabled ? "pointer-events-none opacity-40" : ""}`}>
        {BANNER_POSITIONS.map((p) => (
          <button
            key={p} type="button" role="radio" aria-checked={value === p} aria-label={NAMES[p]} title={NAMES[p]} disabled={disabled} onClick={() => onChange(p)}
            className={`grid aspect-[3/2] place-items-center rounded-md border transition ${value === p ? "border-brand-500 bg-brand-500" : "border-line bg-white hover:border-brand-500/60"}`}
          >
            {value === p && <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-white" />}
          </button>
        ))}
      </div>
      <p className="text-sm text-muted">{NAMES[value]}</p>
    </div>
  );
}
