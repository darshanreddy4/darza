"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
import { useAdminApi } from "@/lib/admin";
import { imgSrc } from "@/lib/api";
import { Logo } from "@/components/Logo";
import { ImageField } from "@/components/admin/ImageField";
import { btn, inputCls } from "@/components/admin/ui";
import {
  LOGO_FONTS, LOGO_PALETTES, MAX_LOGO_TEXT, colourableLetters, fontOf, gradientStyle, imageEffectStyle, letterColour, logoText, solidStyle, weightFor,
  type LogoColorMode, type LogoDesign, type LogoImageEffect, type LogoMode, type LogoTextEffect,
} from "@/lib/logo";
import { Select } from "@/components/Select";

const label = "block text-sm font-medium";
const hint = "mt-1 block text-xs font-normal text-muted";

interface Props {
  brandName: string;
  logoUrl: string;
  logoOnBadge: boolean;
  design: LogoDesign;
  onChange: (patch: { logoUrl?: string; logoOnBadge?: boolean; logoDesign?: LogoDesign }) => void;
}

function Choice({ checked, onClick, children, className = "" }: { checked: boolean; onClick: () => void; children: ReactNode; className?: string }) {
  return (
    <button
      type="button" role="radio" aria-checked={checked} onClick={onClick}
      className={`rounded-xl border px-3 py-2.5 text-left text-sm transition ${checked ? "border-brand-600 bg-brand-50 ring-2 ring-brand-500/40" : "border-line bg-white hover:border-ink-3"} ${className}`}
    >
      {children}
    </button>
  );
}

const TEXT_EFFECTS: { key: LogoTextEffect; name: string }[] = [
  { key: "FLAT", name: "Flat" }, { key: "SHADOW", name: "Soft shadow" }, { key: "3D", name: "3D" }, { key: "OUTLINE", name: "Outline" }, { key: "GLOW", name: "Glow" },
];
const IMAGE_EFFECTS: { key: LogoImageEffect; name: string }[] = [
  { key: "FLAT", name: "Flat" }, { key: "SHADOW", name: "Soft shadow" }, { key: "3D", name: "3D depth" }, { key: "GLOW", name: "Glow" },
];
const COLOUR_MODES: { key: LogoColorMode; name: string; hint: string }[] = [
  { key: "AUTO", name: "Match the page", hint: "Light on dark areas, dark on light areas" },
  { key: "SINGLE", name: "One colour", hint: "Your brand colour" },
  { key: "PER_LETTER", name: "Each letter", hint: "A different colour per letter" },
  { key: "GRADIENT", name: "Gradient", hint: "Blends from one colour to another" },
];

