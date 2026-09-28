import {
  Footprints,
  Headphones,
  Shirt,
  ShoppingBag,
  Watch,
  type LucideIcon,
} from "lucide-react";
import {
  REQUEST_STATUSES,
  type RequestStatus,
} from "@/lib/status";

export type TimelineStage = {
  label: "Submitted" | "Quote" | "Approved" | "Shipped";
  state: "done" | "active" | "pending";
};

export interface SampleRequest {
  id: string;
  product: string;
  icon: LucideIcon;
  quantity: number;
  budget: number;
  status: RequestStatus;
  date: string;
}

/**
 * Reference dataset used to exercise the portal list and progress helpers in
 * tests and local development. Live requests are read from the sourcing
 * backend; this module is never wired into the running portal.
 */
export const SAMPLE_REQUESTS: SampleRequest[] = [
  {
    id: "REQ-1047",
    product: "Wireless Headphones",
    icon: Headphones,
    quantity: 500,
    budget: 3_000_000,
    status: "UNDER_REVIEW",
    date: "Sep 22, 2026",
  },
  {
    id: "REQ-1036",
    product: "Handbags",
    icon: ShoppingBag,
    quantity: 300,
    budget: 2_000_000,
    status: "QUOTE_READY",
    date: "Sep 18, 2026",
  },
  {
    id: "REQ-1030",
    product: "Sneakers",
    icon: Footprints,
    quantity: 1_000,
    budget: 4_000_000,
    status: "CONVERTED",
    date: "Sep 10, 2026",
  },
  {
    id: "REQ-1024",
    product: "Smart Watches",
    icon: Watch,
    quantity: 200,
    budget: 1_500_000,
    status: "CONVERTED",
    date: "Sep 16, 2026",
  },
  {
    id: "REQ-1011",
    product: "Men’s T-Shirts",
    icon: Shirt,
    quantity: 500,
    budget: 2_500_000,
    status: "CLOSED",
    date: "Aug 28, 2026",
  },
];

/**
 * Collapse a request status into a 4-step progress line so the portal can
 * render a concrete "where are we" indicator without a timeline table.
 */
export function timelineFromStatus(status: RequestStatus): TimelineStage[] {
  const stages: Omit<TimelineStage, "state">[] = [
    { label: "Submitted" },
    { label: "Quote" },
    { label: "Approved" },
    { label: "Shipped" },
  ];

  const orderOf = (current: RequestStatus): number => {
    switch (current) {
      case "CANCELLED":
      case "SUBMITTED":
        return 0;
      case "UNDER_REVIEW":
      case "SUPPLIER_SEARCH":
      case "QUOTE_READY":
        return 1;
      case "CUSTOMER_APPROVAL":
        return 2;
      case "APPROVED":
      case "CONVERTED":
      case "IN_PROGRESS":
        return 3;
      case "COMPLETED":
      case "CLOSED":
        return 4;
    }
  };

  const active = orderOf(status);
  return stages.map((stage, index) => ({
    ...stage,
    state: index < active ? "done" : index === active ? "active" : "pending",
  }));
}

/** Every sample status is part of the real vocabulary (no invented states). */
export function assertSampleStatuses(requests: SampleRequest[]): void {
  for (const request of requests) {
    if (!(REQUEST_STATUSES as readonly string[]).includes(request.status)) {
      throw new Error(`Unknown sample status: ${request.status}`);
    }
  }
}