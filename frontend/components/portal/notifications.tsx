"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, Check } from "lucide-react";
import { toast } from "@/components/ui/toast";
import type { NotificationItem } from "@/lib/notifications";
import { cn } from "@/lib/utils";
import { usePortalNotifications } from "@/components/portal/use-portal-notifications";

function NotificationsList({
  items,
  onMarkAllRead,
  onOpenItem,
}: {
  items: NotificationItem[];
  onMarkAllRead: () => void;
  onOpenItem: (id: string) => void;
}) {
  const unread = items.filter((item) => !item.read).length;
  return (
    <>
      <div className="flex items-center justify-between gap-3 border-b border-sand-100 px-4 py-3">
        <p className="font-display text-sm font-semibold text-brand-900">
          Notifications
        </p>
        {unread > 0 ? (
          <button
            type="button"
            onClick={onMarkAllRead}
            className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:text-brand-800"
          >
            <Check aria-hidden className="size-3.5" />
            Mark all read
          </button>
        ) : (
          <span className="text-xs text-sand-400">All caught up</span>
        )}
      </div>

      <ul className="flex max-h-72 flex-col overflow-y-auto">
        {items.length === 0 ? (
          <li className="px-4 py-6 text-center text-sm text-sand-500">
            No notifications yet.
          </li>
        ) : null}
        {items.map((item) => {
          const row = (
            <span className="flex items-start gap-3">
              <span
                aria-hidden
                className={cn(
                  "mt-1.5 size-2 shrink-0 rounded-full",
                  item.read ? "bg-sand-200" : "bg-accent-500",
                )}
              />
              <span className="flex min-w-0 flex-col">
                <span className="text-sm font-semibold text-brand-900">
                  {item.title}
                </span>
                <span className="text-sm text-sand-500">{item.body}</span>
                <span className="mt-0.5 text-[10px] text-sand-400">{item.at}</span>
              </span>
            </span>
          );
          return (
            <li
              key={item.id}
              className="border-b border-sand-100 px-4 py-3 transition-colors last:border-b-0"
            >
              {item.requestId ? (
                <Link
                  href={`/dashboard/${item.requestId}`}
                  onClick={() => onOpenItem(item.id)}
                  className="block rounded-lg outline-none hover:bg-brand-50/60 focus-visible:ring-2 focus-visible:ring-brand-500/60"
                >
                  {row}
                </Link>
              ) : (
                row
              )}
            </li>
          );
        })}
      </ul>

      <p className="flex items-center gap-1 border-t border-sand-100 px-4 py-2.5 text-xs text-sand-400">
          <Link
            href="/notifications"
            className="font-medium text-brand-700 hover:text-brand-800"
          >
            View all
          </Link>
        </p>
    </>
  );
}

export function Notifications({
  align = "right",
  onDark = false,
}: {
  align?: "left" | "right";
  onDark?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { items, unread, load, markRead, markAllRead } = usePortalNotifications();

  const handleToggle = () => {
    setOpen((value) => {
      if (!value) void load();
      return !value;
    });
  };

  const handleOpenItem = (id: string) => markRead(id);

  useEffect(() => {
    if (!open) return;
    const handler = (event: PointerEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", handler);
    return () => document.removeEventListener("pointerdown", handler);
  }, [open]);

  const handleMarkAllRead = () => {
    markAllRead();
    toast.success("All notifications marked as read");
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={handleToggle}
        aria-label={
          unread > 0
            ? `Notifications, ${unread} unread`
            : "Notifications, all read"
        }
        aria-expanded={open}
        className={cn(
          "relative flex size-9 items-center justify-center rounded-md transition-colors",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/60",
          open
            ? onDark
              ? "bg-white/10 text-white"
              : "bg-brand-50 text-brand-700"
            : onDark
              ? "text-brand-200 hover:bg-white/5 hover:text-white"
              : "text-sand-500 hover:bg-sand-100 hover:text-brand-700",
        )}
      >
        <Bell aria-hidden className="size-5" />
        {unread > 0 ? (
          <span className="absolute top-0.5 right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent-600 px-1 text-[9px] font-bold text-white">
            {unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label="Notifications"
          className={cn(
            "absolute z-40 mt-2 w-[min(20rem,calc(100vw-6rem))] overflow-hidden rounded-xl border border-sand-200 bg-white shadow-lg",
            align === "right" ? "right-0" : "left-0",
          )}
        >
          <NotificationsList
            items={items}
            onMarkAllRead={handleMarkAllRead}
            onOpenItem={handleOpenItem}
          />
        </div>
      ) : null}
    </div>
  );
}