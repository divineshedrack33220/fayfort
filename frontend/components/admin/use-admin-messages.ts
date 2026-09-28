"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Live unread count for the staff console's Messages sidebar badge, backed by
 * the lightweight /admin/messages/unread endpoint (sum of unread threads).
 * Polls every 20s so a badge appears as soon as customers write in.
 */
export function useAdminMessagesUnread() {
  const [unread, setUnread] = useState(0);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/backend/admin/messages/unread", {
        cache: "no-store",
      });
      if (!response.ok) return;
      const payload = (await response.json()) as { unread?: number };
      setUnread(payload.unread ?? 0);
    } catch {
      // backend unreachable — keep whatever we have
    }
  }, []);

  useEffect(() => {
    const immediate = window.setTimeout(() => void load(), 0);
    const timer = window.setInterval(() => void load(), 20000);
    // The messages inbox dispatches this after it marks a thread read so the
    // sidebar badge drops right away instead of waiting for the next poll.
    const onRead = () => void load();
    window.addEventListener("fayfort:messages-read", onRead);
    return () => {
      window.clearTimeout(immediate);
      window.clearInterval(timer);
      window.removeEventListener("fayfort:messages-read", onRead);
    };
  }, [load]);

  return { unread, load };
}