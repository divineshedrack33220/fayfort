"use client";

import { usePortalNotifications } from "@/components/portal/use-portal-notifications";

/** Red unread pill for the portal sidebar's Notifications entry. */
export function SidebarNotificationBadge() {
  const { unread } = usePortalNotifications();
  if (unread === 0) return null;
  return (
    <span
      aria-label={`${unread} unread notifications`}
      className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-accent-600 px-1.5 text-[10px] font-bold tabular-nums text-white"
    >
      {unread}
    </span>
  );
}