"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Live unread reply count for the portal sidebar's Chat badge, backed by the
 * lightweight /portal/thread/unread endpoint. The badge clears when the chat
 * is opened (its read POST) and returns once staff reply again.
 */
export function usePortalChatUnread() {
  const [unread, setUnread] = useState(0);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/backend/portal/thread/unread", {
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
    // The chat page dispatches this after marking itself read so the sidebar
    // badge clears right away instead of waiting for the next poll.
    const onRead = () => void load();
    window.addEventListener("fayfort:chat-read", onRead);
    return () => {
      window.clearTimeout(immediate);
      window.clearInterval(timer);
      window.removeEventListener("fayfort:chat-read", onRead);
    };
  }, [load]);

  return { unread, load };
}