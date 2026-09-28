/**
 * Admin (staff console) types + pure helpers.
 *
 * The console is fully served by the Go backend via /api/backend (see
 * lib/data/admin.ts). This module only keeps the shared interfaces and
 * status-derived helpers used by the UI; the prototype fixture datasets
 * that used to live here were removed.
 */
import {
  INSPECTION_STATUSES,
  INSPECTION_STATUS_META,
  ORDER_STATUSES,
  ORDER_STATUS_META,
  SHIPMENT_STATUSES,
  SHIPMENT_STATUS_META,
  SUPPLIER_STATUSES,
  SUPPLIER_STATUS_META,
  SUPPORT_THREAD_STATUSES,
  SUPPORT_THREAD_STATUS_META,
  type CustomerStatus,
  type InspectionStatus,
  type OrderStatus,
  type QuoteStatus,
  type RequestStatus,
  type ShipmentStatus,
  type SupplierStatus,
  type SupportThreadStatus,
  type Tone,
} from "@/lib/status";
import type { ChatAttachment } from "@/lib/chat-types";

/* ------------------------------------------------------------------ */
/* Seeded staff credentials (dev/bootstrap reference only)             */
/* ------------------------------------------------------------------ */

export const STAFF_CREDENTIALS = {
  email: "admin@fayfort.com",
  password: "admin123",
  name: "Ada Okafor",
};

/* ------------------------------------------------------------------ */
/* Customers                                                           */
/* ------------------------------------------------------------------ */

export interface AdminCustomer {
  id: string;
  name: string;
  email: string;
  company?: string;
  city: string;
  currency: string;
  requests: number;
  pipelineValue: number;
  joined: string;
  status: CustomerStatus;
}

/* ------------------------------------------------------------------ */
/* Suppliers                                                           */
/* ------------------------------------------------------------------ */

export interface AdminSupplier {
  id: string;
  name: string;
  city: string;
  country: string;
  category: string;
  /** 0–100 reliability score from performance reviews. */
  reliability: number;
  /** Typical lead time from PO to container ready. */
  leadDays: string;
  /** Minimum order quantity, as quoted to the buyer. */
  moq: string;
  /** Who Fayfort deals with at the factory. */
  contactEmail: string;
  contactPhone: string;
  paymentTerms: string;
  /** Product lines the factory specialises in. */
  products: string[];
  /** Internal sourcing team notes. */
  notes: string;
  requests: number;
  since: string;
  status: SupplierStatus;
}

export type VerificationStatus = "VERIFIED" | "PENDING" | "FAILED";

export interface VerificationItem {
  label: string;
  status: VerificationStatus;
}

/**
 * Verification checklist shown on the supplier record. Status is derived
 * from the supplier's overall verification state so the record stays
 * consistent with the directory.
 */
export function supplierVerification(supplier: AdminSupplier): VerificationItem[] {
  const labels = [
    "Business info",
    "Factory / warehouse",
    "Product samples",
    "Previous transactions",
    "Inspection records",
  ];
  const all: VerificationStatus[] =
    supplier.status === "VERIFIED"
      ? labels.map(() => "VERIFIED" as const)
      : supplier.status === "AT_RISK"
        ? (["VERIFIED", "FAILED", "VERIFIED", "VERIFIED", "FAILED"] as VerificationStatus[])
        : (["VERIFIED", "VERIFIED", "PENDING", "PENDING", "PENDING"] as VerificationStatus[]);
  return labels.map((label, index) => ({ label, status: all[index] }));
}

/* ------------------------------------------------------------------ */
/* Shipments                                                           */
/* ------------------------------------------------------------------ */

export interface AdminShipment {
  id: string;
  requestId: string;
  product: string;
  customer: string;
  supplier: string;
  carrier: string;
  mode: "FCL" | "LCL" | "Air";
  origin: string;
  destination: string;
  containerRef: string;
  departedAt?: string;
  eta?: string;
  deliveredAt?: string;
  status: ShipmentStatus;
}

