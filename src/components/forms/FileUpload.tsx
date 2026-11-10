"use client";
import { useId, useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase/client";

type Uploaded = { path: string; name: string; url?: string };

/**
 * Uploads files straight from the phone to Supabase Storage.
 *  - Checks type and size (max 10 MB) before uploading.
 *  - Shrinks big photos (max 1600px, JPEG) to save data and time.
 *  - Puts the stored file path(s) in hidden inputs named `name`, so the
 *    surrounding form sends them with everything else.
 * Storage policies in the database decide who may upload where.
 */
export function FileUpload({
  bucket,
  folder,
  name,
  label,
  hint,
  multiple = false,
  accept = "image/*,application/pdf",
  maxBytes = 10 * 1024 * 1024,
  publicUrl = false,
  capture = false,
  initial = [],
  labels,
}: {
  bucket: string;
  folder: string;
  name: string;
  label: string;
  hint?: string;
  multiple?: boolean;
  accept?: string;
  maxBytes?: number;
  publicUrl?: boolean;
  capture?: boolean;
  initial?: Uploaded[];
  labels: { uploading: string; remove: string; tooBig: string; badType: string; failed: string; takePhoto: string };
}) {
  const id = useId();
  const [files, setFiles] = useState<Uploaded[]>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const allowed = accept.split(",").map((s) => s.trim());

  function typeOk(f: File) {
    return allowed.some((a) => (a.endsWith("/*") ? f.type.startsWith(a.slice(0, -1)) : f.type === a));
  }

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
    const chosen = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!chosen.length) return;
    setBusy(true);
    const supabase = createBrowserSupabase();
    const added: Uploaded[] = [];
    for (const original of chosen) {
      if (!typeOk(original)) { setError(labels.badType); continue; }
      const file = await shrinkImage(original);
      if (file.size > maxBytes) { setError(labels.tooBig); continue; }
      const safe = file.name.toLowerCase().replace(/[^a-z0-9.]+/g, "-").slice(-60);
      const path = `${folder}/${Date.now()}-${safe}`;
      const { error: upErr } = await supabase.storage.from(bucket).upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) { setError(labels.failed); continue; }
      added.push({ path, name: original.name, url: publicUrl ? supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl : undefined });
    }
    setFiles((prev) => (multiple ? [...prev, ...added] : added.length ? added : prev));
    setBusy(false);
  }

  return (
    <div className="mb-4">
      <label htmlFor={id} className="mb-1 block font-semibold">{label}</label>
      {hint ? <p id={`${id}-hint`} className="mb-1 text-sm text-muted">{hint}</p> : null}
      <input
        id={id}
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={onChange}
        disabled={busy}
        aria-describedby={hint ? `${id}-hint` : undefined}
        {...(capture ? { capture: "environment" as const } : {})}
        className="block w-full min-h-12 rounded-lg border-2 border-dashed border-line-strong bg-white p-3 file:me-3 file:min-h-11 file:rounded-lg file:border-0 file:bg-brand file:px-4 file:font-semibold file:text-white"
      />
      {busy ? <p role="status" className="mt-2 font-semibold">⏳ {labels.uploading}</p> : null}
      {error ? <p role="alert" className="mt-2 font-semibold text-danger">⚠ {error}</p> : null}
      {files.length ? (
        <ul className="mt-2 space-y-1">
          {files.map((f) => (
            <li key={f.path} className="flex items-center gap-2">
              <span aria-hidden="true">📎</span>
              {f.url ? <img src={f.url} alt="" className="size-12 rounded object-cover" /> : null}
              <span className="break-all">{f.name}</span>
              <button type="button" className="min-h-11 px-2 font-semibold text-danger underline" onClick={() => setFiles((p) => p.filter((x) => x.path !== f.path))}>
                {labels.remove}<span className="sr-only"> {f.name}</span>
              </button>
              <input type="hidden" name={name} value={publicUrl ? f.url ?? "" : f.path} />
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/** Makes big photos smaller (max 1600px wide/tall, JPEG 80%). PDFs and small files are left alone. */
async function shrinkImage(file: File): Promise<File> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size < 400_000) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.8));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.\w+$/, ".jpg"), { type: "image/jpeg" });
  } catch {
    return file;
  }
}
