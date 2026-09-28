"use client";

import Link from "next/link";
import { useState } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "@/components/ui/toast";
import { PushNotificationToggle } from "@/components/pwa/push-notification-toggle";
import type { NotificationItem } from "@/lib/notifications";
import { cn } from "@/lib/utils";

export function NotificationsInbox({ initialItems }: { initialItems: NotificationItem[] }) {
  const [items, setItems] = useState<NotificationItem[]>(initialItems);
  const unread = items.filter((item) => !item.read).length;

  const toggleRead = (id: string) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const next = { ...item, read: !item.read };
        if (next.read) {
          void fetch(`/api/backend/portal/notifications/${encodeURIComponent(id)}/read`, {
            method: "POST",
          });
        }
        return next;
      }),
    );
  };

  const openRequest = (id: string) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, read: true } : item)));
    void fetch(`/api/backend/portal/notifications/${encodeURIComponent(id)}/read`, {
      method: "POST",
    });
  };

  const handleMarkAllRead = () => {
    setItems((prev) =>
      prev.map((item) => ({ ...item, read: true })),
    );
    toast.success("All notifications marked as read");
    void fetch("/api/backend/portal/notifications/read", { method: "POST" });
  };

  return (
    <div className="container-shell flex flex-col gap-5 py-6 sm:gap-6 sm:py-10">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-2xl font-semibold tracking-tight text-brand-900 sm:text-4xl">
            Notifications
          </h1>
          <p className="text-sm text-sand-500 sm:text-base">
            {unread > 0
              ? `You have ${unread} unread update${unread === 1 ? "" : "s"} from the Fayfort team.`
              : "You’re all caught up — we’ll only ping you when something changes."}
          </p>
        </div>
        {unread > 0 ? (
          <Button
            intent="outline"
            size="sm"
            className="w-full sm:w-fit"
            onClick={handleMarkAllRead}
          >
            <Check aria-hidden className="size-4" />
            Mark all read
          </Button>
        ) : null}
      </div>

      <PushNotificationToggle />

      {items.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center text-sm text-sand-500">
            No notifications yet.
          </CardContent>
        </Card>
      ) : (
        // One tile per update on phones, two to three across on wider screens.
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3">
          {items.map((item) => (
            <li
              key={item.id}
              className={cn(
                "flex h-full flex-col gap-3 rounded-xl border bg-white p-4 shadow-card transition-shadow hover:shadow-card-hover sm:p-5",
                item.read ? "border-sand-200" : "border-accent-200 ring-1 ring-accent-200/60",
              )}
            >
              <div className="flex items-start gap-3">
                <button
                  type="button"
                  onClick={() => toggleRead(item.id)}
                  aria-label={item.read ? "Mark as unread" : "Mark as read"}
                  aria-pressed={!item.read}
                  className={cn(
                    "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border transition-colors",
                    "focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/60",
                    item.read
                      ? "border-sand-300 text-transparent hover:border-brand-300"
                      : "border-accent-500 bg-accent-500 text-white",
                  )}
                >
                  {item.read ? <Check aria-hidden className="size-3.5" /> : null}
                </button>

                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <p
                    className={cn(
                      "text-sm",
                      item.read
                        ? "font-medium text-sand-700"
                        : "font-semibold text-brand-900",
                    )}
                  >
                    {item.title}
                  </p>
                  <p className="text-xs text-sand-400">{item.at}</p>
                </div>
              </div>

              <p className="text-sm leading-relaxed text-sand-500">{item.body}</p>

              {item.requestId ? (
                <Link
                  href={`/dashboard/${item.requestId}`}
                  onClick={() => openRequest(item.id)}
                  className="mt-auto inline-flex min-h-11 items-center justify-center gap-1 rounded-lg bg-sand-50 px-3 py-2 text-sm font-medium text-brand-700 ring-1 ring-sand-100 transition-colors hover:bg-brand-50 hover:text-brand-800"
                >
                  View request
                  <span aria-hidden className="inline-block">
                    →
                  </span>
                </Link>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
