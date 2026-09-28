/**
 * Central status vocabulary for the domain.
 *
 * Tones are the semantic layer between domain statuses and visuals:
 * domain code and components refer to a small set of tones, so restyling
 * the product never touches business logic, and status styling stays
 * consistent across badges, pills, tables and timelines.
 */

export type Tone = "neutral" | "brand" | "info" | "success" | "warning" | "danger" | "accent";

export const toneClasses: Record<Tone, { badge: string; dot: string }> = {
  neutral: {
    badge: "bg-sand-100 text-sand-700 ring-sand-300/70",
    dot: "bg-sand-400",
  },
  brand: {
    badge: "bg-brand-50 text-brand-700 ring-brand-200",
    dot: "bg-brand-500",
  },
  info: {
    badge: "bg-info-50 text-info-700 ring-info-300/70",
    dot: "bg-info-500",
  },
  success: {
    badge: "bg-success-50 text-success-700 ring-success-300/70",
    dot: "bg-success-500",
  },
  warning: {
    badge: "bg-warning-50 text-warning-800 ring-warning-300/70",
    dot: "bg-warning-500",
  },
  danger: {
    badge: "bg-danger-50 text-danger-700 ring-danger-300/70",
    dot: "bg-danger-500",
  },
  accent: {
    badge: "bg-accent-50 text-accent-800 ring-accent-300/70",
    dot: "bg-accent-500",
  },
};

/* ------------------------------------------------------------------ */
/* Sourcing request statuses                                           */
/* ------------------------------------------------------------------ */

export const REQUEST_STATUSES = [
  "SUBMITTED",
  "UNDER_REVIEW",
  "SUPPLIER_SEARCH",
  "QUOTE_READY",
  "CUSTOMER_APPROVAL",
  "APPROVED",
  "IN_PROGRESS",
  "CONVERTED",
  "COMPLETED",
  "CLOSED",
  "CANCELLED",
] as const;

export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export const REQUEST_STATUS_META: Record<
  RequestStatus,
  { label: string; tone: Tone; description: string }
> = {
  SUBMITTED: {
    label: "Submitted",
    tone: "neutral",
    description: "Request received. Fayfort will review shortly.",
  },
  UNDER_REVIEW: {
    label: "In Review",
    tone: "brand",
    description: "Fayfort is reviewing the product and requirements.",
  },
  SUPPLIER_SEARCH: {
    label: "Supplier search",
    tone: "info",
    description: "Fayfort is researching suppliers for this product.",
  },
  QUOTE_READY: {
    label: "Quoted",
    tone: "accent",
    description: "A quote is ready for you to review.",
  },
  CUSTOMER_APPROVAL: {
    label: "Awaiting your approval",
    tone: "warning",
    description: "Please review and approve or decline the quote.",
  },
  APPROVED: {
    label: "Approved",
    tone: "success",
    description: "Quote approved. Fayfort is preparing next steps.",
  },
  IN_PROGRESS: {
    label: "In progress",
    tone: "info",
    description: "Your sourcing is actively being executed.",
  },
  CONVERTED: {
    label: "Converted",
    tone: "success",
    description: "Sourcing confirmed — this request has become a verified order.",
  },
  COMPLETED: {
    label: "Completed",
    tone: "success",
    description: "This sourcing request has been completed.",
  },
  CLOSED: {
    label: "Closed",
    tone: "neutral",
    description: "This request is closed with no further action.",
  },
  CANCELLED: {
    label: "Cancelled",
    tone: "neutral",
    description: "This request was cancelled.",
  },
};

export function requestStatusMeta(status: string): {
  label: string;
  tone: Tone;
  description: string;
} {
  return (
    REQUEST_STATUS_META[status as RequestStatus] ?? {
      label: status,
      tone: "neutral",
      description: "",
    }
  );
}

/* ------------------------------------------------------------------ */
/* Quote statuses                                                      */
/* ------------------------------------------------------------------ */

export const QUOTE_STATUSES = [
  "DRAFT",
  "SENT",
  "PENDING",
  "APPROVED",
  "DECLINED",
  "EXPIRED",
] as const;

export type QuoteStatus = (typeof QUOTE_STATUSES)[number];

export const QUOTE_STATUS_META: Record<QuoteStatus, { label: string; tone: Tone }> = {
  DRAFT: { label: "Draft", tone: "neutral" },
  SENT: { label: "Sent", tone: "info" },
  PENDING: { label: "Pending approval", tone: "warning" },
  APPROVED: { label: "Approved", tone: "success" },
  DECLINED: { label: "Declined", tone: "danger" },
  EXPIRED: { label: "Expired", tone: "neutral" },
};

export function quoteStatusMeta(status: string): {
  label: string;
  tone: Tone;
} {
  return (
    QUOTE_STATUS_META[status as QuoteStatus] ?? {
      label: status,
      tone: "neutral",
    }
  );
}

/* ------------------------------------------------------------------ */
/* Customer account statuses                                           */
/* ------------------------------------------------------------------ */

export const CUSTOMER_STATUSES = ["NEW", "ACTIVE", "AT_RISK"] as const;

export type CustomerStatus = (typeof CUSTOMER_STATUSES)[number];

export const CUSTOMER_STATUS_META: Record<CustomerStatus, { label: string; tone: Tone }> = {
  NEW: { label: "New", tone: "info" },
  ACTIVE: { label: "Active", tone: "success" },
  AT_RISK: { label: "At risk", tone: "warning" },
};

