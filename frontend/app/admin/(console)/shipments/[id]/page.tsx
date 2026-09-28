import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Check, FileText, Ship } from "lucide-react";
import type { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { Breadcrumbs } from "@/components/admin/breadcrumbs";
import { StatusPill } from "@/components/ui/status-pill";
import { shipmentTimelineFromStatus } from "@/lib/admin";
import { getAdminRequests, getAdminShipments } from "@/lib/data/admin";
import { cn } from "@/lib/utils";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const shipments = await getAdminShipments();
  const shipment = shipments.find((entry) => entry.id === id);
  return {
    title: shipment ? `${shipment.product} — ${id}` : "Shipment not found",
  };
}

const SHIPMENT_DOCUMENTS = [
  "Commercial invoice",
  "Bill of lading",
  "Certificate of origin",
  "Packing list",
];

export default async function AdminShipmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [shipments, requests] = await Promise.all([
    getAdminShipments(),
    getAdminRequests(),
  ]);
  const shipment = shipments.find((entry) => entry.id === id);
  if (!shipment) notFound();

  const request = requests.find((row) => row.id === shipment.requestId);
  const stages = shipmentTimelineFromStatus(shipment.status);

  return (
    <div className="flex flex-col gap-6 px-6 py-8 lg:px-10">
      <Breadcrumbs
        crumbs={[{ label: "Shipments", href: "/admin/shipments" }, { label: shipment.id }]}
      />

      <div className="flex flex-col gap-4 border-b border-sand-200 pb-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs font-semibold text-sand-500">{shipment.id}</span>
            <StatusPill status={shipment.status} variant="gray" />
          </div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-sand-950">
            {shipment.product}
          </h1>
          <p className="text-sm text-sand-500">
            Moving on behalf of {shipment.customer} · via {shipment.supplier}
          </p>
        </div>
        {request ? (
          <Button intent="neutral-outline" asChild>
            <Link href={`/admin/requests/${request.id}`}>
              <ArrowLeft aria-hidden className="size-4 rotate-180" />
              View source request
            </Link>
          </Button>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="flex flex-col gap-6 xl:col-span-7">
          {/* Route */}
          <section className="rounded-xl border border-sand-200 bg-white shadow-sm">
            <div className="border-b border-sand-200 px-5 py-4">
              <h2 className="font-display text-base font-semibold text-sand-950">Route</h2>
              <p className="text-xs text-sand-500">
                {shipment.mode} · {shipment.carrier}
              </p>
            </div>
            <div className="flex items-center gap-3 px-5 py-5">
              <div className="flex min-w-0 flex-1 flex-col gap-0.5 rounded-lg bg-sand-100/70 px-3 py-2">
                <span className="text-xs text-sand-400">Origin</span>
                <span className="truncate font-medium text-sand-900">{shipment.origin}</span>
              </div>
              <Ship aria-hidden className="size-5 shrink-0 text-sand-400" />
              <div className="flex min-w-0 flex-1 flex-col gap-0.5 rounded-lg bg-sand-100/70 px-3 py-2">
                <span className="text-xs text-sand-400">Destination</span>
                <span className="truncate font-medium text-sand-900">{shipment.destination}</span>
              </div>
            </div>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4 border-t border-sand-100 px-5 py-5 sm:grid-cols-3">
              {[
                ["Container", shipment.containerRef],
                ["Mode", shipment.mode],
                ["Departed", shipment.departedAt ?? "Not yet"],
                ["ETA", shipment.eta ?? "—"],
                ["Delivered", shipment.deliveredAt ?? "—"],
                ["Tracking", shipment.containerRef],
              ].map(([label, value]) => (
                <div key={label} className="flex flex-col gap-0.5">
                  <dt className="text-xs font-medium text-sand-500">{label}</dt>
                  <dd className="font-mono text-xs font-medium text-sand-900">{value}</dd>
                </div>
              ))}
            </dl>
          </section>

          {/* Documents */}
          <section className="rounded-xl border border-sand-200 bg-white shadow-sm">
            <div className="border-b border-sand-200 px-5 py-4">
              <h2 className="font-display text-base font-semibold text-sand-950">Documents</h2>
              <p className="text-xs text-sand-500">Shipper paperwork for this consignment.</p>
            </div>
            <ul className="flex flex-col divide-y divide-sand-100">
              {SHIPMENT_DOCUMENTS.map((doc) => (
                <li
                  key={doc}
                  className="flex items-center justify-between gap-4 px-5 py-3 text-sm"
                >
                  <span className="flex items-center gap-2.5 text-sand-800">
                    <FileText aria-hidden className="size-4 shrink-0 text-sand-400" />
                    {doc}
                  </span>
                  <span className="rounded-full bg-sand-100 px-2 py-0.5 text-[11px] font-medium text-sand-500">
                    PDF
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </div>

        {/* Timeline */}
        <section className="rounded-xl border border-sand-200 bg-white shadow-sm xl:col-span-5">
          <div className="border-b border-sand-200 px-5 py-4">
            <h2 className="font-display text-base font-semibold text-sand-950">Milestones</h2>
            <p className="text-xs text-sand-500">Live status of this consignment.</p>
          </div>
          <ol className="flex flex-col px-5 py-4">
            {stages.map((stage, index) => {
              const isLast = index === stages.length - 1;
              return (
                <li key={stage.label} className="flex gap-3">
                  <span className="flex flex-col items-center">
                    {stage.state === "done" ? (
                      <Check aria-hidden className="size-5 shrink-0 text-brand-700" />
                    ) : stage.state === "active" ? (
                      <Ship aria-hidden className="size-5 shrink-0 text-brand-600" />
                    ) : (
                      <span aria-hidden className="size-2 shrink-0 rounded-full bg-sand-200 ring-4 ring-sand-100" />
                    )}
                    {!isLast ? <span className="w-px flex-1 bg-sand-200" /> : null}
                  </span>
                  <span
                    className={cn(
                      "pb-5 text-sm font-medium",
                      isLast && "pb-0",
                      stage.state === "pending" ? "text-sand-400" : "text-sand-900",
                    )}
                  >
                    {stage.label}
                    {stage.state === "pending" ? (
                      <span className="mt-0.5 block text-xs text-sand-400">Not started</span>
                    ) : null}
                  </span>
                </li>
              );
            })}
          </ol>
        </section>
      </div>
    </div>
  );
}