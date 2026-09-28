import type { Metadata } from "next";
import { Chat } from "@/components/portal/chat";
import { getPortalThread } from "@/lib/data/portal";
import { BACKEND_URL } from "@/lib/backend";
import { wsEndpoint } from "@/lib/chat-socket";

export const metadata: Metadata = {
  title: "Chat with Fayfort",
  description:
    "Message the Fayfort team about your sourcing requests — questions, updates and quote discussions in one place.",
};

export default async function ChatPage() {
  const thread = await getPortalThread();
  return <Chat initialThread={thread} wsUrl={wsEndpoint(BACKEND_URL)} />;
}