export function customerStatusMeta(status: string): {
  label: string;
  tone: Tone;
} {
  return (
    CUSTOMER_STATUS_META[status as CustomerStatus] ?? {
      label: status,
      tone: "neutral",
    }
  );
}

/* ------------------------------------------------------------------ */
/* Supplier verification statuses                                      */
/* ------------------------------------------------------------------ */

export const SUPPLIER_STATUSES = ["VERIFIED", "PENDING", "AT_RISK"] as const;

export type SupplierStatus = (typeof SUPPLIER_STATUSES)[number];

export const SUPPLIER_STATUS_META: Record<SupplierStatus, { label: string; tone: Tone }> = {
  VERIFIED: { label: "Verified", tone: "success" },
  PENDING: { label: "Pending", tone: "info" },
  AT_RISK: { label: "At risk", tone: "warning" },
};

export function supplierStatusMeta(status: string): {
  label: string;
  tone: Tone;
} {
  return (
    SUPPLIER_STATUS_META[status as SupplierStatus] ?? {
      label: status,
      tone: "neutral",
    }
  );
}

/* ------------------------------------------------------------------ */
/* Shipment statuses                                                   */
/* ------------------------------------------------------------------ */

export const SHIPMENT_STATUSES = [
  "BOOKED",
  "IN_TRANSIT",
  "CUSTOMS",
  "DELAYED",
  "DELIVERED",
] as const;

export type ShipmentStatus = (typeof SHIPMENT_STATUSES)[number];

export const SHIPMENT_STATUS_META: Record<
  ShipmentStatus,
  { label: string; tone: Tone }
> = {
  BOOKED: { label: "Booked", tone: "info" },
  IN_TRANSIT: { label: "In transit", tone: "info" },
  CUSTOMS: { label: "Customs clearance", tone: "warning" },
  DELAYED: { label: "Delayed", tone: "danger" },
  DELIVERED: { label: "Delivered", tone: "success" },
};

export function shipmentStatusMeta(status: string): {
  label: string;
  tone: Tone;
} {
  return (
    SHIPMENT_STATUS_META[status as ShipmentStatus] ?? {
      label: status,
      tone: "neutral",
    }
  );
}

/* ------------------------------------------------------------------ */
/* Support thread statuses                                             */
/* ------------------------------------------------------------------ */

export const SUPPORT_THREAD_STATUSES = ["OPEN", "NEEDS_REPLY", "RESOLVED"] as const;

export type SupportThreadStatus = (typeof SUPPORT_THREAD_STATUSES)[number];

export const SUPPORT_THREAD_STATUS_META: Record<
  SupportThreadStatus,
  { label: string; tone: Tone }
> = {
  OPEN: { label: "Open", tone: "info" },
  NEEDS_REPLY: { label: "Needs reply", tone: "danger" },
  RESOLVED: { label: "Resolved", tone: "success" },
};

export function supportThreadStatusMeta(status: string): {
  label: string;
  tone: Tone;
} {
  return (
    SUPPORT_THREAD_STATUS_META[status as SupportThreadStatus] ?? {
      label: status,
      tone: "neutral",
    }
  );
}

/* ------------------------------------------------------------------ */
/* Order statuses                                                      */
/* ------------------------------------------------------------------ */

export const ORDER_STATUSES = [
  "PAYMENT",
  "PURCHASING",
  "SUPPLIER_PROCESSING",
  "INSPECTION",
  "WAREHOUSE",
  "SHIPPING",
  "DELIVERED",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_STATUS_META: Record<OrderStatus, { label: string; tone: Tone }> = {
  PAYMENT: { label: "Payment", tone: "brand" },
  PURCHASING: { label: "Purchasing", tone: "info" },
  SUPPLIER_PROCESSING: { label: "Supplier processing", tone: "info" },
  INSPECTION: { label: "Inspection", tone: "warning" },
  WAREHOUSE: { label: "Warehouse", tone: "neutral" },
  SHIPPING: { label: "Shipping", tone: "info" },
  DELIVERED: { label: "Delivered", tone: "success" },
};

export function orderStatusMeta(status: string): {
  label: string;
  tone: Tone;
} {
  return (
    ORDER_STATUS_META[status as OrderStatus] ?? {
      label: status,
      tone: "neutral",
    }
  );
}

/* ------------------------------------------------------------------ */
/* Inspection statuses                                                 */
/* ------------------------------------------------------------------ */

export const INSPECTION_STATUSES = [
  "PENDING",
  "IN_PROGRESS",
  "PASSED",
  "ISSUES",
  "COMPLETED",
] as const;

export type InspectionStatus = (typeof INSPECTION_STATUSES)[number];

export const INSPECTION_STATUS_META: Record<
  InspectionStatus,
  { label: string; tone: Tone }
> = {
  PENDING: { label: "Pending", tone: "neutral" },
  IN_PROGRESS: { label: "In progress", tone: "brand" },
  PASSED: { label: "Passed", tone: "success" },
  ISSUES: { label: "Issues found", tone: "danger" },
  COMPLETED: { label: "Completed", tone: "success" },
};

export function inspectionStatusMeta(status: string): {
  label: string;
  tone: Tone;
} {
  return (
    INSPECTION_STATUS_META[status as InspectionStatus] ?? {
      label: status,
      tone: "neutral",
    }
  );
}
