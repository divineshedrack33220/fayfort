import type { ChatAttachment, ChatAttachmentKind } from "@/lib/chat-types";

/** A file picked in a chat composer, awaiting upload. */
export interface PendingChatAttachment {
  key: string;
  url: string;
  file: File;
  kind: ChatAttachmentKind;
}

/** Wrap a picked File for preview + deferred upload, or null if unsupported. */
export function pendingFromFile(file: File): PendingChatAttachment | null {
  const kind: ChatAttachmentKind | null = file.type.startsWith("image/")
    ? "image"
    : file.type.startsWith("video/")
      ? "video"
      : null;
  if (!kind) return null;
  return {
    key: `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    url: URL.createObjectURL(file),
    file,
    kind,
  };
}

export type UploadChatFileResult =
  | { ok: true; attachment: ChatAttachment }
  | { ok: false; error: string };

function maxBytesFor(kind: ChatAttachmentKind): number {
  return kind === "image" ? 5 * 1024 * 1024 : 25 * 1024 * 1024;
}

function tooLargeMessage(file: File, kind: ChatAttachmentKind): string {
  return kind === "image"
    ? `${file.name} is larger than 5 MB.`
    : `${file.name} is larger than 25 MB.`;
}

type ProgressHandler = (percent: number) => void;

/**
 * Upload one chat file, reporting byte-level progress.
 *
 * Uses XMLHttpRequest rather than `fetch` because fetch still cannot observe
 * request-body upload progress — only response progress. XHR is the sole
 * browser API that reports bytes as they leave the machine, which is what a
 * "Sending 43%" indicator needs. `fetch` remains fine everywhere else.
 *
 * `onProgress` receives 0–100 and is also called with 100 on success so the UI
 * can settle the bar before the message is posted.
 */
export function uploadChatFileWithProgress(
  file: File,
  kind: ChatAttachmentKind,
  onProgress?: ProgressHandler,
): Promise<UploadChatFileResult> {
  if (file.size > maxBytesFor(kind)) {
    return Promise.resolve({ ok: false, error: tooLargeMessage(file, kind) });
  }

  return new Promise<UploadChatFileResult>((resolve) => {
    let settled = false;
    const finish = (result: UploadChatFileResult) => {
      if (settled) return;
      settled = true;
      xhr.abort();
      resolve(result);
    };

    const form = new FormData();
    form.set("file", file, file.name);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/upload");

    if (onProgress && file.size > 0) {
      xhr.upload.addEventListener("progress", (event) => {
        if (event.lengthComputable) {
          onProgress(Math.min(99, Math.round((event.loaded / event.total) * 100)));
        }
      });
    }

    // Network-level failure, or the request never reached the server.
    xhr.addEventListener("error", () => {
      finish({ ok: false, error: "Upload failed. Check your connection and try again." });
    });
    xhr.addEventListener("abort", () => {
      if (!settled) finish({ ok: false, error: "Upload cancelled." });
    });
    xhr.addEventListener("timeout", () => {
      finish({ ok: false, error: "Upload timed out. Try again." });
    });

    xhr.addEventListener("load", () => {
      const data = (() => {
        try {
          return JSON.parse(xhr.responseText) as {
            ok?: boolean;
            url?: string;
            error?: string;
          } | null;
        } catch {
          return null;
        }
      })();
      if (xhr.status < 200 || xhr.status >= 300 || !data || data.ok !== true || !data.url) {
        finish({ ok: false, error: data?.error ?? "Upload failed. Try again." });
        return;
      }
      onProgress?.(100);
      finish({ ok: true, attachment: { url: data.url, kind } });
    });

    xhr.send(form);
  });
}

/** Upload one chat file without progress reporting. */
export async function uploadChatFile(
  file: File,
  kind: ChatAttachmentKind,
): Promise<UploadChatFileResult> {
  if (file.size > maxBytesFor(kind)) {
    return { ok: false, error: tooLargeMessage(file, kind) };
  }
  const form = new FormData();
  form.set("file", file, file.name);
  let res: Response;
  try {
    res = await fetch("/api/upload", { method: "POST", body: form });
  } catch {
    return { ok: false, error: "Upload failed. Check your connection and try again." };
  }
  const data = (await res.json().catch(() => null)) as
    | { ok?: boolean; url?: string; error?: string }
    | null;
  if (!res.ok || !data || data.ok !== true || !data.url) {
    return { ok: false, error: data?.error ?? "Upload failed. Try again." };
  }
  return { ok: true, attachment: { url: data.url, kind } };
}