export type ShipmentStage = {
  label: string;
  state: "done" | "active" | "pending";
};

export const SHIPMENT_PHASES = [
  "Warehouse",
  "Dispatched",
  "In transit",
  "Arrived",
  "Customs",
  "Out for delivery",
  "Delivered",
] as const;

export function shipmentTimelineFromStatus(status: ShipmentStatus): ShipmentStage[] {
  const done: Record<ShipmentStatus, number> = {
    BOOKED: 0,
    IN_TRANSIT: 2,
    CUSTOMS: 4,
    DELAYED: 2,
    DELIVERED: 6,
  };
  const index = done[status];
  const last = SHIPMENT_PHASES.length - 1;
  return SHIPMENT_PHASES.map((label, i) => ({
    label,
    state: i < index ? "done" : i === index ? (index === last ? "done" : "active") : "pending",
  }));
}

/* ------------------------------------------------------------------ */
/* Support threads                                                      */
/* ------------------------------------------------------------------ */

export interface AdminThreadMessage {
  id: string;
  from: "customer" | "staff";
  author: string;
  text: string;
  at: string;
  attachments?: ChatAttachment[];
}

export interface AdminThread {
  id: string;
  customer: string;
  email: string;
  subject: string;
  ref: string;
  unread: number;
  status: SupportThreadStatus;
  lastActive: string;
  messages: AdminThreadMessage[];
}

/* ------------------------------------------------------------------ */
/* Quotes                                                              */
/* ------------------------------------------------------------------ */

export interface AdminQuote {
  id: string;
  requestId: string;
  product: string;
  customer: string;
  supplier: string;
  valueUsd: number;
  marginBps: number;
  status: QuoteStatus;
  issuedAt: string;
  expiresAt: string;
  imageUrls?: string[];
}

/* ------------------------------------------------------------------ */
/* Activity feed                                                       */
/* ------------------------------------------------------------------ */

export interface AdminActivity {
  id: string;
  actor: string;
  action: string;
  target?: string;
  requestId?: string;
  at: string;
  tone: Tone;
}

/* ------------------------------------------------------------------ */
/* Derived dashboard metrics                                           */
/* ------------------------------------------------------------------ */

export interface AdminKpi {
  label: string;
  value: string;
  delta: number;
  hint: string;
}

/** Requests by status, for the pipeline chart. */
export type StatusCount = { status: RequestStatus; count: number };

/** Week-to-date requests, oldest → newest, for the trend chart. */
export interface DayCount {
  day: string;
  count: number;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

export function formatNaira(value: number): string {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatUsd(value: number, fractionDigits = 0): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: fractionDigits,
    minimumFractionDigits: fractionDigits,
  }).format(value);
}

/* ------------------------------------------------------------------ */
/* Admin request queue (richer than the customer card list)            */
/* ------------------------------------------------------------------ */

export interface AdminRequestRow {
  id: string;
  product: string;
  category: string;
  customer: string;
  city: string;
  quantity: number;
  budget: number;
  currency: string;
  status: RequestStatus;
  date: string;
  imageUrls?: string[];
}

/* ------------------------------------------------------------------ */
/* Orders                                                              */
/* ------------------------------------------------------------------ */

export interface AdminOrder {
  id: string;
  requestId: string;
  customer: string;
  product: string;
  supplier: string;
  quantity: number;
  unitPriceUsd: number;
  valueUsd: number;
  status: OrderStatus;
  date: string;
  eta?: string;
}

export type OrderStage = {
  label: string;
  state: "done" | "active" | "pending";
};

export const ORDER_PHASES = [
  "Payment",
  "Purchasing",
  "Supplier processing",
  "Inspection",
  "Warehouse",
  "Shipping",
  "Delivered",
] as const;

