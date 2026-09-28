"use client";

import { LightboxGallery, type LightboxItem } from "@/components/ui/image-viewer";
import type { ChatAttachment } from "@/lib/chat-types";
import { cn } from "@/lib/utils";

/**
 * Renders the media attachments of a chat message. Tapping any image or video
 * opens the full-screen viewer, where the whole message's media can be paged
 * through, zoomed and played. Also renders pending (not yet uploaded) files
 * from object URLs so the sender sees exactly what they're about to send.
 */
export function ChatAttachments({
  attachments,
  className,
}: {
  attachments: { url: string; kind: ChatAttachment["kind"] }[];
  className?: string;
}) {
  if (!attachments || attachments.length === 0) return null;

  const items: LightboxItem[] = attachments.map((attachment, index) => ({
    url: attachment.url,
    kind: attachment.kind,
    alt:
      attachment.kind === "video"
        ? `Video attachment ${index + 1}`
        : `Image attachment ${index + 1}`,
  }));

  return (
    <LightboxGallery
      items={items}
      label="Message attachments"
      className={cn(
        "grid max-w-full gap-1.5",
        attachments.length === 1 ? "grid-cols-1" : "grid-cols-2",
        className,
      )}
      triggerClassName="w-full"
      imageClassName="max-h-56 max-w-full w-full rounded-lg object-cover"
      caption={
        attachments.length > 1
          ? `${items.length} attachments`
          : items[0]?.kind === "video"
            ? "Video attachment"
            : undefined
      }
    />
  );
}

/** Short label used in inbox previews for attachment-only messages. */
export function attachmentPreviewLabel(
  attachments: { url: string; kind: ChatAttachment["kind"] }[] | undefined,
): string | null {
  if (!attachments || attachments.length === 0) return null;
  const kinds = new Set(attachments.map((a) => a.kind));
  if (kinds.size === 1) return kinds.has("video") ? "🎬 Video" : "📷 Photo";
  return "📎 Attachments";
}