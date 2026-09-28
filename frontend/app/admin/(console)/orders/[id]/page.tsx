import Link from "next/link";
import { notFound } from "next/navigation";
import { Check, Circle, FileText, ShieldCheck, Ship as ShipIcon } from "lucide-react";
import type { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { Breadcrumbs } from "@/components/admin/breadcrumbs";
import { StatusPill } from "@/components/ui/status-pill";
import {
  formatUsd,
  orderTimelineFromStatus,
} from "@/lib/admin";
import { getAdminInspections, getAdminOrders, getAdminShipments } from "@/lib/data/admin";
import { cn } from "@/lib/utils";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const orders = await getAdminOrders();
  const order = orders.find((entry) => entry.id === id);
  return { title: order ? `${order.product} — ${id}` : "Order not found" };
}

function FinancialRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <dt className={strong ? "font-semibold text-sand-900" : "text-sand-500"}>{label}</dt>
      <dd
        className={cn(
          "tabular-nums",
          strong ? "font-semibold text-sand-950" : "text-sand-800",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [orders, inspections, shipments] = await Promise.all([
    getAdminOrders(),
    getAdminInspections(),
    getAdminShipments(),
  ]);
  const order = orders.find((entry) => entry.id === id);
  if (!order) notFound();

  const timeline = orderTimelineFromStatus(order.status);
  const inspection = inspections.find((entry) => entry.orderId === order.id);
  const shipment = shipments.find((entry) => entry.requestId === order.requestId);

  const subtotal = order.unitPriceUsd * order.quantity;
  const freight = Math.round(order.valueUsd * 0.06);
  const duties = Math.round(order.valueUsd * 0.08);
  const total = subtotal + freight + duties;
  const deposit = Math.round(total * 0.6);
  const balance = total - deposit;

  const documents: string[] = ["Purchase order", "Commercial invoice", "Packing list"];
  if (timeline.filter((entry) => entry.state === "done").length >= 3) {
    documents.push("Booking note");
  }
  if (inspection) {
    documents.push(
      inspection.status === "PENDING" ? "Inspection report (pending)" : "Inspection report",
    );
  }
  if (timeline.filter((entry) => entry.state === "done").length >= 5) {
    documents.push("Bill of lading");
  }
  if (order.status === "DELIVERED") {
    documents.push("Delivery note");
  }

  return (
    <div className="flex flex-col gap-6 px-6 py-8 lg:px-10">
      <Breadcrumbs
        crumbs={[{ label: "Orders", href: "/admin/orders" }, { label: order.id }]}
      />

      {/* Header */}
      <div className="flex flex-col gap-4 border-b border-sand-200 pb-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs font-semibold text-sand-500">{order.id}</span>
            <StatusPill status={order.status} variant="gray" />
          </div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-sand-950">
            {order.product}
          </h1>
          <p className="text-sm text-sand-500">
            {order.customer} · placed {order.date}
            {order.eta ? ` · ETA ${order.eta}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button intent="neutral-outline" asChild>
            <Link href={`/admin/requests/${order.requestId}`}>
              <FileText aria-hidden className="size-4" />
              View request
            </Link>
          </Button>
          {inspection ? (
            <Button intent="neutral-outline" asChild>
              <Link href={`/admin/inspections/${inspection.id}`}>
                <ShieldCheck aria-hidden className="size-4" />
                Inspection
              </Link>
            </Button>
          ) : null}
          {shipment ? (
            <Button intent="neutral-outline" asChild>
              <Link href={`/admin/shipments/${shipment.id}`}>
                <ShipIcon aria-hidden className="size-4" />
                Shipment
              </Link>
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="flex flex-col gap-6 xl:col-span-7">
          {/* Order information */}
          <section className="rounded-xl border border-sand-200 bg-white shadow-sm">
            <div className="border-b border-sand-200 px-5 py-4">
              <h2 className="font-display text-base font-semibold text-sand-950">
                Order information
              </h2>
            </div>
            <dl className="grid grid-cols-1 gap-x-6 gap-y-4 px-5 py-5 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-medium text-sand-500">Customer</dt>
                <dd className="mt-0.5 text-sm font-semibold text-sand-900">{order.customer}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-sand-500">Supplier</dt>
                <dd className="mt-0.5 text-sm text-sand-800">{order.supplier}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-sand-500">Product</dt>
                <dd className="mt-0.5 text-sm text-sand-900">{order.product}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-sand-500">Quantity</dt>
                <dd className="mt-0.5 text-sm font-semibold tabular-nums text-sand-900">
                  {order.quantity.toLocaleString()} units
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-sand-500">Unit price</dt>
                <dd className="mt-0.5 text-sm tabular-nums text-sand-800">
                  {formatUsd(order.unitPriceUsd, 2)}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-sand-500">Order value</dt>
                <dd className="mt-0.5 text-sm font-semibold tabular-nums text-sand-900">
                  {formatUsd(order.valueUsd)}
                </dd>
              </div>
            </dl>
          </section>

          {/* Financial summary */}
          <section className="rounded-xl border border-sand-200 bg-white shadow-sm">
            <div className="border-b border-sand-200 px-5 py-4">
              <h2 className="font-display text-base font-semibold text-sand-950">
                Financial summary
              </h2>
            </div>
            <dl className="flex flex-col gap-3 px-5 py-5">
              <FinancialRow label="Subtotal (goods)" value={formatUsd(subtotal)} />
              <FinancialRow label="Freight estimate" value={formatUsd(freight)} />
              <FinancialRow label="Duties & clearance" value={formatUsd(duties)} />
              <FinancialRow label="Total" value={formatUsd(total)} strong />
              <div className="my-1 border-t border-sand-100" />
              <FinancialRow label="Deposit paid (60%)" value={formatUsd(deposit)} />
              <FinancialRow label="Balance due" value={formatUsd(balance)} />
            </dl>
          </section>

          {/* Documents */}
          <section className="rounded-xl border border-sand-200 bg-white shadow-sm">
            <div className="border-b border-sand-200 px-5 py-4">
              <h2 className="font-display text-base font-semibold text-sand-950">Documents</h2>
            </div>
            <ul className="flex flex-col divide-y divide-sand-100">
              {documents.map((document) => (
                <li
                  key={document}
                  className="flex items-center justify-between gap-3 px-5 py-3 text-sm"
                >
                  <span className="flex items-center gap-2.5 font-medium text-sand-800">
                    <FileText aria-hidden className="size-4 text-sand-400" />
                    {document}
                  </span>
                  <span className="text-xs text-sand-400">PDF</span>
                </li>
              ))}
            </ul>
          </section>
        </div>

        {/* Right — timeline + links */}
        <div className="flex flex-col gap-6 xl:col-span-5">
          <section className="rounded-xl border border-sand-200 bg-white shadow-sm">
            <div className="border-b border-sand-200 px-5 py-4">
              <h2 className="font-display text-base font-semibold text-sand-950">
                Order timeline
              </h2>
            </div>
            <ol className="flex flex-col px-5 py-4">
              {timeline.map((stage, index) => {
                const isLast = index === timeline.length - 1;
                return (
                  <li key={stage.label} className="flex gap-3">
                    <span className="flex flex-col items-center">
                      {stage.state === "done" ? (
                        <Check aria-hidden className="size-5 shrink-0 text-sand-700" />
                      ) : stage.state === "active" ? (
                        <Circle aria-hidden className="size-5 shrink-0 text-sand-500" />
                      ) : (
                        <span aria-hidden className="size-2 shrink-0 rounded-full bg-sand-200 ring-4 ring-sand-100" />
                      )}
                      {!isLast ? <span className="w-px flex-1 bg-sand-200" /> : null}
                    </span>
                    <span
                      className={cn(
                        "pb-6 text-sm font-medium",
                        isLast && "pb-0",
                        stage.state === "pending" ? "text-sand-400" : "text-sand-900",
                      )}
                    >
                      {stage.label}
                    </span>
                  </li>
                );
              })}
            </ol>
          </section>

          {inspection ? (
            <Link
              href={`/admin/inspections/${inspection.id}`}
              className="flex flex-col gap-1 rounded-xl border border-sand-200 bg-white p-5 shadow-sm transition-colors hover:border-sand-300 hover:bg-sand-50"
            >
              <p className="flex items-center gap-2 text-sm font-semibold text-sand-900">
                <ShieldCheck aria-hidden className="size-4 text-sand-500" />
                Inspection · {inspection.id}
              </p>
              <p className="text-xs text-sand-500">
                {inspection.product} · {inspection.quantity.toLocaleString()} units ·{" "}
                {inspection.scheduledAt}
              </p>
              <StatusPill status={inspection.status} variant="gray" className="mt-2 w-fit" />
            </Link>
          ) : null}

          {shipment ? (
            <Link
              href={`/admin/shipments/${shipment.id}`}
              className="flex flex-col gap-1 rounded-xl border border-sand-200 bg-white p-5 shadow-sm transition-colors hover:border-sand-300 hover:bg-sand-50"
            >
              <p className="flex items-center gap-2 text-sm font-semibold text-sand-900">
                <ShipIcon aria-hidden className="size-4 text-sand-500" />
                Shipment · {shipment.id}
              </p>
              <p className="text-xs text-sand-500">
                {shipment.origin} → {shipment.destination} · {shipment.carrier}
              </p>
              <StatusPill status={shipment.status} variant="gray" className="mt-2 w-fit" />
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}