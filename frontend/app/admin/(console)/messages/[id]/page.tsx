import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { MessagesInbox } from "@/components/admin/messages-inbox";
import { getAdminThreads } from "@/lib/data/admin";
import { getSession } from "@/lib/session";
import { BACKEND_URL } from "@/lib/backend";
import { wsEndpoint } from "@/lib/chat-socket";
import { sendThreadReply } from "../actions";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const threads = await getAdminThreads();
  const thread = threads.find((entry) => entry.id === id);
  return { title: thread ? thread.subject : "Conversation not found" };
}

export default async function AdminMessagesThreadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const threads = await getAdminThreads();
  const thread = threads.find((entry) => entry.id === id);
  if (!thread) notFound();
  const session = await getSession();
  return (
    <MessagesInbox
      initialThreads={threads}
      activeId={id}
      staffName={session?.name ?? "Fayfort Admin"}
      onReply={sendThreadReply}
      wsUrl={wsEndpoint(BACKEND_URL)}
    />
  );
}
