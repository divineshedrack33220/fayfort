"use client";

import { ImagePlus, Loader2, X } from "lucide-react";
import * as React from "react";
import { Lightbox, type LightboxItem } from "@/components/ui/image-viewer";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

/**
 * Multi-image uploader. Emits an array of uploaded Cloudinary URLs via
 * `onChange` so the value stays plain JSON-serializable (string array),
 * matching the Go backend's `imageUrls` field.
 */
export function ImageUploader({
  value = [],
  onChange,
  label = "Product photos",
  hint,
  className,
  max = 5,
}: {
  value?: string[];
  onChange: (urls: string[]) => void;
  label?: string;
  hint?: string;
  className?: string;
  max?: number;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [uploadingCount, setUploadingCount] = React.useState(0);
  const [preview, setPreview] = React.useState<{ open: boolean; index: number }>({
    open: false,
    index: 0,
  });

  const uploadFile = async (file: File): Promise<string | null> => {
    if (!file.type.startsWith("image/")) {
      toast.error(`"${file.name}" is not an image file.`);
      return null;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error(`"${file.name}" is larger than 5 MB.`);
      return null;
    }
    const form = new FormData();
    form.set("file", file, file.name);
    const res = await fetch("/api/upload", { method: "POST", body: form });
    const data = (await res.json().catch(() => null)) as
      | { ok: true; url: string }
      | { ok?: undefined; error?: string }
      | null;
    if (!res.ok || !data || data.ok !== true || !data.url) {
      toast.error(
        data && "error" in data ? data.error ?? "Upload failed. Try again." : "Upload failed. Try again.",
      );
      return null;
    }
    return data.url;
  };

  const handleFiles = async (files: File[]) => {
    if (files.length === 0) return;
    const room = Math.max(0, max - value.length);
    const accepted = files.slice(0, room);
    setUploadingCount((count) => count + accepted.length);
    try {
      const next = [...value];
      for (const file of accepted) {
        const url = await uploadFile(file);
        if (url) next.push(url);
      }
      if (next.length !== value.length) {
        onChange(next);
        toast.success(`${next.length - value.length} photo${next.length - value.length === 1 ? "" : "s"} uploaded.`);
      }
    } finally {
      setUploadingCount((count) => Math.max(0, count - accepted.length));
    }
  };

  const remove = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  const atLimit = value.length >= max;

  const items: LightboxItem[] = value.map((url, index) => ({
    url,
    alt: `${label} ${index + 1}`,
  }));

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <p className="text-sm font-medium text-sand-800">
        {label}
        <span className="ml-0.5 font-normal text-sand-400">
          (optional{max > 0 ? ` · up to ${max}` : ""})
        </span>
      </p>
      {hint ? <p className="text-xs text-sand-500">{hint}</p> : null}

      {value.length > 0 ? (
        <>
          <ul className="flex flex-wrap gap-3">
            {value.map((url, index) => (
              <li key={url} className="group relative">
                {/* Tapping a thumbnail opens the full-screen viewer; the remove
                    button below is a sibling so the two never fight over a tap. */}
                <button
                  type="button"
                  aria-label={`View ${label} ${index + 1}`}
                  onClick={() => setPreview({ open: true, index })}
                  className="block overflow-hidden rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    alt={`${label} ${index + 1}`}
                    className="size-20 rounded-md object-cover ring-1 ring-sand-200"
                  />
                </button>
                <button
                  type="button"
                  aria-label={`Remove ${label} ${index + 1}`}
                  onClick={() => remove(index)}
                  className="absolute -top-2 -right-2 flex size-6 items-center justify-center rounded-full bg-sand-900 text-white shadow-sm transition-opacity hover:bg-sand-950 focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  <X aria-hidden className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
          <Lightbox
            open={preview.open}
            onOpenChange={(open) => setPreview((current) => ({ ...current, open }))}
            items={items}
            index={preview.index}
            onIndexChange={(index) => setPreview((current) => ({ ...current, index }))}
            caption={label}
          />
        </>
      ) : null}

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={atLimit || uploadingCount > 0}
        className={cn(
          "flex w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-sand-300 bg-sand-50/60 px-4 py-5 text-center transition-colors",
          "hover:border-brand-300 hover:bg-brand-50/50 focus-visible:ring-2 focus-visible:ring-brand-500 focus:outline-none",
          (atLimit || uploadingCount > 0) && "cursor-not-allowed opacity-60",
        )}
      >
        {uploadingCount > 0 ? (
          <Loader2 aria-hidden className="size-5 animate-spin text-brand-600" />
        ) : (
          <ImagePlus aria-hidden className="size-5 text-brand-600" />
        )}
        <span className="text-sm font-medium text-brand-800">
          {uploadingCount > 0
            ? `Uploading ${uploadingCount}…`
            : value.length > 0
              ? "Add more photos"
              : "Upload photos"}
        </span>
        <span className="text-xs text-sand-500">JPG, PNG or WebP · up to 5 MB each</span>
      </button>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="sr-only"
        aria-label={`${label} upload`}
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          if (files.length > 0) {
            void handleFiles(files);
          }
          event.target.value = "";
        }}
      />
    </div>
  );
}