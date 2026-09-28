import Link from "next/link";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Inbox,
  ListChecks,
  Package,
  SearchCheck,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeadCell,
  TableRow,
} from "@/components/ui/table";
import { StatusPill } from "@/components/ui/status-pill";
import { DetailTriggerRow } from "@/components/admin/detail-row";
import { getSession } from "@/lib/session";
import { getAdminDashboard, getAdminRequests } from "@/lib/data/admin";
import { cn } from "@/lib/utils";

const TREND_CLASSES = {
  up: "text-sand-900",
  down: "text-sand-700",
} as const;

function trendBadge(delta: number) {
  const up = delta >= 0;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-sand-100 px-2 py-0.5 text-xs font-semibold tabular-nums ring-1 ring-sand-200",
        TREND_CLASSES[up ? "up" : "down"],
      )}
    >
      {up ? <ArrowUpRight aria-hidden className="size-3" /> : <ArrowDownRight aria-hidden className="size-3" />}
      {`${Math.abs(delta)}%`}
    </span>
  );
}

export default async function AdminDashboardPage() {
  const session = await getSession();
  const firstName = (session?.name ?? "Admin").split(" ")[0];
  const today = new Date().toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const [requests, dashboard] = await Promise.all([
    getAdminRequests(),
    getAdminDashboard(),
  ]);

  const metrics = [
    {
      label: "New requests",
      value: requests.filter((row) => row.status === "SUBMITTED").length,
      description: "Awaiting triage by the sourcing team",
      delta: dashboard?.kpis[0]?.delta ?? 0,
      icon: Inbox,
      chip: "bg-brand-100 text-brand-800",
    },
    {
      label: "Under review",
      value: requests.filter((row) => row.status === "UNDER_REVIEW").length,
      description: "Being assessed against supplier fit",
      delta: dashboard?.kpis[1]?.delta ?? 0,
      icon: SearchCheck,
      chip: "bg-sand-100 text-sand-700",
    },
    {
      label: "Active orders",
      value: dashboard?.activeOrders ?? 0,
      description: "In purchasing, inspection or transit",
      delta: dashboard?.kpis[2]?.delta ?? 0,
      icon: Package,
      chip: "bg-success-100 text-success-700",
    },
    {
      label: "Pending actions",
      value: dashboard?.pendingActions ?? 0,
      description: "Replies, inspections and drafts needing you",
      delta: dashboard?.kpis[3]?.delta ?? 0,
      icon: ListChecks,
      chip: "bg-accent-100 text-accent-700",
    },
  ];

  const recentRequests = [...requests]
    .sort((a, b) => Date.parse(b.date) - Date.parse(a.date))
    .slice(0, 6);

  const pipeline = dashboard?.pipeline ?? [];
  const peakCount = Math.max(0, ...pipeline.map((stage) => stage.count));

  return (
    <div className="flex flex-col gap-8 px-6 py-8 lg:px-10">
      {/* Greeting */}
      <div className="flex flex-col gap-2 border-b border-sand-200 pb-6">
        <p className="text-sm text-sand-500">{today}</p>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="font-display text-3xl font-semibold tracking-tight text-sand-950">
              Good morning, {firstName}
            </h1>
            <p className="mt-1 text-sm text-sand-500 sm:text-base">
              Here&apos;s what&apos;s happening across Fayfort today.
            </p>
          </div>
          <p className="text-sm text-sand-400">
            {requests.length} open sourcing requests
          </p>
        </div>
      </div>

      {/* Metric cards */}
      <section aria-label="Key metrics" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <div
              key={metric.label}
              className="flex flex-col rounded-xl border border-sand-200 bg-white p-4 shadow-sm"
            >
              <div className="flex items-center justify-between gap-3">
                <span
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-md",
                    metric.chip,
                  )}
                >
                  <Icon aria-hidden className="size-3.5" />
                </span>
                <span className="text-[11px] font-semibold uppercase tracking-wide text-sand-500">
                  {metric.label}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <p className="font-display text-2xl font-semibold tracking-tight text-sand-950 tabular-nums">
                  {metric.value}
                </p>
                <span title="vs last 30 days">{trendBadge(metric.delta)}</span>
              </div>
              <p className="mt-auto pt-3 text-xs leading-relaxed text-sand-500">
                {metric.description}
              </p>
            </div>
          );
        })}
      </section>

      {/* Pipeline */}
      <section className="flex flex-col gap-3" aria-label="Sourcing pipeline">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-sand-900">Sourcing pipeline</h2>
          <Link
            href="/admin/requests"
            className="inline-flex items-center gap-1 text-sm font-medium text-sand-600 hover:text-sand-900"
          >
            Open queue <ArrowRight aria-hidden className="size-3.5" />
          </Link>
        </div>
        <div className="overflow-x-auto pb-1">
          <ol className="relative flex w-max min-w-full items-start">
            <span
              aria-hidden
              className="absolute top-[7px] right-3 left-3 h-0.5 bg-sand-200"
            />
            {pipeline.map((stage) => {
              const peak = stage.count > 0 && stage.count === peakCount;
              return (
                <li
                  key={stage.key}
                  className="flex w-24 shrink-0 min-w-0 flex-col items-center"
                >
                  <Link
                    href={`/admin/requests?stage=${encodeURIComponent(stage.key)}`}
                    className="group flex w-full flex-col items-center gap-1.5 rounded-lg px-1 pt-0 pb-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                  >
                    <span
                      className={cn(
                        "size-4 rounded-full ring-2 transition-colors",
                        stage.count === 0 && "bg-white ring-sand-200",
                        stage.count > 0 && !peak && "bg-brand-700 ring-brand-200",
                        peak && "bg-accent-500 ring-accent-500/30",
                      )}
                    />
                    <span
                      className={cn(
                        "w-full truncate text-center text-[11px] font-medium transition-colors",
                        stage.count > 0
                          ? "text-sand-700 group-hover:text-sand-950"
                          : "text-sand-400",
                      )}
                    >
                      {stage.label}
                    </span>
                    <span
                      className={cn(
                        "font-display tabular-nums",
                        peak
                          ? "text-lg font-bold text-accent-600"
                          : stage.count > 0
                            ? "text-lg font-semibold text-sand-800"
                            : "text-base font-medium text-sand-300",
                      )}
                    >
                      {stage.count}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ol>
        </div>
        <p className="text-xs text-sand-500">
          Select a stage to filter the sourcing queue.
        </p>
      </section>

      {/* Recent sourcing requests */}
      <section className="flex flex-col gap-3" aria-label="Recent sourcing requests">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-sand-900">Recent sourcing requests</h2>
          <Link
            href="/admin/requests"
            className="inline-flex items-center gap-1 text-sm font-medium text-sand-600 hover:text-sand-900"
          >
            View all <ArrowRight aria-hidden className="size-3.5" />
          </Link>
        </div>
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
              {recentRequests.map((row) => (
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
                  <TableCell className="text-sand-700">{row.customer}</TableCell>
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
      </section>
    </div>
  );
}