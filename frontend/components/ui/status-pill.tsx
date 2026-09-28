import * as React from "react";
import { cn } from "@/lib/utils";
import {
  CUSTOMER_STATUSES,
  customerStatusMeta,
  INSPECTION_STATUSES,
  inspectionStatusMeta,
  ORDER_STATUSES,
  orderStatusMeta,
  QUOTE_STATUSES,
  quoteStatusMeta,
  REQUEST_STATUSES,
  requestStatusMeta,
  SHIPMENT_STATUSES,
  shipmentStatusMeta,
  SUPPLIER_STATUSES,
  supplierStatusMeta,
  SUPPORT_THREAD_STATUSES,
  supportThreadStatusMeta,
  toneClasses,
  type Tone,
} from "@/lib/status";

export interface StatusPillProps extends React.ComponentPropsWithRef<"span"> {
  /** A domain status string from the shared vocabulary. */
  status: string;
  /** "gray" renders every status in a muted, desaturated tint (used across the staff console). */
  variant?: "default" | "gray";
}

/**
 * Status indicator for a domain status value.
 * Resolves the tone + human label from the shared status vocabulary,
 * falling back to a neutral pill for unknown values.
 */
export const StatusPill = React.forwardRef<HTMLSpanElement, StatusPillProps>(function StatusPill(
  { status, variant, className, ...props },
  ref,
) {
  void variant;
  const meta = (REQUEST_STATUSES as readonly string[]).includes(status)
    ? requestStatusMeta(status)
    : (QUOTE_STATUSES as readonly string[]).includes(status)
      ? quoteStatusMeta(status)
      : (CUSTOMER_STATUSES as readonly string[]).includes(status)
        ? customerStatusMeta(status)
        : (SUPPLIER_STATUSES as readonly string[]).includes(status)
          ? supplierStatusMeta(status)
          : (SHIPMENT_STATUSES as readonly string[]).includes(status)
            ? shipmentStatusMeta(status)
            : (SUPPORT_THREAD_STATUSES as readonly string[]).includes(status)
                ? supportThreadStatusMeta(status)
                : (ORDER_STATUSES as readonly string[]).includes(status)
                  ? orderStatusMeta(status)
                  : (INSPECTION_STATUSES as readonly string[]).includes(status)
                    ? inspectionStatusMeta(status)
                    : quoteStatusMeta(status);
  const tone: Tone = meta.tone ?? "neutral";

  return (
    <span
      ref={ref}
      className={cn(
        "inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs font-medium",
        toneClasses[tone].badge,
        className,
      )}
      {...props}
    >
      <span
        aria-hidden
        className={cn("size-1.5 rounded-full", toneClasses[tone].dot)}
      />
      {meta.label}
    </span>
  );
});
