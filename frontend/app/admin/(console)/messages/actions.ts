"use server";

import { revalidatePath } from "next/cache";
import type { ChatAttachment } from "@/lib/chat-types";
import { replyToThread } from "@/lib/data/admin";

export async function sendThreadReply(
  threadId: string,
  text: string,
  attachments?: ChatAttachment[],
): Promise<void> {
  // A server action is a public entry point: attachment-only replies arrive
  // without a body, so `text` cannot be trusted to be a string.
  const trimmed = (text ?? "").trim();
  if (!trimmed && (!attachments || attachments.length === 0)) return;
  await replyToThread(threadId, trimmed, attachments);
  revalidatePath("/admin/messages");
}
