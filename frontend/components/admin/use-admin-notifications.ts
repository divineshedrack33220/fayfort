"use client";

import { useCallback, useEffect, useState } from "react";

export interface AdminNotification {
  id: string;
  kind: "request" | "quote" | "inspection" | "shipment" | "customer";
  message: string;
  time: string;
  read: boolean;
  href: string;
}

/**
 * Shared source of truth for the staff console's unread count. Polls the
 * backend every 20s so both the top-bar bell and the sidebar badge stay live
 * without reopening anything. Read actions apply optimistically and then POST
 * so state and server never drift apart.
 */
export function useAdminNotifications() {
  const [items, setItems] = useState<AdminNotification[]>([]);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/backend/admin/notifications", {
        cache: "no-store",
      });
      if (!response.ok) return;
      const payload = (await response.json()) as {
        notifications?: AdminNotification[];
      };
      setItems(payload.notifications ?? []);
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
    void fetch(`/api/backend/admin/notifications/${encodeURIComponent(id)}/read`, {
      method: "POST",
    });
  }, []);

  const markAllRead = useCallback(() => {
    setItems((prev) => prev.map((item) => ({ ...item, read: true })));
    void fetch("/api/backend/admin/notifications/read", { method: "POST" });
  }, []);

  const unread = items.filter((item) => !item.read).length;

  return { items, unread, load, markRead, markAllRead };
}