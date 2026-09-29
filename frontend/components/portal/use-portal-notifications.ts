"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { playNotificationBlip } from "@/lib/sounds";
import type { NotificationItem } from "@/lib/notifications";

/**
 * Shared source of truth for the portal's unread count. Polls every 20s so the
 * top-bar bell and the sidebar badge stay live without reopening anything.
 * Read actions apply optimistically and then POST so state stays in sync.
 */
export function usePortalNotifications() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  // Unread count from the last successful poll; null until one has landed so
  // the first read never rings.
  const prevUnreadRef = useRef<number | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/backend/portal/notifications", {
        cache: "no-store",
      });
      if (!response.ok) return;
      const payload = (await response.json()) as {
        notifications?: NotificationItem[];
      };
      setItems(payload.notifications ?? []);
      const unread = (payload.notifications ?? []).filter((item) => !item.read).length;
      const previous = prevUnreadRef.current;
      prevUnreadRef.current = unread;
      if (previous !== null && unread > previous) playNotificationBlip();
    } catch {
      // backend unreachable — keep whatever we have
    }
  }, []);

  useEffect(() => {
    const immediate = window.setTimeout(() => void load(), 0);
    const timer = window.setInterval(() => void load(), 20000);
    return () => {
      window.clearTimeout(immediate);
      window.clearInterval(timer);
    };
  }, [load]);

  const markRead = useCallback((id: string) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, read: true } : item)),
    );
    void fetch(`/api/backend/portal/notifications/${encodeURIComponent(id)}/read`, {
      method: "POST",
    });
  }, []);

  const markAllRead = useCallback(() => {
    setItems((prev) => prev.map((item) => ({ ...item, read: true })));
    void fetch("/api/backend/portal/notifications/read", { method: "POST" });
  }, []);

  const unread = items.filter((item) => !item.read).length;

  return { items, unread, load, markRead, markAllRead };
}