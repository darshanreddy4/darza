"use client";

import { useRef, useState, type DragEvent } from "react";
import { API_URL, imgSrc } from "@/lib/api";
import { btn, inputCls } from "@/components/admin/ui";
import { parseVideo } from "@/lib/video";

export const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
export const MAX_VIDEO_SECONDS = 60;

// Reads the duration in the browser before uploading, so oversized clips fail fast.
function readDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () => { URL.revokeObjectURL(url); resolve(v.duration); };
    v.onerror = () => { URL.revokeObjectURL(url); reject(new Error("This video can't be read. Use an MP4 (H.264) or WebM file.")); };
    v.src = url;
  });
}

export function VideoUploader({ value, onChange }: { value: string | null; onChange: (url: string | null) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [urlDraft, setUrlDraft] = useState("");

  async function upload(file: File) {
    setError("");
    if (!/^video\/(mp4|webm)$/.test(file.type)) return setError("Only MP4 and WebM videos are supported.");
    if (file.size > MAX_VIDEO_BYTES) return setError(`That file is ${(file.size / 1048576).toFixed(0)} MB. The limit is ${MAX_VIDEO_BYTES / 1048576} MB; compress it or shorten the clip.`);
    try {
      const seconds = await readDuration(file);
      // Some WebM files don't report a duration (Infinity); those are allowed through.
      if (Number.isFinite(seconds) && seconds > MAX_VIDEO_SECONDS + 1) return setError(`That video is ${Math.round(seconds)} seconds long. Banner videos can be at most ${MAX_VIDEO_SECONDS} seconds.`);
    } catch (e) {
      return setError((e as Error).message);
    }

    setProgress(0);
    const body = new FormData();
    body.append("file", file);
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_URL}/admin/uploads/video`);
    xhr.withCredentials = true;
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100)); };
    xhr.onload = () => {
      setProgress(null);
      let data: { url?: string; message?: string | string[] } = {};
      try { data = JSON.parse(xhr.responseText); } catch {}
      if (xhr.status >= 200 && xhr.status < 300 && data.url) onChange(data.url);
      else setError([data.message].flat().filter(Boolean).join(", ") || (xhr.status === 413 ? "The file is too large." : "Upload failed. Please try again."));
    };
    xhr.onerror = () => { setProgress(null); setError("Upload failed. Check your connection and try again."); };
    xhr.send(body);
  }

  function onDrop(e: DragEvent) {
    e.preventDefault(); setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) upload(f);
  }

  function addUrl() {
    const url = urlDraft.trim();
    const info = parseVideo(url);
    const ok = info?.kind === "youtube" || (info?.kind === "file" && /\.(mp4|webm)$/i.test(new URL(url).pathname));
    if (!ok) return setError("Enter a YouTube link, or an https:// link ending in .mp4 or .webm");
    setError(""); onChange(url); setUrlDraft("");
  }

  const yt = value ? parseVideo(value) : null;

  return (
    <div className="space-y-4">
      {value ? (
        <div className="overflow-hidden rounded-2xl border border-line bg-black">
          {yt?.kind === "youtube" ? (
            <iframe src={yt.embedUrl} title="YouTube preview" allow="encrypted-media" referrerPolicy="strict-origin-when-cross-origin" className="aspect-video w-full border-0" />
          ) : (
            <video src={imgSrc(value)} controls muted playsInline preload="metadata" className="max-h-72 w-full" />
          )}
          <div className="flex items-center justify-between gap-3 bg-white px-4 py-2.5 text-sm">
            <span className="truncate text-muted">{value}</span>
            <button type="button" onClick={() => onChange(null)} className={btn.danger}>Remove video</button>
          </div>
        </div>
      ) : (
        <div
          role="button" tabIndex={0}
          onClick={() => progress === null && inputRef.current?.click()}
          onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && progress === null && inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={onDrop}
          className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-6 py-9 text-center transition ${dragging ? "border-brand-500 bg-brand-50" : "border-line bg-canvas/60 hover:border-brand-500/60"}`}
        >
          {progress !== null ? (
            <div className="w-full max-w-xs" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label="Upload progress">
              <p className="text-sm font-semibold">Uploading… {progress}%</p>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-line"><div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: `${progress}%` }} /></div>
            </div>
          ) : (
            <>
              <svg aria-hidden width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="text-brand-600"><rect x="3" y="5" width="13" height="14" rx="2" /><path d="M16 10l5-3v10l-5-3" /></svg>
              <p className="text-sm font-semibold">Drag & drop a video here, or click to browse</p>
              <p className="text-xs text-muted">MP4 (H.264) or WebM · up to {MAX_VIDEO_SECONDS} seconds · max {MAX_VIDEO_BYTES / 1048576} MB. 30–60 second spots work well.</p>
            </>
          )}
          <input ref={inputRef} type="file" accept="video/mp4,video/webm" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ""; }} />
        </div>
      )}

      {error && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      {!value && progress === null && (
        <div className="flex gap-2">
          <input value={urlDraft} onChange={(e) => setUrlDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addUrl(); } }} placeholder="…or paste a YouTube or .mp4 link" aria-label="Video URL" className={inputCls} />
          <button type="button" onClick={addUrl} className={btn.secondary}>Add link</button>
        </div>
      )}
    </div>
  );
}