export function LogoDesigner({ brandName, logoUrl, logoOnBadge, design, onChange }: Props) {
  const set = (patch: Partial<LogoDesign>) => onChange({ logoDesign: { ...design, ...patch } });
  const text = logoText(design, brandName);
  const letters = colourableLetters(text);
  const font = fontOf(design.font);

  function chooseColourMode(mode: LogoColorMode) {
    const patch: Partial<LogoDesign> = { colorMode: mode };
    if (mode === "PER_LETTER" && design.letterColors.length === 0) patch.letterColors = letters.map((_, i) => LOGO_PALETTES[1].colors[i % LOGO_PALETTES[1].colors.length]);
    set(patch);
  }
  function setLetter(n: number, value: string) {
    const next = letters.map((_, i) => letterColour(design, i));
    next[n] = value;
    set({ letterColors: next });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
      <div className="space-y-5">
        <div>
          <p className={label} id="logo-style-label">Logo style</p>
          <div role="radiogroup" aria-labelledby="logo-style-label" className="mt-1.5 grid grid-cols-2 gap-2">
            {([["IMAGE", "Picture logo", "Upload your logo file"], ["TEXT", "Text logo", "Type your name and style it"]] as [LogoMode, string, string][]).map(([key, name, note]) => (
              <Choice key={key} checked={design.mode === key} onClick={() => set({ mode: key })}>
                <span className="block font-semibold">{name}</span><span className="block text-xs text-muted">{note}</span>
              </Choice>
            ))}
          </div>
        </div>

        {design.mode === "TEXT" ? (
          <>
            <label className={label}>Logo text
              <input className={`${inputCls} mt-1.5`} maxLength={MAX_LOGO_TEXT} placeholder={brandName} value={design.text} onChange={(e) => set({ text: e.target.value })} />
              <span className={hint}>Leave empty to use your brand name. It has no background, so your website shows through.</span>
            </label>

            <div>
              <p className={label} id="logo-font-label">Font</p>
              <div role="radiogroup" aria-labelledby="logo-font-label" className="mt-1.5 grid max-h-72 grid-cols-2 gap-2 overflow-y-auto pr-1 sm:grid-cols-3">
                {LOGO_FONTS.map((f) => (
                  <Choice key={f.key} checked={design.font === f.key} onClick={() => set({ font: f.key, weight: weightFor(f.key, design.weight) })}>
                    <span className="block truncate text-xl leading-tight" style={{ fontFamily: f.family }} aria-hidden>{text || "Logo"}</span>
                    <span className="mt-0.5 block text-xs text-muted">{f.label}</span>
                  </Choice>
                ))}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <label className={label}>Weight
                <Select className={`${inputCls} mt-1.5`} value={weightFor(design.font, design.weight)} disabled={font.weights.length === 1} onChange={(e) => set({ weight: Number(e.target.value) as LogoDesign["weight"] })}>
                  {font.weights.map((w) => <option key={w} value={w}>{({ 300: "Light", 400: "Regular", 500: "Medium", 600: "Semi-bold", 700: "Bold", 800: "Extra bold", 900: "Black" } as Record<number, string>)[w]}</option>)}
                </Select>
              </label>
              <label className={label}>Size
                <Select className={`${inputCls} mt-1.5`} value={design.size} onChange={(e) => set({ size: e.target.value as LogoDesign["size"] })}>
                  <option value="small">Small</option><option value="medium">Medium</option><option value="large">Large</option>
                </Select>
              </label>
              <label className={label}>Letter spacing
                <Select className={`${inputCls} mt-1.5`} value={design.spacing} onChange={(e) => set({ spacing: e.target.value as LogoDesign["spacing"] })}>
                  <option value="tight">Tight</option><option value="normal">Normal</option><option value="wide">Wide</option><option value="wider">Extra wide</option>
                </Select>
              </label>
            </div>
            <div className="flex flex-wrap gap-5 text-sm">
              <label className="flex items-center gap-2"><input type="checkbox" className="h-4 w-4 accent-emerald-600" checked={design.italic} onChange={(e) => set({ italic: e.target.checked })} /> Italic</label>
              <label className="flex items-center gap-2"><input type="checkbox" className="h-4 w-4 accent-emerald-600" checked={design.uppercase} onChange={(e) => set({ uppercase: e.target.checked })} /> All capitals</label>
            </div>

            <div>
              <p className={label} id="logo-colour-label">Colour</p>
              <div role="radiogroup" aria-labelledby="logo-colour-label" className="mt-1.5 grid gap-2 sm:grid-cols-2">
                {COLOUR_MODES.map((m) => (
                  <Choice key={m.key} checked={design.colorMode === m.key} onClick={() => chooseColourMode(m.key)}>
                    <span className="block font-semibold">{m.name}</span><span className="block text-xs text-muted">{m.hint}</span>
                  </Choice>
                ))}
              </div>

              {design.colorMode === "SINGLE" && (
                <div className="mt-3 flex items-center gap-3">
                  <ColourInput name="Logo colour" value={design.color} onChange={(c) => set({ color: c })} />
                  <span className="text-sm text-muted">{design.color}</span>
                </div>
              )}
              {design.colorMode === "GRADIENT" && (
                <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
                  <span className="flex items-center gap-2">From <ColourInput name="Gradient start colour" value={design.gradient[0]} onChange={(c) => set({ gradient: [c, design.gradient[1]] })} /></span>
                  <span className="flex items-center gap-2">To <ColourInput name="Gradient end colour" value={design.gradient[1]} onChange={(c) => set({ gradient: [design.gradient[0], c] })} /></span>
                </div>
              )}
              {design.colorMode === "PER_LETTER" && (
                <div className="mt-3 space-y-3">
                  <div className="flex flex-wrap gap-2">
                    <span className="self-center text-xs text-muted">Quick colours:</span>
                    {LOGO_PALETTES.map((p) => (
                      <button key={p.name} type="button" className="flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1 text-xs font-medium hover:border-ink-3" onClick={() => set({ letterColors: letters.map((_, i) => p.colors[i % p.colors.length]) })}>
                        <span className="flex">{p.colors.slice(0, 4).map((c, i) => <span key={i} className="h-3 w-3 first:rounded-l-full last:rounded-r-full" style={{ background: c }} />)}</span>{p.name}
                      </button>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-2" role="group" aria-label="Colour for each letter">
                    {letters.map((ch, n) => (
                      <label key={n} className="flex w-11 flex-col items-center gap-1 rounded-lg border border-line bg-canvas p-1.5">
                        <span className="text-lg font-bold leading-none" style={{ color: letterColour(design, n) }} aria-hidden>{ch}</span>
                        <input type="color" aria-label={`Colour for letter ${ch} (${n + 1} of ${letters.length})`} value={letterColour(design, n)} onChange={(e) => setLetter(n, e.target.value)} className="h-6 w-8 cursor-pointer rounded border-0 bg-transparent p-0" />
                      </label>
                    ))}
                  </div>
                </div>
              )}
              {design.colorMode !== "AUTO" && <p className={hint}>Pick colours that stand out on your header (dark) and footer; check both previews.</p>}
            </div>

            <div>
              <p className={label} id="logo-effect-label">Effect</p>
              <div role="radiogroup" aria-labelledby="logo-effect-label" className="mt-1.5 grid grid-cols-2 gap-2 sm:grid-cols-5">
                {TEXT_EFFECTS.map((e) => (
                  <Choice key={e.key} checked={design.effect === e.key} onClick={() => set({ effect: e.key })} className="text-center">
                    <span className="mb-1 block rounded-md bg-ink px-2 py-2"><Sample design={{ ...design, effect: e.key, size: "small" }} text="Aa" /></span>
                    <span className="block text-xs font-medium">{e.name}</span>
                  </Choice>
                ))}
              </div>
              {design.effect === "3D" && (
                <label className={`${label} mt-3 max-w-xs`}>3D depth
                  <Select className={`${inputCls} mt-1.5`} value={design.depth} onChange={(e) => set({ depth: Number(e.target.value) as LogoDesign["depth"] })}>
                    <option value={1}>Subtle</option><option value={2}>Medium</option><option value={3}>Deep</option>
                  </Select>
                </label>
              )}
            </div>
          </>
        ) : (
          <PictureControls logoUrl={logoUrl} logoOnBadge={logoOnBadge} design={design} onChange={onChange} set={set} />
        )}
      </div>

      <div className="lg:sticky lg:top-4 lg:self-start">
        <p className={label}>Preview</p>
        <div className="mt-1.5 space-y-3">
          <div>
            <div className="flex min-h-24 items-center rounded-2xl bg-ink px-6 py-6"><Logo logoUrl={logoUrl} name={brandName} onBadge={logoOnBadge} design={design} /></div>
            <p className={hint}>On the header, footer and sign-in screens (dark).</p>
          </div>
          <div>
            <div className="flex min-h-24 items-center rounded-2xl border border-line bg-white px-6 py-6"><Logo light={false} logoUrl={logoUrl} name={brandName} onBadge={logoOnBadge} design={design} /></div>
            <p className={hint}>On light pages such as About us.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function ColourInput({ name, value, onChange }: { name: string; value: string; onChange: (c: string) => void }) {
  return <input type="color" aria-label={name} value={value} onChange={(e) => onChange(e.target.value)} className="h-9 w-14 cursor-pointer rounded-lg border border-line bg-white p-1" />;
}

// A small swatch of a text effect, drawn in the colours chosen for the logo.
function Sample({ design, text }: { design: LogoDesign; text: string }) {
  const c = design.colorMode === "SINGLE" ? design.color : design.colorMode === "PER_LETTER" ? letterColour(design, 0) : design.colorMode === "GRADIENT" ? design.gradient[0] : "#ffffff";
  const style: CSSProperties = design.colorMode === "GRADIENT" ? gradientStyle(design) : solidStyle(design.effect, c, design.depth);
  return <span className="text-xl font-extrabold leading-none" style={style} aria-hidden>{text}</span>;
}

function PictureControls({ logoUrl, logoOnBadge, design, onChange, set }: Pick<Props, "logoUrl" | "logoOnBadge" | "design" | "onChange"> & { set: (p: Partial<LogoDesign>) => void }) {
  const call = useAdminApi();
  const [strength, setStrength] = useState("medium");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const uploaded = logoUrl.startsWith("/uploads/");

  async function makeTransparent() {
    setError(""); setNotice(""); setBusy(true);
    try {
      const { url } = await call<{ url: string }>("/admin/site-profile/transparent-logo", { method: "POST", body: JSON.stringify({ url: logoUrl, strength }) });
      onChange({ logoUrl: url, logoOnBadge: false });
      setNotice("Done. The background is now transparent. Save to keep it, or choose Replace image to go back.");
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }

  return (
    <>
      <ImageField name="Logo picture" value={logoUrl} onChange={(v) => { onChange({ logoUrl: v }); setNotice(""); }} />
      <p className={hint}>Best: a PNG or WebP with a transparent background. Leave empty to use the built-in name and mark.</p>

      <div className="rounded-xl border border-line p-4">
        <p className="text-sm font-semibold">Transparent background</p>
        <p className={hint}>If your logo has a plain white or coloured box around it, this removes it so your website shows through. Spaces inside the letters are kept.</p>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <label className="text-sm font-medium">Strength
            <Select className={`${inputCls} mt-1.5`} value={strength} onChange={(e) => setStrength(e.target.value)}>
              <option value="low">Gentle</option><option value="medium">Standard</option><option value="high">Strong</option>
            </Select>
          </label>
          <button type="button" className={btn.secondary} disabled={busy || !uploaded} onClick={makeTransparent}>{busy ? "Working…" : "Make background transparent"}</button>
        </div>
        {!uploaded && <p className={hint}>Upload the logo from your computer first (a pasted web address cannot be changed).</p>}
        {error && <p role="alert" className="mt-2 text-xs text-red-600">{error}</p>}
        {notice && <p role="status" className="mt-2 text-xs text-emerald-700">{notice}</p>}
      </div>

      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" className="mt-0.5 h-4 w-4 accent-emerald-600" checked={logoOnBadge} onChange={(e) => onChange({ logoOnBadge: e.target.checked })} />
        <span>Show my logo on a white badge<span className={hint}>For dark logos that disappear on the dark header. Leave it off for a see-through logo.</span></span>
      </label>

      <div>
        <p className={label} id="logo-picture-effect-label">Effect</p>
        <div role="radiogroup" aria-labelledby="logo-picture-effect-label" className="mt-1.5 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {IMAGE_EFFECTS.map((e) => (
            <Choice key={e.key} checked={design.imageEffect === e.key} onClick={() => set({ imageEffect: e.key })} className="text-center">
              <span className="mb-1 flex h-12 items-center justify-center rounded-md bg-ink px-2 text-white">
                {logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={imgSrc(logoUrl)} alt="" className="h-8 w-auto max-w-full object-contain" style={imageEffectStyle(e.key)} />
                ) : <span className="text-lg font-extrabold" style={imageEffectStyle(e.key)}>Aa</span>}
              </span>
              <span className="block text-xs font-medium">{e.name}</span>
            </Choice>
          ))}
        </div>
      </div>
    </>
  );
}
