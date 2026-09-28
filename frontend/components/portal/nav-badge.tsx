"use client";

import { usePortalChatUnread } from "@/components/portal/use-portal-chat";
import { usePortalNotifications } from "@/components/portal/use-portal-notifications";

/** Unread count bubble for a bottom tab, positioned over the tab icon. */
function TabBadge({ count, label }: { count: number; label: string }) {
  if (count <= 0) return null;
  return (
    <span
      aria-label={`${count} unread ${label}`}
      className="absolute -top-0.5 -right-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent-600 px-1 text-[9px] leading-none font-bold tabular-nums text-white ring-2 ring-white"
    >
      {count > 9 ? "9+" : count}
    </span>
  );
}

/** Unread messages bubble for the Chat tab. */
export function ChatTabBadge() {
  const { unread } = usePortalChatUnread();
  return <TabBadge count={unread} label={unread === 1 ? "message" : "messages"} />;
}

/** Unread notifications bubble for the Notifications tab. */
export function NotificationTabBadge() {
  const { unread } = usePortalNotifications();
  return <TabBadge count={unread} label={unread === 1 ? "notification" : "notifications"} />;
}
