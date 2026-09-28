"use client";

import { usePortalChatUnread } from "@/components/portal/use-portal-chat";

/** Red unread pill for the portal sidebar's Chat entry (hidden when clear). */
export function SidebarChatBadge() {
  const { unread } = usePortalChatUnread();
  if (unread === 0) return null;
  return (
    <span
      aria-label={`${unread} unread messages`}
      className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-accent-600 px-1.5 text-[10px] font-bold tabular-nums text-white"
    >
      {unread}
    </span>
  );
}