export function orderTimelineFromStatus(status: OrderStatus): OrderStage[] {
  const index: Record<OrderStatus, number> = {
    PAYMENT: 0,
    PURCHASING: 1,
    SUPPLIER_PROCESSING: 2,
    INSPECTION: 3,
    WAREHOUSE: 4,
    SHIPPING: 5,
    DELIVERED: 6,
  };
  const activeAt = index[status];
  const last = ORDER_PHASES.length - 1;
  return ORDER_PHASES.map((label, i) => ({
    label,
    state:
      i < activeAt ? "done" : i === activeAt ? (activeAt === last ? "done" : "active") : "pending",
  }));
}

/* ------------------------------------------------------------------ */
/* Inspections                                                         */
/* ------------------------------------------------------------------ */

export interface AdminInspection {
  id: string;
  orderId: string;
  customer: string;
  supplier: string;
  product: string;
  quantity: number;
  status: InspectionStatus;
  scheduledAt: string;
  inspector: string;
  notes?: string;
}

export const INSPECTION_CHECKLIST = [
  { key: "quantity", label: "Quantity confirmed", intro: "Count matches PO and packing list." },
  { key: "quality", label: "Product quality", intro: "Material, finish and workmanship check." },
  { key: "packaging", label: "Packaging", intro: "Fit for retail and transit." },
  { key: "defects", label: "Defects", intro: "Visible damage, stains or broken units." },
  { key: "spec", label: "Specification match", intro: "Matches the agreed spec sheet." },
  { key: "photos", label: "Photos", intro: "Good light, both sides + close-ups." },
  { key: "videos", label: "Videos", intro: "Short clips of moving/stress points." },
] as const;

/* ------------------------------------------------------------------ */
/* Notifications (staff centre)                                        */
/* ------------------------------------------------------------------ */

export interface AdminNotification {
  id: string;
  kind: "request" | "quote" | "inspection" | "shipment" | "customer";
  message: string;
  time: string;
  read: boolean;
  href: string;
}

/* ------------------------------------------------------------------ */
/* Pipeline + analytics                                                */
/* ------------------------------------------------------------------ */

export interface PipelineStage {
  key: string;
  label: string;
  count: number;
  statuses: RequestStatus[];
}

const PIPELINE_STAGE_DEFS: Array<{ key: string; label: string; statuses: RequestStatus[] }> = [
  { key: "SUBMITTED", label: "Submitted", statuses: ["SUBMITTED"] },
  { key: "UNDER_REVIEW", label: "Under review", statuses: ["UNDER_REVIEW"] },
  { key: "SUPPLIER_SEARCH", label: "Supplier search", statuses: ["SUPPLIER_SEARCH"] },
  { key: "QUOTE_PREPARED", label: "Quote prepared", statuses: ["QUOTE_READY"] },
  { key: "CUSTOMER_APPROVED", label: "Customer approved", statuses: ["CUSTOMER_APPROVAL"] },
  { key: "PURCHASING", label: "Purchasing", statuses: ["APPROVED", "IN_PROGRESS"] },
  { key: "INSPECTION", label: "Inspection", statuses: ["CONVERTED"] },
  { key: "SHIPPING", label: "Shipping", statuses: ["COMPLETED"] },
  { key: "DELIVERED", label: "Delivered", statuses: ["CLOSED"] },
];

/** Request-status mapping for a pipeline stage. */
export function pipelineStageStatuses(stageKey: string): RequestStatus[] {
  return PIPELINE_STAGE_DEFS.find((def) => def.key === stageKey)?.statuses ?? [];
}

/** Human-readable label for a pipeline stage key. */
export function pipelineStageLabel(stageKey: string): string | undefined {
  return PIPELINE_STAGE_DEFS.find((def) => def.key === stageKey)?.label;
}

export interface MonthCount {
  month: string;
  count: number;
}

export {
  INSPECTION_STATUS_META,
  INSPECTION_STATUSES,
  ORDER_STATUSES,
  ORDER_STATUS_META,
  SHIPMENT_STATUSES,
  SHIPMENT_STATUS_META,
  SUPPORT_THREAD_STATUSES,
  SUPPORT_THREAD_STATUS_META,
  SUPPLIER_STATUS_META,
  SUPPLIER_STATUSES,
};