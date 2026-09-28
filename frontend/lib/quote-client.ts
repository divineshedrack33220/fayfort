import type { QuoteStatus, RequestStatus } from "@/lib/status";

/**
 * Customer-facing quote record, matching the payload served by
 * GET /api/portal/quotes on the backend. Kept in a client-safe module so
 * both the server data loader and interactive portal components can share it.
 */
export interface PortalQuote {
  id: string;
  requestId: string;
  product: string;
  supplier: string;
  valueUsd: number;
  marginBps: number;
  status: QuoteStatus;
  issuedAt: string;
  expiresAt: string;
  decidedAt?: string;
  decisionReason?: string;
  imageUrls?: string[];
  requestStatus: RequestStatus;
  quantity: number;
  budget: number;
}

/** Record a customer's approve/decline on a quote (proxy -> backend). */
export async function postQuoteDecision(
  requestId: string,
  decision: "APPROVED" | "DECLINED",
  reason = "",
): Promise<PortalQuote> {
  const res = await fetch(
    `/api/backend/portal/quotes/${encodeURIComponent(requestId)}/decision`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision, reason }),
    },
  );
  const payload = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    quote?: PortalQuote;
    error?: string;
  };
  if (!res.ok || !payload.ok) {
    throw new Error(payload.error ?? "Could not record your decision");
  }
  if (!payload.quote) {
    throw new Error("Could not record your decision");
  }
  return normalizeQuote(payload.quote);
}

/** Fresh list of the signed-in customer's quotes (no server cache). */
export async function getPortalQuotesClient(): Promise<PortalQuote[]> {
  const res = await fetch("/api/backend/portal/quotes", { cache: "no-store" });
  const payload = (await res.json().catch(() => ({}))) as {
    quotes?: PortalQuote[];
  };
  return (payload.quotes ?? []).map(normalizeQuote);
}

const VALID_STATUSES: PortalQuote["status"][] = [
  "DRAFT",
  "SENT",
  "PENDING",
  "APPROVED",
  "DECLINED",
  "EXPIRED",
];

/**
 * Guards a quote payload so a missing or malformed field can never crash the
 * UI. The backend always sends the full shape, but this keeps the portal
 * resilient to stale caches and partial responses.
 */
export function normalizeQuote(raw: Partial<PortalQuote> | null | undefined): PortalQuote {
  const status = VALID_STATUSES.includes((raw?.status ?? "") as PortalQuote["status"])
    ? (raw!.status as PortalQuote["status"])
    : "PENDING";
  return {
    id: raw?.id ?? "",
    requestId: raw?.requestId ?? "",
    product: raw?.product ?? "Product",
    supplier: raw?.supplier ?? "Supplier",
    valueUsd: typeof raw?.valueUsd === "number" ? raw.valueUsd : 0,
    marginBps: typeof raw?.marginBps === "number" ? raw.marginBps : 0,
    status,
    issuedAt: raw?.issuedAt ?? "",
    expiresAt: raw?.expiresAt ?? "",
    decidedAt: raw?.decidedAt,
    decisionReason: raw?.decisionReason,
    imageUrls: Array.isArray(raw?.imageUrls) ? raw.imageUrls!.filter(Boolean) : undefined,
    requestStatus: raw?.requestStatus ?? "SUBMITTED",
    quantity: typeof raw?.quantity === "number" ? raw.quantity : 0,
    budget: typeof raw?.budget === "number" ? raw.budget : 0,
  };
}