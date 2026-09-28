import type { Metadata } from "next";
import { MessagesInbox } from "@/components/admin/messages-inbox";
import { getAdminThreads } from "@/lib/data/admin";
import { getSession } from "@/lib/session";
import { BACKEND_URL } from "@/lib/backend";
import { wsEndpoint } from "@/lib/chat-socket";
import { sendThreadReply } from "./actions";

export const metadata: Metadata = { title: "Messages" };

export default async function AdminMessagesPage() {
  const session = await getSession();
  const threads = await getAdminThreads();
  return (
    <MessagesInbox
      initialThreads={threads}
      activeId={null}
      staffName={session?.name ?? "Fayfort Admin"}
      onReply={sendThreadReply}
      wsUrl={wsEndpoint(BACKEND_URL)}
    />
  );
}
