import type { Metadata } from "next";
import { NotificationsInbox } from "@/components/portal/notifications-inbox";
import { getPortalNotifications } from "@/lib/data/portal";

export const metadata: Metadata = {
  title: "Notifications",
  description:
    "Updates from the Fayfort team across your sourcing requests — status changes, quotes and delivery milestones.",
};

export default async function NotificationsPage() {
  const payload = await getPortalNotifications();
  return <NotificationsInbox initialItems={payload?.notifications ?? []} />;
}