import Link from "next/link";
import { ArrowRight, Ship } from "lucide-react";
import type { Metadata } from "next";
import { StatusPill } from "@/components/ui/status-pill";
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeadCell,
  TableRow,
} from "@/components/ui/table";
import { ListToolbar } from "@/components/admin/list-toolbar";
import { DetailTriggerRow } from "@/components/admin/detail-row";
import { getAdminShipments } from "@/lib/data/admin";
import { SHIPMENT_STATUSES, shipmentStatusMeta } from "@/lib/status";

export const metadata: Metadata = { title: "Shipments" };

export default async function AdminShipmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const params = await searchParams;
  const query = (params.q ?? "").trim().toLowerCase();
  const activeStatus = (SHIPMENT_STATUSES as readonly string[]).includes(params.status ?? "")
    ? params.status!
    : null;

  const shipments = await getAdminShipments();
  const rows = shipments.filter((entry) => {
    if (activeStatus && entry.status !== activeStatus) return false;
    if (query) {
      const haystack =
        `${entry.id} ${entry.product} ${entry.customer} ${entry.carrier} ${entry.origin} ${entry.destination} ${entry.containerRef}`
          .toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  });

  const inTransit = shipments.filter((entry) => entry.status === "IN_TRANSIT").length;
  const inCustoms = shipments.filter((entry) => entry.status === "CUSTOMS").length;
  const delayed = shipments.filter((entry) => entry.status === "DELAYED").length;
  const delivered = shipments.filter((entry) => entry.status === "DELIVERED").length;

  const statusCounts = shipments.reduce<Record<string, number>>((acc, entry) => {
    acc[entry.status] = (acc[entry.status] ?? 0) + 1;
    return acc;
  }, {});
  const pills = [
    { key: "", label: "All", count: shipments.length },
    ...(SHIPMENT_STATUSES as readonly string[]).map((status) => ({
      key: status,
      label: shipmentStatusMeta(status).label,
      count: statusCounts[status] ?? 0,
    })),
  ];

  return (
    <div className="flex flex-col gap-6 px-6 py-8 lg:px-10">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-2xl font-semibold tracking-tight text-sand-950">
            Shipments in transit
          </h1>
          <p className="text-sm text-sand-500">
            Every order moving through Fayfort&apos;s freight network, origin to delivery.
          </p>
        </div>

        <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            { label: "In transit", value: String(inTransit) },
            { label: "In customs", value: String(inCustoms) },
            { label: "Delayed", value: String(delayed) },
            { label: "Delivered", value: String(delivered) },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-xl border border-sand-200 bg-white p-4 shadow-sm"
            >
              <dt className="text-xs font-semibold tracking-wide text-sand-500 uppercase">
                {stat.label}
              </dt>
              <dd className="mt-1 font-display text-xl font-semibold tabular-nums text-sand-950">
                {stat.value}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      <ListToolbar
        basePath="/admin/shipments"
        query={query}
        statuses={pills}
        activeStatus={activeStatus}
        searchPlaceholder="Search shipment, customer or route…"
        searchLabel="Search shipments"
      />

      {rows.length > 0 ? (
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableHeadCell>Shipment</TableHeadCell>
                <TableHeadCell className="text-right">Order</TableHeadCell>
                <TableHeadCell>Customer</TableHeadCell>
                <TableHeadCell>Method</TableHeadCell>
                <TableHeadCell>Route</TableHeadCell>
                <TableHeadCell>Tracking</TableHeadCell>
                <TableHeadCell>Estimated arrival</TableHeadCell>
                <TableHeadCell>Status</TableHeadCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((entry) => (
                <DetailTriggerRow key={entry.id} entity="shipments" row={entry}>
                  <TableCell>
                    <Link
                      href={`/admin/shipments/${entry.id}`}
                      className="font-mono text-xs font-semibold text-sand-700 hover:text-sand-950 hover:underline"
                    >
                      {entry.id}
                    </Link>
                    <p className="font-medium text-sand-900">{entry.product}</p>
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs text-sand-500">
                    {entry.requestId}
                  </TableCell>
                  <TableCell className="text-sand-700">{entry.customer}</TableCell>
                  <TableCell className="whitespace-nowrap text-sand-600">
                    {entry.carrier} · {entry.mode}
                  </TableCell>
                  <TableCell>
                    <p className="flex items-center gap-1.5 whitespace-nowrap text-xs text-sand-600">
                      {entry.origin}
                      <ArrowRight aria-hidden className="size-3 text-sand-400" />
                      {entry.destination}
                    </p>
                  </TableCell>
                  <TableCell className="whitespace-nowrap font-mono text-xs text-sand-500">
                    {entry.containerRef}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sand-600">
                    {entry.eta ?? entry.deliveredAt ?? "—"}
                  </TableCell>
                  <TableCell>
                    <StatusPill status={entry.status} variant="gray" />
                  </TableCell>
                </DetailTriggerRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      ) : (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-sand-300 bg-white px-6 py-14 text-center">
          <Ship aria-hidden className="size-6 text-sand-300" />
          <p className="text-sm font-medium text-sand-800">No shipments yet</p>
          <p className="text-sm text-sand-500">
            Approved sourcing requests turn into tracked shipments here.
          </p>
        </div>
      )}
    </div>
  );
}