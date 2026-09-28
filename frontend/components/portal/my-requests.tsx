"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronRight, Inbox, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusPill } from "@/components/ui/status-pill";
import { Reveal } from "@/components/motion/reveal";
import type { PortalRequestRow } from "@/lib/data/portal";
import { ProductIcon } from "@/lib/product-icons";
import { requestStatusMeta, toneClasses, type RequestStatus } from "@/lib/status";
import { cn } from "@/lib/utils";

const naira = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  maximumFractionDigits: 0,
});

type FilterKey = "all" | RequestStatus;

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "UNDER_REVIEW", label: "In Review" },
  { key: "QUOTE_READY", label: "Quoted" },
  { key: "CONVERTED", label: "Converted" },
];

function RequestCard({ request }: { request: PortalRequestRow }) {
  const tone = requestStatusMeta(request.status).tone;
  return (
    <div className="group h-full overflow-hidden rounded-xl border border-sand-200 bg-white shadow-card transition-shadow hover:shadow-card-hover">
      <Link
        href={`/dashboard/${request.id}`}
        className="flex h-full flex-col outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500/60"
      >
        {/* Status stripe: the stage is readable before any text is parsed. */}
        <span aria-hidden className={`h-1 w-full ${toneClasses[tone].dot}`} />

        <div className="flex flex-1 flex-col gap-3 p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <span
              aria-hidden
              className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-sand-50 ring-1 ring-sand-100 sm:size-14"
            >
              <ProductIcon product={request.product} className="size-5 text-brand-600 sm:size-7" />
            </span>

            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <p className="line-clamp-2 font-display text-[15px] leading-snug font-semibold text-brand-900 sm:text-lg">
                {request.product}
              </p>
              <p className="truncate font-mono text-xs text-sand-500">
                <span>{request.id}</span>
                <span aria-hidden> · </span>
                <span>{request.date}</span>
              </p>
            </div>
          </div>

          <div className="mt-auto flex items-center justify-between gap-2">
            <StatusPill status={request.status} />
            <span
              aria-hidden
              className="flex size-7 shrink-0 items-center justify-center rounded-full border border-sand-200 text-sand-400 transition-all group-hover:border-brand-200 group-hover:bg-brand-50 group-hover:text-brand-600"
            >
              <ChevronRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </span>
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-px border-t border-sand-100 bg-sand-100">
          {[
            { label: "Quantity", value: `${request.quantity.toLocaleString("en-NG")} units` },
            { label: "Budget", value: naira.format(request.budget) },
          ].map((stat) => (
            <div key={stat.label} className="flex flex-col gap-0.5 bg-white px-4 py-2.5">
              <dt className="text-[10px] font-semibold tracking-widest text-sand-500 uppercase">
                {stat.label}
              </dt>
              <dd className="truncate text-sm font-medium tabular-nums text-brand-900">
                {stat.value}
              </dd>
            </div>
          ))}
        </dl>
      </Link>
    </div>
  );
}

export function MyRequests({ requests }: { requests: PortalRequestRow[] }) {
  const [activeFilter, setActiveFilter] = useState<FilterKey>("all");

  const filtered =
    activeFilter === "all"
      ? requests
      : requests.filter((request) => request.status === activeFilter);

  const countFor = (key: FilterKey) =>
    key === "all"
      ? requests.length
      : requests.filter((request) => request.status === key).length;

  return (
    <div className="container-shell flex flex-col gap-5 py-6 sm:gap-6 sm:py-10">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-2xl font-semibold tracking-tight text-brand-900 sm:text-4xl">
            My Requests
          </h1>
          <p className="text-sm text-sand-500 sm:text-base">
            Track your sourcing requests and view updates from the Fayfort
            team.
          </p>
        </div>
        <Button asChild intent="accent" size="sm" className="w-full sm:w-fit">
          <Link href="/apply">
            <Plus aria-hidden className="size-4" />
            New Request
          </Link>
        </Button>
      </div>

      <div
        role="tablist"
        aria-label="Filter requests"
        className="flex items-center gap-2 overflow-x-auto pb-1"
      >
        {FILTERS.map((filter) => {
          const isActive = filter.key === activeFilter;
          const count = countFor(filter.key);
          return (
            <button
              key={filter.key}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveFilter(filter.key)}
              className={cn(
                "flex shrink-0 items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-medium transition-colors",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/60",
                isActive
                  ? "border-brand-900 bg-brand-900 text-white"
                  : "border-sand-300 bg-white text-sand-700 hover:bg-sand-50",
              )}
            >
              {filter.label}
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
                  isActive
                    ? "bg-white/15 text-white"
                    : "bg-sand-100 text-sand-500",
                )}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3">
        {filtered.map((request, index) => (
          <Reveal as="li" key={request.id} delay={Math.min(index * 60, 300)} className="h-full">
            <RequestCard request={request} />
          </Reveal>
        ))}
      </ul>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="No requests match this filter"
          description={`Nothing is in ${FILTERS.find((f) => f.key === activeFilter)?.label ?? "this view"} yet. Try another filter or start a new request.`}
          actionLabel="Clear filter"
          onAction={() => setActiveFilter("all")}
        />
      ) : null}
    </div>
  );
}