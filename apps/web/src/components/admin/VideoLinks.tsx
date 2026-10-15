"use client";

import { useState, type Dispatch, type SetStateAction } from "react";
import { parseVideo } from "@/lib/video";
import { btn, inputCls } from "@/components/admin/ui";

const MAX_VIDEOS = 6;
const KIND_LABEL = { youtube: "YouTube", vimeo: "Vimeo", file: "Video file" } as const;

export function VideoLinks({ videos, setVideos }: { videos: string[]; setVideos: Dispatch<SetStateAction<string[]>> }) {
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");

  function add() {
    const url = draft.trim();
    if (!url) return;
    if (!parseVideo(url)) return setError("Use an https link to a YouTube or Vimeo video, or a direct .mp4 / .webm file.");
    if (videos.includes(url)) return setError("That video is already added.");
    if (videos.length >= MAX_VIDEOS) return setError(`You can add up to ${MAX_VIDEOS} videos.`);
    setError(""); setVideos((cur) => [...cur, url]); setDraft("");
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input
          value={draft} onChange={(e) => setDraft(e.target.value)} aria-label="Video link"
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
          placeholder="Paste a YouTube, Vimeo or .mp4 link" className={inputCls}
        />
        <button type="button" onClick={add} className={btn.secondary}>Add video</button>
      </div>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}

      {videos.length > 0 && (
        <ul className="space-y-2">
          {videos.map((url, i) => {
            const info = parseVideo(url);
            return (
              <li key={url} className="flex items-center gap-3 rounded-xl border border-line bg-white p-2.5">
                <div className="relative h-12 w-20 shrink-0 overflow-hidden rounded-lg bg-ink-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {info?.thumb && <img src={info.thumb} alt="" className="h-full w-full object-cover" />}
                  <span className="absolute inset-0 grid place-items-center bg-ink/40 text-white"><svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg></span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-brand-700">{info ? KIND_LABEL[info.kind] : "Unsupported"}</p>
                  <p className="truncate text-sm text-muted">{url}</p>
                </div>
                <button type="button" className={btn.danger} onClick={() => setVideos((cur) => cur.filter((_, j) => j !== i))} aria-label={`Remove video ${i + 1}`}>Remove</button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
