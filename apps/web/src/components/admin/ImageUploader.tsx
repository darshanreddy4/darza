"use client";

import { useCallback, useEffect, useRef, useState, type Dispatch, type DragEvent, type SetStateAction } from "react";
import { API_URL, imgSrc } from "@/lib/api";
import { btn, inputCls } from "@/components/admin/ui";

const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPT = "image/jpeg,image/png,image/webp,image/gif";
const MAX_IMAGES = 12;

export function ImageUploader({ images, setImages, max = MAX_IMAGES, hint }: { images: string[]; setImages: Dispatch<SetStateAction<string[]>>; max?: number; hint?: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(0);
  const [errors, setErrors] = useState<string[]>([]);
  const [urlDraft, setUrlDraft] = useState("");

  const upload = useCallback(async (files: File[]) => {
    const problems: string[] = [];
    const valid = files.filter((f) => {
      if (!f.type.startsWith("image/")) { problems.push(`${f.name || "Pasted item"} is not an image`); return false; }
      if (f.size > MAX_BYTES) { problems.push(`${f.name || "Image"} is larger than 5 MB`); return false; }
      return true;
    });
    setErrors(problems);
    if (valid.length === 0) return;

    setUploading((n) => n + valid.length);
    await Promise.all(valid.map(async (file) => {
      const body = new FormData();
      body.append("file", file, file.name || "pasted-image.png");
      try {
        const res = await fetch(`${API_URL}/admin/uploads`, { method: "POST", credentials: "include", body });
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error([data?.message].flat().filter(Boolean).join(", ") || "Upload failed");
        setImages((cur) => (max === 1 ? [data.url] : cur.length >= max ? cur : [...cur, data.url]));
      } catch (e) {
        setErrors((cur) => [...cur, `${file.name || "Image"}: ${(e as Error).message}`]);
      } finally {
        setUploading((n) => n - 1);
      }
    }));
  }, [setImages, max]);

  // Paste screenshots or copied images anywhere on the page.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const files = Array.from(e.clipboardData?.files ?? []).filter((f) => f.type.startsWith("image/"));
      if (files.length === 0) return;
      e.preventDefault();
      upload(files);
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [upload]);

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    upload(Array.from(e.dataTransfer.files));
  }

  function addUrl() {
    const url = urlDraft.trim();
    if (!/^https:\/\/\S+$/.test(url)) return setErrors(["Enter a valid https:// image URL"]);
    setErrors([]);
    setImages((cur) => (max === 1 ? [url] : cur.length >= max ? cur : [...cur, url]));
    setUrlDraft("");
  }

  const move = (i: number, d: -1 | 1) => setImages((cur) => {
    const j = i + d;
    if (j < 0 || j >= cur.length) return cur;
    const next = [...cur];
    [next[i], next[j]] = [next[j], next[i]];
    return next;
  });
  const remove = (i: number) => setImages((cur) => cur.filter((_, j) => j !== i));

  return (
    <div className="space-y-4">
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-6 py-10 text-center transition ${dragging ? "border-brand-500 bg-brand-50" : "border-line bg-canvas/60 hover:border-brand-500/60"}`}
      >
        <svg aria-hidden width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="text-brand-600">
          <path d="M12 16V4M7 9l5-5 5 5M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />
        </svg>
        <p className="text-sm font-semibold">{uploading > 0 ? `Uploading ${uploading} image${uploading > 1 ? "s" : ""}…` : max === 1 ? "Drag & drop an image here, or click to browse" : "Drag & drop images here, or click to browse"}</p>
        <p className="text-xs text-muted">You can also paste an image (Ctrl/⌘ + V). JPG, PNG, WebP or GIF · max 5 MB each{max > 1 ? ` · up to ${max} images` : ""}{hint ? ` · ${hint}` : ""}</p>
        <input ref={inputRef} type="file" accept={ACCEPT} multiple={max > 1} hidden onChange={(e) => { upload(Array.from(e.target.files ?? [])); e.target.value = ""; }} />
      </div>

      {errors.length > 0 && (
        <ul role="alert" className="space-y-1 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{errors.map((e, i) => <li key={i}>{e}</li>)}</ul>
      )}

      {images.length > 0 && (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {images.map((url, i) => (
            <li key={url + i} className="group relative overflow-hidden rounded-xl border border-line bg-white">
              <div className="aspect-square bg-canvas">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imgSrc(url)} alt={`Product image ${i + 1}`} className="h-full w-full object-cover" />
              </div>
              {i === 0 && <span className="absolute left-2 top-2 rounded-md bg-ink px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">Cover</span>}
              <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-linear-to-t from-ink/80 to-transparent p-2 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
                <span className="flex gap-1">
                  <button type="button" disabled={i === 0} onClick={() => move(i, -1)} aria-label={`Move image ${i + 1} earlier`} className="rounded-md bg-white/90 px-2 py-1 text-[11px] font-semibold disabled:opacity-40">‹</button>
                  <button type="button" disabled={i === images.length - 1} onClick={() => move(i, 1)} aria-label={`Move image ${i + 1} later`} className="rounded-md bg-white/90 px-2 py-1 text-[11px] font-semibold disabled:opacity-40">›</button>
                </span>
                <button type="button" onClick={() => remove(i)} aria-label={`Remove image ${i + 1}`} className="rounded-md bg-white/90 px-2 py-1 text-[11px] font-semibold text-red-600">Remove</button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="flex gap-2">
        <input value={urlDraft} onChange={(e) => setUrlDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addUrl(); } }} placeholder="…or paste an image URL (https://)" aria-label="Image URL" className={inputCls} />
        <button type="button" onClick={addUrl} className={btn.secondary}>Add URL</button>
      </div>
    </div>
  );
}
