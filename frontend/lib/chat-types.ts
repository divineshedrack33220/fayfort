/**
 * Shared chat attachment types. Mirrors the Go backend's ThreadAttachment
 * shape so the portal chat, the admin inbox and the data loaders all speak
 * the same language.
 */
export type ChatAttachmentKind = "image" | "video";

export interface ChatAttachment {
  url: string;
  kind: ChatAttachmentKind;
}