import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/admin/breadcrumbs";
import { StatusPill } from "@/components/ui/status-pill";
import { InspectionChecklist } from "@/components/admin/inspection-checklist";
import { getAdminInspections, getAdminOrders } from "@/lib/data/admin";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const inspections = await getAdminInspections();
  const inspection = inspections.find((entry) => entry.id === id);
  return { title: inspection ? `${inspection.product} — ${id}` : "Inspection not found" };
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs font-medium text-sand-500">{label}</dt>
      <dd className="text-sm text-sand-900">{value}</dd>
    </div>
  );
}

export default async function AdminInspectionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [inspections, orders] = await Promise.all([
    getAdminInspections(),
    getAdminOrders(),
  ]);
  const inspection = inspections.find((entry) => entry.id === id);
  if (!inspection) notFound();

  const order = orders.find((entry) => entry.id === inspection.orderId);

  return (
    <div className="flex flex-col gap-6 px-6 py-8 lg:px-10">
      <Breadcrumbs
        crumbs={[
          { label: "Inspections", href: "/admin/inspections" },
          { label: inspection.id },
        ]}
      />

      <div className="flex flex-col gap-4 border-b border-sand-200 pb-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs font-semibold text-sand-500">
              {inspection.id}
            </span>
            <StatusPill status={inspection.status} variant="gray" />
          </div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-sand-950">
            {inspection.product}
          </h1>
          <p className="text-sm text-sand-500">
            Scheduled {inspection.scheduledAt} · assigned to {inspection.inspector}
          </p>
        </div>
        {order ? (
          <Link
            href={`/admin/orders/${order.id}`}
            className="inline-flex w-fit items-center gap-1.5 rounded-md border border-sand-300 bg-white px-3 py-2 text-sm font-medium text-sand-700 shadow-sm transition-colors hover:bg-sand-50"
          >
            <ArrowLeft aria-hidden className="size-4 rotate-180" />
            View order
          </Link>
        ) : null}
      </div>

      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <DetailRow label="Order" value={inspection.orderId} />
        <DetailRow label="Supplier" value={inspection.supplier} />
        <DetailRow label="Quantity" value={`${inspection.quantity.toLocaleString()} units`} />
        <DetailRow label="Scheduled" value={inspection.scheduledAt} />
      </dl>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        {/* Checklist */}
        <section className="rounded-xl border border-sand-200 bg-white shadow-sm xl:col-span-7">
          <div className="flex flex-col gap-1 border-b border-sand-200 px-5 py-4">
            <h2 className="font-display text-base font-semibold text-sand-950">
              Inspection checklist
            </h2>
            <p className="text-xs text-sand-500">
              Mark each item as passed or flagged before closing the record.
            </p>
          </div>
          <InspectionChecklist inspectionId={inspection.id} />
        </section>

        {/* Record info */}
        <div className="flex flex-col gap-6 xl:col-span-5">
          <section className="rounded-xl border border-sand-200 bg-white shadow-sm">
            <div className="border-b border-sand-200 px-5 py-4">
              <h2 className="font-display text-base font-semibold text-sand-950">
                Record details
              </h2>
            </div>
            <dl className="flex flex-col gap-3 px-5 py-5">
              <DetailRow label="Inspector" value={inspection.inspector} />
              {inspection.notes ? (
                <DetailRow label="Inspector notes" value={inspection.notes} />
              ) : null}
            </dl>
          </section>

          <section className="rounded-xl border border-sand-200 bg-white p-5 shadow-sm">
            <p className="flex items-start gap-2 text-sm leading-relaxed text-sand-600">
              <ShieldCheck aria-hidden className="mt-0.5 size-4 shrink-0 text-sand-400" />
              Pre-shipment inspections confirm quantity, quality, packaging and specification
              match before goods leave the factory.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}