import "server-only";

import { cache } from "react";
import { backend, backendOrNull, backendQuery } from "@/lib/backend";
import type { ChatAttachment } from "@/lib/chat-types";
import type {
  AdminActivity,
  AdminCustomer,
  AdminInspection,
  AdminNotification,
  AdminOrder,
  AdminQuote,
  AdminRequestRow,
  AdminShipment,
  AdminSupplier,
  AdminThread,
  AdminKpi,
  PipelineStage,
  StatusCount,
  DayCount,
  MonthCount,
} from "@/lib/admin";

/**
 * Typed server-side access to the admin console data (served by the Go
 * backend via /api/backend or direct calls). Read calls are cached per
 * render; mutations are never cached.
 */

export interface DashboardData {
  kpis: AdminKpi[];
  pipeline: PipelineStage[];
  statusCounts: StatusCount[];
  requestsThisWeek: DayCount[];
  ordersByMonth: MonthCount[];
  topRequestedProducts: { product: string; count: number; valueUsd: number }[];
  topCustomers: { name: string; value: number }[];
  topSuppliers: { name: string; orders: number; reliability: number }[];
  activity: AdminActivity[];
  activeOrders: number;
  conversionRate: number;
  pendingActions: number;
}

export const getAdminDashboard = cache(async (): Promise<DashboardData | null> =>
  backendOrNull<DashboardData>("/api/admin/dashboard"),
);

type RequestFilters = { q?: string; status?: string };

export const getAdminRequests = cache(
  async (filters: RequestFilters = {}): Promise<AdminRequestRow[]> => {
    const payload = await backendOrNull<{ requests: AdminRequestRow[] }>(
      backendQuery("/api/admin/requests", {
        ...(filters.q ? { q: filters.q } : {}),
        ...(filters.status ? { status: filters.status } : {}),
      }),
    );
    return payload?.requests ?? [];
  },
);

export interface PortalTimelineStage {
  label: "Submitted" | "Quote" | "Approved" | "Shipped";
  state: "done" | "active" | "pending";
}

export interface RequestDetail {
  id: string;
  product: string;
  category: string;
  customer: string;
  city: string;
  quantity: number;
  budget: number;
  currency: string;
  status: AdminRequestRow["status"];
  date: string;
  contactPhone?: string;
  timeline: PortalTimelineStage[];
  imageUrls?: string[];
  quote?: AdminQuote;
  activity: AdminActivity[];
}

export async function getRequestById(id: string): Promise<RequestDetail | null> {
  const payload = await backendOrNull<{ request: RequestDetail }>(
    `/api/admin/requests/${encodeURIComponent(id)}`,
  );
  return payload?.request ?? null;
}

export async function updateRequestStatus(id: string, status: string): Promise<void> {
  const payload = await backend<{ ok: boolean }>(`/api/admin/requests/${encodeURIComponent(id)}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  if (!payload.ok) throw new Error("Backend could not update the request status");
}

export async function issueQuote(
  requestId: string,
  fields: { supplier?: string; valueUsd: number; marginBps?: number; status?: string; imageUrls?: string[] },
): Promise<AdminQuote> {
  const payload = await backend<{ ok: boolean; quote: AdminQuote }>(
    `/api/admin/requests/${encodeURIComponent(requestId)}/quote`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fields),
    },
  );
  if (!payload.ok || !payload.quote) throw new Error("Backend could not issue the quote");
  return payload.quote;
}

export const getAdminQuotes = cache(async (): Promise<AdminQuote[]> => {
  const payload = await backendOrNull<{ quotes: AdminQuote[] }>("/api/admin/quotes");
  return payload?.quotes ?? [];
});

export const getAdminOrders = cache(async (): Promise<AdminOrder[]> => {
  const payload = await backendOrNull<{ orders: AdminOrder[] }>("/api/admin/orders");
  return payload?.orders ?? [];
});

export const getAdminShipments = cache(async (): Promise<AdminShipment[]> => {
  const payload = await backendOrNull<{ shipments: AdminShipment[] }>("/api/admin/shipments");
  return payload?.shipments ?? [];
});

export const getAdminInspections = cache(async (): Promise<AdminInspection[]> => {
  const payload = await backendOrNull<{ inspections: AdminInspection[] }>("/api/admin/inspections");
  return payload?.inspections ?? [];
});

export const getAdminCustomers = cache(async (): Promise<AdminCustomer[]> => {
  const payload = await backendOrNull<{ customers: AdminCustomer[] }>("/api/admin/customers");
  return payload?.customers ?? [];
});

export const getAdminSuppliers = cache(async (): Promise<AdminSupplier[]> => {
  const payload = await backendOrNull<{ suppliers: AdminSupplier[] }>("/api/admin/suppliers");
  return payload?.suppliers ?? [];
});

export const getAdminThreads = cache(async (): Promise<AdminThread[]> => {
  const payload = await backendOrNull<{ threads: AdminThread[] }>("/api/admin/messages");
  return payload?.threads ?? [];
});

export async function replyToThread(
  threadId: string,
  text: string,
  attachments?: ChatAttachment[],
): Promise<AdminThread> {
  const payload = await backend<{ ok: boolean; thread: AdminThread }>(
    `/api/admin/messages/${encodeURIComponent(threadId)}/reply`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, attachments }),
    },
  );
  if (!payload.ok || !payload.thread) throw new Error("Backend could not send the reply");
  return payload.thread;
}

export const getAdminNotifications = cache(
  async (): Promise<{ notifications: AdminNotification[]; unread: number } | null> =>
    backendOrNull("/api/admin/notifications"),
);

export async function markAdminNotificationsRead(): Promise<void> {
  await backend<{ ok: boolean }>("/api/admin/notifications/read", { method: "POST" });
}

export interface AnalyticsData {
  ordersByMonth: MonthCount[];
  topRequestedProducts: { product: string; count: number; valueUsd: number }[];
  topCustomers: { name: string; value: number }[];
  topSuppliers: { name: string; orders: number; reliability: number }[];
  conversionRate: number;
  activeOrders: number;
}

export const getAdminAnalytics = cache(async (): Promise<AnalyticsData | null> =>
  backendOrNull<AnalyticsData>("/api/admin/analytics"),
);

export const getAdminActivity = cache(async (): Promise<AdminActivity[]> => {
  const payload = await backendOrNull<{ activity: AdminActivity[] }>("/api/admin/activity");
  return payload?.activity ?? [];
});

export interface SearchEntry {
  kind: string;
  title: string;
  subtitle: string;
  href: string;
}

export const getSearchEntries = cache(
  async (query = ""): Promise<SearchEntry[]> => {
    const payload = await backendOrNull<{ results: SearchEntry[] }>(
      backendQuery("/api/admin/search", { q: query }),
    );
    return payload?.results ?? [];
  },
);

export const getAdminSettings = cache(async () => backendOrNull<{ demo: boolean }>("/api/admin/settings"));