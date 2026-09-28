import Link from "next/link";
import { ShieldCheck } from "lucide-react";
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
import { getAdminInspections } from "@/lib/data/admin";
import { INSPECTION_STATUSES, inspectionStatusMeta } from "@/lib/status";

export const metadata: Metadata = { title: "Inspections" };

export default async function AdminInspectionsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const params = await searchParams;
  const query = (params.q ?? "").trim().toLowerCase();
  const activeStatus = (INSPECTION_STATUSES as readonly string[]).includes(params.status ?? "")
    ? params.status!
    : null;

  const inspections = await getAdminInspections();
  const rows = inspections.filter((entry) => {
    if (activeStatus && entry.status !== activeStatus) return false;
    if (query) {
      const haystack =
        `${entry.id} ${entry.orderId} ${entry.product} ${entry.supplier} ${entry.inspector}`
          .toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  });

  const outstanding = inspections.filter(
    (entry) => entry.status === "PENDING" || entry.status === "IN_PROGRESS",
  ).length;
  const passed = inspections.filter((entry) => entry.status === "PASSED").length;
  const issues = inspections.filter((entry) => entry.status === "ISSUES").length;

  const statusCounts = inspections.reduce<Record<string, number>>((acc, entry) => {
    acc[entry.status] = (acc[entry.status] ?? 0) + 1;
    return acc;
  }, {});
  const pills = [
    { key: "", label: "All", count: inspections.length },
    ...(INSPECTION_STATUSES as readonly string[]).map((status) => ({
      key: status,
      label: inspectionStatusMeta(status).label,
      count: statusCounts[status] ?? 0,
    })),
  ];

  return (
    <div className="flex flex-col gap-6 px-6 py-8 lg:px-10">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-2xl font-semibold tracking-tight text-sand-950">
            Quality inspections
          </h1>
          <p className="text-sm text-sand-500">
            {outstanding} outstanding · {passed} passed · {issues} flagged with issues.
          </p>
        </div>
        <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            { label: "Total inspections", value: String(inspections.length) },
            { label: "Upcoming", value: String(outstanding) },
            { label: "Passed", value: String(passed) },
            { label: "Issues flagged", value: String(issues) },
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
        basePath="/admin/inspections"
        query={query}
        statuses={pills}
        activeStatus={activeStatus}
        searchPlaceholder="Search inspection, order or supplier…"
        searchLabel="Search inspections"
      />

      <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              <TableHeadCell>Inspection</TableHeadCell>
              <TableHeadCell>Order</TableHeadCell>
              <TableHeadCell>Product</TableHeadCell>
              <TableHeadCell>Supplier</TableHeadCell>
              <TableHeadCell className="text-right">Quantity</TableHeadCell>
              <TableHeadCell>Scheduled</TableHeadCell>
              <TableHeadCell>Inspector</TableHeadCell>
              <TableHeadCell>Status</TableHeadCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((entry) => (
              <DetailTriggerRow key={entry.id} entity="inspections" row={entry}>
                <TableCell>
                  <Link
                    href={`/admin/inspections/${entry.id}`}
                    className="font-mono text-xs font-semibold text-sand-700 hover:text-sand-950 hover:underline"
                  >
                    {entry.id}
                  </Link>
                </TableCell>
                <TableCell className="font-mono text-xs text-sand-500">{entry.orderId}</TableCell>
                <TableCell className="font-medium text-sand-900">{entry.product}</TableCell>
                <TableCell className="text-sand-600">{entry.supplier}</TableCell>
                <TableCell className="text-right tabular-nums text-sand-600">
                  {entry.quantity.toLocaleString()}
                </TableCell>
                <TableCell className="whitespace-nowrap text-sand-500">
                  {entry.scheduledAt}
                </TableCell>
                <TableCell className="text-sand-700">{entry.inspector}</TableCell>
                <TableCell>
                  <StatusPill status={entry.status} variant="gray" />
                </TableCell>
              </DetailTriggerRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <p className="flex items-center gap-2 text-sm text-sand-600">
        <ShieldCheck aria-hidden className="size-4 shrink-0 text-sand-500" />
        Inspections protect the customer before the bulk ships. Flag issues early to avoid returns.
      </p>
    </div>
  );
}