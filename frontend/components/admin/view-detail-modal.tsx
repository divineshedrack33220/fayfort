"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, ScrollText } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/dialog";
import { LightboxGallery, LightboxTrigger } from "@/components/ui/image-viewer";
import { StatusPill } from "@/components/ui/status-pill";
import {
  formatNaira,
  formatUsd,
  orderTimelineFromStatus,
  shipmentTimelineFromStatus,
  type AdminCustomer,
  type AdminInspection,
  type AdminOrder,
  type AdminQuote,
  type AdminRequestRow,
  type AdminShipment,
} from "@/lib/admin";
import { requestCustomerInfo, requestProductInfo } from "@/lib/admin-request-detail";
import { orderStatusMeta, requestStatusMeta, ORDER_STATUSES, REQUEST_STATUSES } from "@/lib/status";
import { cn } from "@/lib/utils";

/** Request payload surfaced by the backend admin detail endpoint. */
interface RequestDetailPayload {
  id: string;
  product: string;
  category: string;
  customer: string;
  city: string;
  quantity: number;
  budget: number;
  currency: string;
  status: string;
  date: string;
  contactPhone?: string;
  timeline?: { label: string; state: "done" | "active" | "pending" }[];
  imageUrls?: string[];
  quote?: AdminQuote;
}

export interface CustomerModalCounts {
  requests: number;
  activeOrders: number;
  completedOrders: number;
  orderValue: number;
  lastActivity: string;
}

export type ViewDetailRow =
  | { entity: "requests"; row: AdminRequestRow }
  | { entity: "quotes"; row: AdminQuote }
  | { entity: "customers"; row: AdminCustomer; counts: CustomerModalCounts }
  | { entity: "orders"; row: AdminOrder }
  | { entity: "shipments"; row: AdminShipment }
  | { entity: "inspections"; row: AdminInspection };

