"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, Check, Mail, ScrollText, Ship, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAdminNotifications } from "@/components/admin/use-admin-notifications";

const KIND_ICON: Record<string, typeof Bell> = {
  request: Bell,
  quote: ScrollText,
  inspection: ShieldCheck,
  shipment: Ship,
  customer: Mail,
};

export function AdminBell({
  theme = "light",
}: {
  theme?: "light" | "dark";
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { items, unread, load, markRead, markAllRead } = useAdminNotifications();

  const handleMarkAllRead = () => {
    const anyUnread = items.some((item) => !item.read);
    if (!anyUnread) return;
    markAllRead();
    toast.success("All notifications marked as read");
  };

  // Close the dropdown on any outside pointerdown.
  useEffect(() => {
    const handler = (event: PointerEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", handler);
    return () => document.removeEventListener("pointerdown", handler);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen((value) => {
            if (!value) void load();
            return !value;
          });
        }}
        aria-label={
          unread > 0
            ? `Notifications, ${unread} unread`
            : "Notifications, all read"
        }
        aria-expanded={open}
        className={cn(
          "relative flex items-center justify-center rounded-md transition-colors",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/60",
          theme === "dark"
            ? "size-8 text-sand-400 hover:bg-white/5 hover:text-white"
            : "size-9 border border-sand-200 bg-white text-sand-500 shadow-sm hover:bg-sand-50 hover:text-sand-900",
        )}
      >
        <Bell aria-hidden className={theme === "dark" ? "size-4" : "size-5"} />
        {unread > 0 ? (
          <span
            className={cn(
              "absolute flex min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-bold tabular-nums",
              theme === "dark"
                ? "top-1 right-1 h-4 min-w-4 px-1 bg-white text-sand-900"
                : "-top-1 -right-1 h-4 min-w-4 px-1 bg-accent-600 text-white",
            )}
          >
            {unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label="Notifications"
          className="absolute right-0 z-40 mt-2 w-[min(22rem,calc(100vw-3rem))] overflow-hidden rounded-xl border border-sand-200 bg-white shadow-lg"
        >
          <div className="flex items-center justify-between gap-3 border-b border-sand-100 px-4 py-3">
            <p className="font-display text-sm font-semibold text-brand-900">
              Activity
            </p>
            {unread > 0 ? (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:text-brand-800"
              >
                <Check aria-hidden className="size-3.5" />
                Mark all read
              </button>
            ) : (
              <span className="text-xs text-sand-400">All caught up</span>
            )}
          </div>

          <ul className="flex max-h-80 flex-col overflow-y-auto">
            {items.length === 0 ? (
              <li className="px-4 py-6 text-center text-sm text-sand-500">
                No notifications yet.
              </li>
            ) : null}
            {items.map((item) => {
              const Icon = KIND_ICON[item.kind] ?? Bell;
              return (
                <li
                  key={item.id}
                  className="border-b border-sand-100 transition-colors last:border-b-0"
                >
                  <Link
                    href={item.href}
                    onClick={() => markRead(item.id)}
                    className="flex items-start gap-3 px-4 py-3 hover:bg-sand-50"
                  >
                    <span
                      aria-hidden
                      className={cn(
                        "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full",
                        item.read
                          ? "bg-sand-100 text-sand-500"
                          : "bg-brand-900 text-white",
                      )}
                    >
                      <Icon aria-hidden className="size-3.5" />
                    </span>
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span
                        className={cn(
                          "text-sm leading-snug",
                          item.read ? "text-sand-600" : "font-medium text-sand-900",
                        )}
                      >
                        {item.message}
                      </span>
                      <span className="text-[10px] text-sand-400">{item.time}</span>
                    </span>
                    {!item.read ? (
                      <span
                        aria-label="Unread"
                        className="mt-1.5 ml-auto size-2 shrink-0 rounded-full bg-accent-500"
                      />
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>

          <p className="border-t border-sand-100 px-4 py-2.5 text-right text-xs text-sand-400">
            <Link href="/admin/notifications" className="font-medium text-brand-700 hover:text-brand-800">
              View all activity →
            </Link>
          </p>
        </div>
      ) : null}
    </div>
  );
}