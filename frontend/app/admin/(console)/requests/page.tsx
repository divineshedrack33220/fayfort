import Link from "next/link";
import { SearchX } from "lucide-react";
import type { Metadata } from "next";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusPill } from "@/components/ui/status-pill";
import { FilterSelect } from "@/components/admin/filter-select";
import { ListToolbar } from "@/components/admin/list-toolbar";
import { DetailTriggerRow } from "@/components/admin/detail-row";
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeadCell,
  TableRow,
} from "@/components/ui/table";
import {
  pipelineStageLabel,
  pipelineStageStatuses,
  type AdminRequestRow,
} from "@/lib/admin";
import { getAdminRequests } from "@/lib/data/admin";
import { requestStatusMeta, REQUEST_STATUSES } from "@/lib/status";

export const metadata: Metadata = { title: "Sourcing Requests" };

type SortKey = "newest" | "oldest" | "quantity";
type DateWindow = "any" | "30" | "90";

const DATE_WINDOW_LABELS: Record<DateWindow, string> = {
  any: "Any date",
  "30": "Last 30 days",
  "90": "Last 90 days",
};

function withinWindow(dateLabel: string, days: number): boolean {
  const ts = Date.parse(dateLabel);
  if (Number.isNaN(ts)) return days !== 30 && days !== 90;
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return ts >= cutoff;
}

function filterRequests(
  rows: AdminRequestRow[],
  statuses: string[] | null,
  query: string,
  sort: SortKey,
  dateWindow: DateWindow,
): AdminRequestRow[] {
  const q = query.trim().toLowerCase();
  const filtered = rows.filter((row) => {
    if (statuses && !statuses.includes(row.status)) return false;
    if (dateWindow !== "any" && !withinWindow(row.date, Number(dateWindow))) return false;
    if (q) {
      const haystack = `${row.id} ${row.product} ${row.customer} ${row.city}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
  return [...filtered].sort((a, b) => {
    if (sort === "quantity") return b.quantity - a.quantity;
    const diff = Date.parse(b.date) - Date.parse(a.date);
    if (diff !== 0) return diff;
    return sort === "oldest" ? a.id.localeCompare(b.id) : b.id.localeCompare(a.id);
  });
}

export default async function AdminRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ stage?: string; status?: string; q?: string; sort?: string; date?: string }>;
}) {
  const params = await searchParams;
  const query = params.q ?? "";
  const sort: SortKey = params.sort === "oldest" || params.sort === "quantity" ? params.sort : "newest";
  const dateWindow: DateWindow =
    params.date === "30" || params.date === "90" ? params.date : "any";

  const allRequests = await getAdminRequests();
  const QUEUE_STATUSES = (REQUEST_STATUSES as readonly string[]).filter((status) =>
    allRequests.some((row) => row.status === status),
  );

  const stageLabel = params.stage ? pipelineStageLabel(params.stage) : undefined;
  const stageStatuses = params.stage ? pipelineStageStatuses(params.stage) : null;
  const activeStatus = params.stage
    ? null
    : REQUEST_STATUSES.includes(params.status as never)
      ? params.status!
      : null;
  const statuses: string[] | null = stageStatuses?.length ? stageStatuses : activeStatus ? [activeStatus] : null;

  const rows = filterRequests(allRequests, statuses, query, sort, dateWindow);
  const counts = allRequests.reduce<Record<string, number>>((acc, row) => {
    acc[row.status] = (acc[row.status] ?? 0) + 1;
    return acc;
  }, {});

  const pills = [
    { key: "", label: "All", count: allRequests.length },
    ...QUEUE_STATUSES.map((requestStatus) => ({
      key: requestStatus,
      label: requestStatusMeta(requestStatus).label,
      count: counts[requestStatus] ?? 0,
    })),
  ];

  return (
    <div className="flex flex-col gap-6 px-6 py-8 lg:px-10">
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-2xl font-semibold tracking-tight text-sand-950">
          Request queue
        </h1>
        <p className="text-sm text-sand-500">
          {rows.length} request{rows.length === 1 ? "" : "s"} in the queue
          {statuses
            ? ` · ${
                stageLabel ??
                (statuses.length === 1
                  ? requestStatusMeta(statuses[0]).label
                  : "filtered")
              }`
            : ""}
        </p>
      </div>

      <ListToolbar
        basePath="/admin/requests"
        query={query}
        statuses={pills}
        activeStatus={activeStatus}
        searchPlaceholder="Search request, product or customer…"
        searchLabel="Search requests"
        extraControls={
          <>
            <FilterSelect label="Sort" value={sort} paramName="sort" options={[
              { value: "newest", label: "Newest first" },
              { value: "oldest", label: "Oldest first" },
              { value: "quantity", label: "Qty high > low" },
            ]} />
            <FilterSelect label="Date" value={dateWindow} paramName="date" options={[
              { value: "any", label: DATE_WINDOW_LABELS.any },
              { value: "30", label: DATE_WINDOW_LABELS["30"] },
              { value: "90", label: DATE_WINDOW_LABELS["90"] },
            ]} />
          </>
        }
      />

      {rows.length > 0 ? (
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableHeadCell>Request ID</TableHeadCell>
                <TableHeadCell>Product</TableHeadCell>
                <TableHeadCell>Customer</TableHeadCell>
                <TableHeadCell className="text-right">Quantity</TableHeadCell>
                <TableHeadCell>Destination</TableHeadCell>
                <TableHeadCell>Status</TableHeadCell>
                <TableHeadCell>Received</TableHeadCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row) => (
                <DetailTriggerRow key={row.id} entity="requests" row={row}>
                  <TableCell>
                    <Link
                      href={`/admin/requests/${row.id}`}
                      className="font-mono text-xs font-semibold text-sand-700 hover:text-sand-950 hover:underline"
                    >
                      {row.id}
                    </Link>
                  </TableCell>
                  <TableCell className="font-medium text-sand-900">{row.product}</TableCell>
                  <TableCell>
                    <p className="text-sm font-medium text-sand-800">{row.customer}</p>
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-sand-600">
                    {row.quantity.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-sand-600">{row.city}</TableCell>
                  <TableCell>
                    <StatusPill status={row.status} variant="gray" />
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sand-500">{row.date}</TableCell>
                </DetailTriggerRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      ) : (
        <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-sand-300 bg-white px-6 py-14">
          <EmptyState
            variant="neutral"
            icon={SearchX}
            title="No requests match"
            description="Try a different status, stage or date window, or clear the search to see the whole queue."
          />
          {(params.q || statuses || dateWindow !== "any" || sort !== "newest") ? (
            <Link
              href="/admin/requests"
              className="rounded-md border border-sand-300 bg-white px-3 py-2 text-sm font-medium text-sand-700 shadow-sm hover:bg-sand-50"
            >
              Clear all filters
            </Link>
          ) : null}
        </div>
      )}
    </div>
  );
}