"use client";

import * as React from "react";
import Link from "next/link";
import {
  Bell,
  Check,
  CheckCheck,
  Mail,
  ScrollText,
  Ship,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { PushNotificationToggle } from "@/components/pwa/push-notification-toggle";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface NotificationItem {
  id: string;
  kind: "request" | "quote" | "inspection" | "shipment" | "customer";
  message: string;
  time: string;
  read: boolean;
  href: string;
}

const KIND_ICON: Record<NotificationItem["kind"], typeof Bell> = {
  request: Bell,
  quote: ScrollText,
  inspection: ShieldCheck,
  shipment: Ship,
  customer: Mail,
};

const KIND_LABEL: Record<NotificationItem["kind"], string> = {
  request: "Request",
  quote: "Quote",
  inspection: "Inspection",
  shipment: "Shipment",
  customer: "Customer",
};

export function NotificationsCentre({ items }: { items: NotificationItem[] }) {
  const [state, setState] = React.useState<NotificationItem[]>(items);
  const unread = state.filter((item) => !item.read).length;

  const markRead = (id: string) => {
    setState((prev) => prev.map((item) => (item.id === id ? { ...item, read: true } : item)));
    void fetch(`/api/backend/admin/notifications/${encodeURIComponent(id)}/read`, {
      method: "POST",
    });
  };

  const markAllRead = () => {
    setState((prev) => prev.map((item) => ({ ...item, read: true })));
    toast.success("All notifications marked as read");
    void fetch("/api/backend/admin/notifications/read", { method: "POST" });
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 border-b border-sand-200 pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-2xl font-semibold tracking-tight text-sand-950">
            Activity
          </h1>
          <p className="text-sm text-sand-500">
            {unread} unread notification{unread === 1 ? "" : "s"} across requests, quotes,
            inspections, customers and shipments.
          </p>
        </div>
        <Button intent="neutral-outline" onClick={markAllRead} disabled={unread === 0}>
          <CheckCheck aria-hidden className="size-4" />
          Mark all as read
        </Button>
      </div>

      <PushNotificationToggle />

      {state.length > 0 ? (
        <ul className="flex flex-col divide-y divide-sand-100 rounded-xl border border-sand-200 bg-white shadow-sm">
          {state.map((item) => {
            const Icon = KIND_ICON[item.kind];
            return (
              <li key={item.id} className={cn("flex items-start gap-4 px-5 py-4")}>
                <span
                  className={cn(
                    "flex size-9 shrink-0 items-center justify-center rounded-full ring-1",
                    item.read
                      ? "bg-sand-100 text-sand-500 ring-sand-200"
                      : "bg-sand-900 text-white ring-sand-900",
                  )}
                >
                  <Icon aria-hidden className="size-4" />
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <p className="text-xs font-semibold tracking-wide text-sand-400 uppercase">
                    {KIND_LABEL[item.kind]}
                  </p>
                  <p
                    className={cn(
                      "text-sm leading-relaxed",
                      item.read ? "text-sand-600" : "font-medium text-sand-900",
                    )}
                  >
                    {item.message}
                  </p>
                  <p className="text-xs text-sand-400">{item.time}</p>
                </div>
                {!item.read ? (
                  <span
                    aria-label="Unread"
                    className="mt-1.5 flex size-2 shrink-0 rounded-full bg-sand-900"
                  />
                ) : null}
                <div className="flex shrink-0 items-center gap-2">
                  <Link
                    href={item.href}
                    onClick={() => markRead(item.id)}
                    className="inline-flex items-center gap-1 rounded-md border border-sand-200 bg-white px-2.5 py-1 text-xs font-medium text-sand-700 shadow-sm transition-colors hover:bg-sand-50"
                  >
                    Open
                  </Link>
                  {!item.read ? (
                    <button
                      type="button"
                      onClick={() => markRead(item.id)}
                      aria-label="Mark as read"
                      className="flex size-7 items-center justify-center rounded-md border border-sand-200 bg-white text-sand-500 shadow-sm transition-colors hover:bg-sand-50 hover:text-sand-900"
                    >
                      <Check aria-hidden className="size-3.5" />
                    </button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-sand-300 bg-white px-6 py-14 text-center">
          <Bell aria-hidden className="size-6 text-sand-300" />
          <p className="text-sm font-medium text-sand-800">You&apos;re all caught up</p>
          <p className="text-sm text-sand-500">
            New activity will surface here as requests, quotes and shipments move.
          </p>
        </div>
      )}
    </div>
  );
}