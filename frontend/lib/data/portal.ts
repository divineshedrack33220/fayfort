import "server-only";

import { cache } from "react";
import { backend, backendOrNull } from "@/lib/backend";
import type { TimelineStage } from "@/lib/requests-sample";
import type { NotificationItem } from "@/lib/notifications";
import { normalizeQuote, type PortalQuote } from "@/lib/quote-client";
import type { RequestStatus } from "@/lib/status";
import type { ChatAttachment } from "@/lib/chat-types";

/**
 * Typed server-side access to the customer portal data (served by the Go
 * backend). Read calls are cached per render; see the proxy route for the
 * client-side equivalent used by the interactive portal components.
 */

export interface PortalRequestRow {
  id: string;
  product: string;
  quantity: number;
  budget: number;
  status: RequestStatus;
  date: string;
  timeline: TimelineStage[];
  imageUrls?: string[];
  quoteImageUrls?: string[];
}

export interface PortalOverview {
  activeRequests: number;
  quotesReady: number;
  totalRequests: number;
  unreadNotifications: number;
}

export interface PortalThread {
  id: string;
  customer: string;
  email: string;
  subject: string;
  ref: string;
  unread: number;
  status: string;
  lastActive: string;
  messages: {
    id: string;
    from: string;
    author: string;
    text: string;
    at: string;
    attachments?: ChatAttachment[];
  }[];
}

export interface PortalProfile {
  id: string;
  name: string;
  email: string;
  role: string;
  city?: string;
  company?: string;
  currency?: string;
  joined?: string;
  customerId?: string;
}

export const getPortalOverview = cache(async (): Promise<PortalOverview | null> => {
  const payload = await backendOrNull<{ summary: PortalOverview }>("/api/portal/overview");
  return payload?.summary ?? null;
});

export const getPortalRequests = cache(async (): Promise<PortalRequestRow[]> => {
  const payload = await backendOrNull<{ requests: PortalRequestRow[] }>("/api/portal/requests");
  return payload?.requests ?? [];
});

export { type PortalQuote };
export const getPortalQuotes = cache(async (): Promise<PortalQuote[]> => {
  const payload = await backendOrNull<{ quotes: PortalQuote[] }>("/api/portal/quotes");
  return (payload?.quotes ?? []).map(normalizeQuote);
});

export const getPortalNotifications = cache(
  async (): Promise<{ notifications: NotificationItem[]; unread: number } | null> =>
    backendOrNull("/api/portal/notifications"),
);

export const getPortalProfile = cache(async (): Promise<PortalProfile | null> => {
  const payload = await backendOrNull<{ profile: PortalProfile }>("/api/portal/profile");
  return payload?.profile ?? null;
});

export const getPortalThread = cache(async (): Promise<PortalThread | null> => {
  const payload = await backendOrNull<{ thread: PortalThread }>("/api/portal/thread");
  return payload?.thread ?? null;
});

/** Server-side helper used by mutating flows that must never be cached. */
export async function postPortalThreadMessage(
  text: string,
  attachments?: ChatAttachment[],
): Promise<PortalThread> {
  const payload = await backend<{ ok: boolean; thread: PortalThread }>("/api/portal/thread", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, attachments }),
  });
  if (!payload.ok || !payload.thread) throw new Error("Backend could not send the message");
  return payload.thread;
}