"use client";

import { useRef, useState } from "react";
import { API_URL, imgSrc } from "@/lib/api";
import { btn, inputCls } from "@/components/admin/ui";

// One image, uploaded from the computer or pasted as an https address.
export function ImageField({ name, value, onChange }: { name: string; value: string; onChange: (v: string) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function upload(file: File) {
    setError(""); setBusy(true);
    try {
      if (file.size > 5 * 1024 * 1024) throw new Error("The image is larger than 5 MB");
      const body = new FormData();
      body.append("file", file, file.name);
      const res = await fetch(`${API_URL}/admin/uploads`, { method: "POST", credentials: "include", body });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error([data?.message].flat().filter(Boolean).join(", ") || "Upload failed");
      onChange(data.url);
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }

  return (
    <div>
      <p className="block text-sm font-medium">{name}</p>
      <div className="mt-1.5 flex flex-wrap items-center gap-3">
        {value && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imgSrc(value)} alt="" className="h-16 w-24 rounded-lg border border-line object-cover" />
        )}
        <button type="button" className={btn.secondary} disabled={busy} onClick={() => input.current?.click()}>{busy ? "Uploading…" : value ? "Replace image" : "Upload image"}</button>
        {value && <button type="button" className="text-sm font-medium text-red-600 hover:underline" onClick={() => onChange("")}>Remove</button>}
        <input ref={input} type="file" hidden accept="image/jpeg,image/png,image/webp,image/gif" onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); e.target.value = ""; }} />
      </div>
      <input className={`${inputCls} mt-2`} placeholder="or paste an https:// image address" value={value.startsWith("/uploads/") ? "" : value} onChange={(e) => onChange(e.target.value.trim())} />
      {error && <p role="alert" className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