export type ViewDetailModalProps = ViewDetailRow & {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * Detail modal for the admin lists, rendered controlled by its caller.
 * Opens the record without navigating away; request status can be updated
 * inline where a workflow exists.
 */
export function ViewDetailModal(props: ViewDetailModalProps) {
  switch (props.entity) {
    case "requests":
      return <RequestModal row={props.row} open={props.open} onOpenChange={props.onOpenChange} />;
    case "quotes":
      return <QuoteModal row={props.row} open={props.open} onOpenChange={props.onOpenChange} />;
    case "customers":
      return (
        <CustomerModal
          row={props.row}
          counts={props.counts}
          open={props.open}
          onOpenChange={props.onOpenChange}
        />
      );
    case "orders":
      return <OrderModal row={props.row} open={props.open} onOpenChange={props.onOpenChange} />;
    case "shipments":
      return <ShipmentModal row={props.row} open={props.open} onOpenChange={props.onOpenChange} />;
    case "inspections":
      return <InspectionModal row={props.row} open={props.open} onOpenChange={props.onOpenChange} />;
  }
}

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-sand-200 bg-white">
      <div className="border-b border-sand-200 px-3.5 py-2.5">
        <h2 className="font-display text-sm font-semibold text-sand-950">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function Field({
  label,
  value,
  mono,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-medium text-sand-500">{label}</dt>
      <dd
        className={cn(
          "mt-0.5 text-sm [overflow-wrap:anywhere]",
          mono ? "font-mono text-xs font-medium text-sand-900" : "font-medium text-sand-900",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

function FieldGrid({ children }: { children: React.ReactNode }) {
  return (
    <dl className="grid grid-cols-[repeat(2,minmax(0,1fr))] gap-x-5 gap-y-3 px-4 py-3">
      {children}
    </dl>
  );
}

function Steps({
  steps,
}: {
  steps: { label: string; state: "done" | "active" | "pending" }[];
}) {
  return (
    <ol className="flex flex-col px-4 py-2.5">
      {steps.map((step, index) => {
        const isLast = index === steps.length - 1;
        return (
          <li key={step.label} className="flex gap-3">
            <span className="flex flex-col items-center">
              {step.state === "done" ? (
                <Check aria-hidden className="size-4 shrink-0 text-brand-700" />
              ) : step.state === "active" ? (
                <span
                  aria-hidden
                  className="mt-0.5 size-2.5 shrink-0 rounded-full bg-brand-600 ring-4 ring-brand-100"
                />
              ) : (
                <span
                  aria-hidden
                  className="mt-1 size-2 shrink-0 rounded-full bg-sand-200 ring-4 ring-sand-100"
                />
              )}
              {!isLast ? <span className="w-px flex-1 bg-sand-200" /> : null}
            </span>
            <span
              className={cn(
                "text-sm font-medium",
                !isLast && "pb-3",
                step.state === "pending" ? "text-sand-400" : "text-sand-900",
              )}
            >
              {step.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/** Horizontal status tracker: nodes joined by a line with labels underneath. */
function StepsLine({
  steps,
}: {
  steps: { label: string; state: "done" | "active" | "pending" }[];
}) {
  return (
    <ol className="flex items-start px-4 py-4">
      {steps.map((step, index) => {
        const isLast = index === steps.length - 1;
        return (
          <li key={step.label} className="flex flex-1 flex-col items-center">
            <div className="relative flex w-full items-center">
              {!isLast ? (
                <span
                  aria-hidden
                  className={cn(
                    "absolute top-1/2 right-[-50%] left-1/2 h-0.5 -translate-y-1/2",
                    step.state === "done" ? "bg-brand-300" : "bg-sand-200",
                  )}
                />
              ) : null}
              <span className="relative flex w-full justify-center">
                {step.state === "done" ? (
                  <span className="flex size-5 items-center justify-center rounded-full bg-brand-700 text-white ring-4 ring-sand-100">
                    <Check aria-hidden className="size-3" />
                  </span>
                ) : step.state === "active" ? (
                  <span className="size-3.5 rounded-full bg-brand-600 ring-4 ring-sand-100" />
                ) : (
                  <span className="size-3 rounded-full bg-sand-200 ring-4 ring-sand-100" />
                )}
              </span>
            </div>
            <span
              className={cn(
                "mt-2 text-center text-xs leading-tight",
                step.state === "pending" ? "text-sand-400" : "font-medium text-sand-900",
              )}
            >
              {step.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function MoneyRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <dt className={strong ? "font-semibold text-sand-900" : "text-sand-500"}>{label}</dt>
      <dd className={cn("tabular-nums", strong ? "font-semibold text-sand-950" : "text-sand-800")}>
        {value}
      </dd>
    </div>
  );
}

/** Inline request status stepper that persists through the backend. */
function AdvanceStatus({
  requestId,
  status,
  onChange,
}: {
  requestId: string;
  status: string;
  onChange: (status: string) => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const choices = (REQUEST_STATUSES as readonly string[]).filter((choice) => choice !== status);

  return (
    <div className="flex flex-wrap gap-1.5">
      {choices.map((choice) => (
        <button
          key={choice}
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              const response = await fetch(
                `/api/backend/admin/requests/${encodeURIComponent(requestId)}/status`,
                {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ status: choice }),
                },
              );
              if (!response.ok) throw new Error("Request failed");
              onChange(choice);
              toast.success(`${requestId} moved to ${requestStatusMeta(choice).label}`);
              router.refresh();
            } catch {
              toast.error(`Could not update ${requestId}`);
            } finally {
              setBusy(false);
            }
          }}
          className="rounded-md border border-sand-200 bg-white px-2.5 py-1 text-xs font-medium text-sand-600 transition-colors hover:border-brand-300 hover:text-brand-800 disabled:opacity-50"
        >
          {requestStatusMeta(choice).label}
        </button>
      ))}
    </div>
  );
}

function RequestModal({
  row,
  open,
  onOpenChange,
}: {
  row: AdminRequestRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [detail, setDetail] = useState<RequestDetailPayload | null>(null);
  const [status, setStatus] = useState<string>(row.status);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!open || loaded) return;
    let active = true;
    (async () => {
      try {
        const response = await fetch(
          `/api/backend/admin/requests/${encodeURIComponent(row.id)}`,
        );
        if (!response.ok) throw new Error("not ok");
        const payload = (await response.json()) as { request?: RequestDetailPayload };
        if (active && payload.request) {
          setDetail(payload.request);
          setStatus(payload.request.status);
        }
      } catch {
        /* keep the row-level view available if the detail fetch hiccups */
      } finally {
        if (active) setLoaded(true);
      }
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const source: AdminRequestRow = (detail ?? row) as AdminRequestRow;
  const customer = requestCustomerInfo(source);
  const product = requestProductInfo(source);
  const quote = detail?.quote;
  const timeline = detail?.timeline ?? [];

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="xl"
      title={row.product}
      description={`${row.id} · ${row.customer} · received ${row.date}`}
    >
      <div className="flex flex-col gap-3">
        {!loaded && !detail ? (
          <div className="flex flex-col items-center gap-3 py-10 text-sand-400">
              <ScrollText aria-hidden className="size-6 animate-pulse" />
              <span className="text-sm">Loading request…</span>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-sand-200 bg-sand-50/60 px-3 py-2.5">
                <StatusPill status={status} variant="gray" />
                <span className="text-xs text-sand-500">
                  {requestStatusMeta(status).description}
                </span>
                <span className="ml-auto flex flex-wrap items-center gap-2">
                  <Button intent="neutral-outline" size="sm" asChild>
                    <Link
                      href={
                        quote
                          ? `/admin/quotes?q=${encodeURIComponent(row.id)}`
                          : `/admin/quotes/new?requestId=${encodeURIComponent(row.id)}`
                      }
                    >
                      <ScrollText aria-hidden className="size-4" />
                      {quote ? "Quote issued" : "Create quote"}
                    </Link>
                  </Button>
                  <Button intent="neutral" size="sm" asChild>
                    <Link href={`/admin/requests/${row.id}`}>
                      Open full record
                      <ArrowRight aria-hidden className="size-4" />
                    </Link>
                  </Button>
                </span>
              </div>

              <div className="flex flex-col gap-1.5 rounded-lg border border-dashed border-sand-200 bg-white px-3 py-2.5">
                <span className="text-[11px] font-semibold tracking-widest text-sand-400 uppercase">
                  Set stage — optional
                </span>
                <p className="text-xs leading-snug text-sand-500">
                  The flow moves on its own: issuing a quote marks this request as quoted, and accepting it approves
                  the request and opens the order. Use this only for corrections.
                </p>
                <AdvanceStatus requestId={row.id} status={status} onChange={setStatus} />
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <DetailSection title="Product & specifications">
                  {detail?.imageUrls && detail.imageUrls.length > 0 ? (
                    <LightboxGallery
                      items={detail.imageUrls.filter(Boolean).map((url) => ({
                        url,
                        alt: `Reference photo for ${row.product}`,
                      }))}
                      label={`Reference photos for ${row.product}`}
                      caption={row.product}
                      className="flex flex-wrap gap-2 px-4 pt-3"
                      triggerClassName="block"
                      imageClassName="max-h-20 w-auto rounded-lg border border-sand-200 object-cover"
                    />
                  ) : null}
                  <FieldGrid>
                    <Field label="Category" value={product.category} />
                    <Field label="Quantity" value={`${product.quantity.toLocaleString()} units`} />
                    <Field label="Budget" value={formatNaira(product.budget)} />
                    <Field label="Destination" value={product.destination} />
                  </FieldGrid>
                </DetailSection>

                <DetailSection title="Customer">
                  <FieldGrid>
                    <Field label="Customer" value={customer.name} />
                    <Field label="Email" value={customer.email} />
                    <Field label="Phone" value={detail?.contactPhone || customer.phone} />
                    <Field label="Previous requests" value={customer.previousRequests} />
                  </FieldGrid>
                  <p className="border-t border-sand-100 px-4 py-2.5 text-xs leading-relaxed text-sand-600">
                    {customer.notes}
                  </p>
                </DetailSection>

                {quote ? (
                  <DetailSection title="Quote on file">
                    <FieldGrid>
                      <Field label="Quote ref" value={quote.id} mono />
                      <Field label="Supplier" value={quote.supplier} />
                      <Field label="Value" value={formatUsd(quote.valueUsd)} />
                      <Field label="Status" value={<StatusPill status={quote.status} variant="gray" />} />
                      <Field label="Issued" value={quote.issuedAt} />
                      <Field label="Expires" value={quote.expiresAt} />
                    </FieldGrid>
                  </DetailSection>
                ) : null}

                <DetailSection title="Timeline">
                  {timeline.length > 0 ? (
                    <StepsLine steps={timeline} />
                  ) : (
                    <p className="px-4 py-4 text-sm text-sand-500">
                      Timeline will populate as the request moves forward.
                    </p>
                  )}
                </DetailSection>
              </div>
            </>
          )}
        </div>
      </Modal>
  );
}

function QuoteModal({
  row,
  open,
  onOpenChange,
}: {
  row: AdminQuote;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const images = row.imageUrls?.filter(Boolean) ?? [];
  const image = images[0];
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title={row.product}
      description={`${row.id} · request ${row.requestId}`}
    >
      <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3">
            {image ? (
              <LightboxTrigger
                items={(images ?? [image]).filter(Boolean).map((url) => ({
                  url,
                  alt: `Product image for ${row.product}`,
                }))}
                label={`View images for ${row.product}`}
                caption={row.product}
                imageClassName="size-12 rounded-lg border border-sand-200 object-cover"
              />
            ) : null}
            <StatusPill status={row.status} variant="gray" />
            <span className="text-xs text-sand-500">issued {row.issuedAt}</span>
          </div>
          <DetailSection title="Quote details">
            <FieldGrid>
              <Field label="Customer" value={row.customer} />
              <Field label="Supplier" value={row.supplier} />
              <Field label="Value" value={formatUsd(row.valueUsd)} />
              <Field label="Margin" value={`${row.marginBps / 100}%`} />
              <Field label="Expires" value={row.expiresAt} />
            </FieldGrid>
          </DetailSection>
          <div className="flex justify-end gap-2">
            <Button intent="neutral-outline" size="sm" asChild>
              <Link href={`/admin/requests/${row.requestId}`}>Open sourcing request</Link>
            </Button>
          </div>
        </div>
      </Modal>
  );
}

function CustomerModal({
  row,
  counts,
  open,
  onOpenChange,
}: {
  row: AdminCustomer;
  counts: CustomerModalCounts;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const initials = row.name
    .split(" ")
    .map((part) => part.charAt(0))
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const kpis: { label: string; value: React.ReactNode }[] = [
    { label: "Requests", value: counts.requests },
    { label: "Active orders", value: counts.activeOrders },
    { label: "Completed", value: counts.completedOrders },
    { label: "Order value", value: formatUsd(counts.orderValue) },
  ];
  return (
    <Modal open={open} onOpenChange={onOpenChange} size="lg" title={row.name} description={row.id}>
      <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <span
              aria-hidden
              className="flex size-10 shrink-0 items-center justify-center rounded-full bg-sand-100 font-display text-xs font-semibold text-sand-700 ring-1 ring-sand-200"
            >
              {initials}
            </span>
            <div className="flex min-w-0 flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="truncate text-sm font-semibold text-sand-900">
                  {row.company ?? row.name}
                </p>
                <StatusPill status={row.status} variant="gray" />
              </div>
              <p className="truncate text-xs text-sand-500">{row.email}</p>
            </div>
          </div>

          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {kpis.map((kpi) => (
              <div key={kpi.label} className="rounded-lg border border-sand-200 bg-sand-50/50 px-3 py-2.5">
                <dt className="text-[11px] font-medium text-sand-500">{kpi.label}</dt>
                <dd className="mt-0.5 text-sm font-semibold tabular-nums text-sand-900">
                  {kpi.value}
                </dd>
              </div>
            ))}
          </dl>

          <DetailSection title="Account">
            <FieldGrid>
              <Field label="City" value={row.city} />
              <Field label="Currency" value={row.currency} />
              <Field label="Joined" value={row.joined} />
              <Field label="Last activity" value={counts.lastActivity} />
            </FieldGrid>
          </DetailSection>

          <div className="flex justify-end gap-2">
            <Button intent="neutral-outline" size="sm" asChild>
              <Link href={`/admin/customers/${row.id}`}>
                Open full record
                <ArrowRight aria-hidden className="size-4" />
              </Link>
            </Button>
          </div>
        </div>
      </Modal>
  );
}

function OrderModal({
  row,
  open,
  onOpenChange,
}: {
  row: AdminOrder;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<string>(row.status);
  const [busy, setBusy] = useState(false);
  const subtotal = row.unitPriceUsd * row.quantity;
  const freight = Math.round(row.valueUsd * 0.06);
  const duties = Math.round(row.valueUsd * 0.08);
  const total = subtotal + freight + duties;
  const deposit = Math.round(total * 0.6);
  const balance = total - deposit;
  const timeline = orderTimelineFromStatus(status as AdminOrder["status"]);
  const stages = ORDER_STATUSES as readonly string[];
  const isFinal = status === stages[stages.length - 1];
  const nextStage = isFinal ? null : stages[stages.indexOf(status) + 1] ?? null;

  const advance = async () => {
    setBusy(true);
    try {
      const response = await fetch(
        `/api/backend/admin/orders/${encodeURIComponent(row.id)}/advance`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" },
      );
      if (!response.ok) throw new Error("Request failed");
      const payload = await response.json();
      const next = payload.order?.status;
      if (!next) throw new Error("Bad response");
      setStatus(next);
      toast.success(`${row.id} is now ${orderStatusMeta(next).label}`);
      router.refresh();
    } catch {
      toast.error(`Could not advance ${row.id}`);
    } finally {
      setBusy(false);
    }
  };

  const setStage = async (choice: string) => {
    if (choice === status) return;
    setBusy(true);
    try {
      const response = await fetch(
        `/api/backend/admin/orders/${encodeURIComponent(row.id)}/status`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: choice }),
        },
      );
      if (!response.ok) throw new Error("Request failed");
      const payload = await response.json();
      setStatus(payload.order.status);
      toast.success(`${row.id} stage set to ${orderStatusMeta(choice).label}`);
      router.refresh();
    } catch {
      toast.error(`Could not set stage for ${row.id}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title={row.product}
      description={`${row.id} · ${row.customer} · placed ${row.date}`}
    >
      <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <StatusPill status={status} variant="gray" />
            <span className="text-xs text-sand-500">{row.eta ? `ETA ${row.eta}` : ""}</span>
          </div>
          <div className="grid grid-cols-1 gap-x-5 gap-y-4 rounded-xl border border-sand-200 bg-white p-4 sm:grid-cols-2 xl:grid-cols-4">
            <Field label="Customer" value={row.customer} />
            <Field label="Supplier" value={row.supplier} />
            <Field label="Quantity" value={`${row.quantity.toLocaleString()} units`} />
            <Field label="Unit price" value={formatUsd(row.unitPriceUsd, 2)} />
          </div>
          <DetailSection title="Order flow">
            <StepsLine steps={timeline} />
            {nextStage ? (
              <p className="border-t border-sand-100 px-4 py-2.5 text-xs text-sand-500">
                Up next: <span className="font-medium text-brand-700">{orderStatusMeta(nextStage).label}</span> — confirm
                the current stage to roll the order forward automatically.
              </p>
            ) : null}
          </DetailSection>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <DetailSection title="Financial summary">
              <dl className="flex flex-col gap-2.5 px-4 py-3.5">
                <MoneyRow label="Subtotal (goods)" value={formatUsd(subtotal)} />
                <MoneyRow label="Freight estimate" value={formatUsd(freight)} />
                <MoneyRow label="Duties & clearance" value={formatUsd(duties)} />
                <MoneyRow label="Total" value={formatUsd(total)} strong />
                <div className="my-1 border-t border-sand-100" />
                <MoneyRow label="Deposit paid (60%)" value={formatUsd(deposit)} />
                <MoneyRow label="Balance due" value={formatUsd(balance)} />
              </dl>
            </DetailSection>
            <DetailSection title="Stage control">
              <div className="flex flex-col gap-3 px-4 py-4">
                {isFinal ? (
                  <p className="rounded-lg bg-sand-100/70 px-3 py-2 text-sm text-sand-600">
                    This order is delivered — nothing left to confirm.
                  </p>
                ) : (
                  <div className="flex flex-col items-start gap-2">
                    <p className="text-sm leading-snug text-sand-600">
                      Confirm <span className="font-medium text-sand-900">{orderStatusMeta(status).label}</span> and{" "}
                      {nextStage ? (
                        <>
                          <span className="font-medium text-brand-700">{orderStatusMeta(nextStage).label}</span>{" "}
                          begins automatically.
                        </>
                      ) : (
                        "finish the order."
                      )}
                    </p>
                    <Button intent="accent" size="sm" onClick={advance} disabled={busy} className="w-fit">
                      <Check aria-hidden className="size-4" />
                      Confirm & continue
                    </Button>
                  </div>
                )}
                <label className="flex flex-col gap-1.5">
                  <span className="text-[11px] font-semibold tracking-widest text-sand-500 uppercase">
                    Set stage directly (optional)
                  </span>
                  <select
                    value={status}
                    disabled={busy}
                    onChange={(event) => setStage(event.target.value)}
                    className="rounded-md border border-sand-300 bg-white px-3 py-1.5 text-sm text-sand-900 focus:border-brand-500 focus:outline-none disabled:opacity-50"
                  >
                    {stages.map((stage) => (
                      <option key={stage} value={stage}>
                        {orderStatusMeta(stage).label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </DetailSection>
          </div>
          <div className="flex justify-end gap-2">
            <Button intent="neutral-outline" size="sm" asChild>
              <Link href={`/admin/orders/${row.id}`}>
                Open full record
                <ArrowRight aria-hidden className="size-4" />
              </Link>
            </Button>
          </div>
        </div>
      </Modal>
  );
}

function ShipmentModal({
  row,
  open,
  onOpenChange,
}: {
  row: AdminShipment;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const stages = shipmentTimelineFromStatus(row.status);
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title={row.product}
      description={`${row.id} · order ${row.requestId} · ${row.customer}`}
    >
      <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <StatusPill status={row.status} variant="gray" />
          </div>
          <div className="flex items-center gap-3">
            <div className="flex min-w-0 flex-1 flex-col gap-0.5 rounded-lg bg-sand-100/70 px-3 py-2">
              <span className="text-[11px] text-sand-400">Origin</span>
              <span className="truncate text-sm font-medium text-sand-900">{row.origin}</span>
            </div>
            <ArrowRight aria-hidden className="size-4 shrink-0 text-sand-400" />
            <div className="flex min-w-0 flex-1 flex-col gap-0.5 rounded-lg bg-sand-100/70 px-3 py-2">
              <span className="text-[11px] text-sand-400">Destination</span>
              <span className="truncate text-sm font-medium text-sand-900">{row.destination}</span>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <DetailSection title="Tracking">
              <FieldGrid>
                <Field label="Container" value={row.containerRef} mono />
                <Field label="Carrier" value={row.carrier} />
                <Field label="Mode" value={row.mode} />
                <Field label="Departed" value={row.departedAt ?? "Not yet"} />
                <Field label="ETA" value={row.eta ?? "—"} />
                <Field label="Delivered" value={row.deliveredAt ?? "—"} />
              </FieldGrid>
            </DetailSection>
            <DetailSection title="Milestones">
              <Steps steps={stages} />
            </DetailSection>
          </div>
          <div className="flex justify-end gap-2">
            <Button intent="neutral-outline" size="sm" asChild>
              <Link href={`/admin/shipments/${row.id}`}>
                Open full record
                <ArrowRight aria-hidden className="size-4" />
              </Link>
            </Button>
          </div>
        </div>
      </Modal>
  );
}

function InspectionModal({
  row,
  open,
  onOpenChange,
}: {
  row: AdminInspection;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title={row.product}
      description={`${row.id} · order ${row.orderId}`}
    >
      <div className="flex flex-col gap-3">
        <StatusPill status={row.status} variant="gray" />
        <DetailSection title="Inspection record">
          <FieldGrid>
            <Field label="Order" value={row.orderId} mono />
            <Field label="Customer" value={row.customer} />
            <Field label="Supplier" value={row.supplier} />
            <Field label="Quantity" value={`${row.quantity.toLocaleString()} units`} />
            <Field label="Scheduled" value={row.scheduledAt} />
            <Field label="Inspector" value={row.inspector} />
          </FieldGrid>
          {row.notes ? (
            <div className="border-t border-sand-100 px-4 py-3">
              <dt className="text-[11px] font-medium text-sand-500">Notes</dt>
              <dd className="mt-0.5 text-sm leading-relaxed text-sand-700">{row.notes}</dd>
            </div>
          ) : null}
        </DetailSection>
        <div className="flex justify-end gap-2">
          <Button intent="neutral-outline" size="sm" asChild>
            <Link href={`/admin/inspections/${row.id}`}>
              Open full record
              <ArrowRight aria-hidden className="size-4" />
            </Link>
          </Button>
        </div>
      </div>
    </Modal>
  );
}