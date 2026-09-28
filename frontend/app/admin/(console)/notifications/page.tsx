import type { Metadata } from "next";
import { NotificationsCentre } from "@/components/admin/notifications-centre";
import { getAdminNotifications } from "@/lib/data/admin";

export const metadata: Metadata = { title: "Notifications" };

export default async function AdminNotificationsPage() {
  const notifications = await getAdminNotifications();

  return (
    <div className="px-6 py-8 lg:px-10">
      <div className="pt-3">
        <NotificationsCentre items={notifications?.notifications ?? []} />
      </div>
    </div>
  );
}