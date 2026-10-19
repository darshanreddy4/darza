"use client";

import { useEffect, useRef, useState, type DragEvent } from "react";
import { API_URL, imgSrc } from "@/lib/api";
import { btn, inputCls } from "@/components/admin/ui";
import { CLIPBOARD_BLOCKED, CLIPBOARD_EMPTY, imageFiles, readClipboardImage } from "@/components/admin/clipboard";

// One image: drag and drop, paste a screenshot, upload from the computer, or type an https address.
export function ImageField({ name, value, onChange, crop }: { name: string; value: string; onChange: (v: string) => void; crop?: { w: number; h: number } }) {
  const input = useRef<HTMLInputElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const hovered = useRef(false);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [autoCrop, setAutoCrop] = useState(true);
  const [error, setError] = useState("");
  const cropQuery = crop && autoCrop ? `?crop=${crop.w}x${crop.h}` : "";

  async function upload(file: File) {
    setError(""); setBusy(true);
    try {
      if (!file.type.startsWith("image/")) throw new Error("That is not an image");
      if (file.size > 5 * 1024 * 1024) throw new Error("The image is larger than 5 MB");
      const body = new FormData();
      body.append("file", file, file.name || "pasted-image.png");
      const res = await fetch(`${API_URL}/admin/uploads${cropQuery}`, { method: "POST", credentials: "include", body });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error([data?.message].flat().filter(Boolean).join(", ") || "Upload failed");
      onChange(data.url);
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }

  // Ctrl or ⌘ + V pastes a copied image into the field the pointer is over or that was last clicked.
  const latest = useRef(upload);
  useEffect(() => { latest.current = upload; });
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const files = imageFiles(e.clipboardData?.files);
      const el = box.current;
      if (files.length === 0 || !el || !(hovered.current || el.contains(document.activeElement))) return;
      e.preventDefault();
      void latest.current(files[0]);
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, []);

  async function pasteScreenshot() {
    setError("");
    try {
      const file = await readClipboardImage();
      if (file) void upload(file); else setError(CLIPBOARD_EMPTY);
    } catch { setError(CLIPBOARD_BLOCKED); }
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    const [file] = imageFiles(e.dataTransfer.files);
    if (file) return void upload(file);
    // Dragging a picture from another web page gives an address instead of a file.
    const url = e.dataTransfer.getData("text/uri-list").split("\n")[0]?.trim();
    if (url && /^https:\/\/\S+$/.test(url)) { setError(""); onChange(url); } else setError("Drop an image file here");
  }

  return (
    <div>
      <p className="block text-sm font-medium">{name}</p>
      <div
        ref={box} tabIndex={-1}
        onMouseEnter={() => { hovered.current = true; }} onMouseLeave={() => { hovered.current = false; }}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false); }}
        onDrop={onDrop}
        className={`mt-1.5 rounded-xl border-2 border-dashed p-3 outline-none transition focus-within:border-brand-500/60 focus:border-brand-500/60 ${dragging ? "border-brand-500 bg-brand-50" : "border-line"}`}
      >
        <div className="flex flex-wrap items-center gap-3">
          {value && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imgSrc(value)} alt="" className="h-16 w-24 rounded-lg border border-line object-cover" />
          )}
          <button type="button" className={btn.secondary} disabled={busy} onClick={() => input.current?.click()}>{busy ? "Uploading…" : value ? "Replace image" : "Upload image"}</button>
          <button type="button" className={btn.secondary} disabled={busy} onClick={pasteScreenshot}>Paste screenshot</button>
          {value && <button type="button" className="text-sm font-medium text-red-600 hover:underline" onClick={() => onChange("")}>Remove</button>}
          <input ref={input} type="file" hidden accept="image/jpeg,image/png,image/webp,image/gif" onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); e.target.value = ""; }} />
        </div>
        {crop && (
          <label className="mt-2 flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-0.5 h-4 w-4 accent-emerald-600" checked={autoCrop} onChange={(e) => setAutoCrop(e.target.checked)} />
            <span>Crop automatically to fit<span className="block text-xs text-muted">Cuts the picture to {crop.w} × {crop.h} px, the size this spot needs, keeping the most interesting part. Applies to pictures you upload, drop or paste. Animated GIFs are kept as they are.</span></span>
          </label>
        )}
        <p className="mt-2 text-xs text-muted">{dragging ? "Drop the image to upload it" : "Drag and drop a picture here, or click here and press Ctrl or ⌘ + V to paste a screenshot. JPG, PNG, WebP or GIF, up to 5 MB."}</p>
        <input className={`${inputCls} mt-2`} placeholder="or paste an https:// image address" value={value.startsWith("/uploads/") ? "" : value} onChange={(e) => onChange(e.target.value.trim())} />
      </div>
      {error && <p role="alert" className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
