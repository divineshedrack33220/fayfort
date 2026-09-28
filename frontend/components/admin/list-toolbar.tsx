import Link from "next/link";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

export interface StatusFilterPill {
  /** Empty string renders the "All" pill (clears the status filter). */
  key: string;
  label: string;
  count: number;
}

/**
 * Shared toolbar for the admin list pages: a status-filter pill row plus a
 * search box (with optional extra controls like sort/date on the right).
 * Everything is server-driven via URL search params, so every list page
 * behaves the same way.
 */
export function ListToolbar({
  basePath,
  query,
  statuses,
  activeStatus,
  searchPlaceholder,
  searchLabel,
  extraControls,
}: {
  basePath: string;
  query: string;
  statuses: StatusFilterPill[];
  activeStatus: string | null;
  searchPlaceholder: string;
  searchLabel: string;
  extraControls?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {statuses.map((pill) => {
          const isActive = pill.key === "" ? activeStatus === null : activeStatus === pill.key;
          const href =
            pill.key === "" ? basePath : `${basePath}?status=${encodeURIComponent(pill.key)}`;
          return (
            <Link
              key={pill.key || "all"}
              href={href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
                isActive
                  ? "border-brand-800 bg-brand-800 text-white"
                  : "border-sand-200 bg-white text-sand-600 hover:bg-sand-50",
              )}
            >
              {pill.label}
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
                  isActive ? "bg-white/15 text-white" : "bg-sand-100 text-sand-500",
                )}
              >
                {pill.count}
              </span>
            </Link>
          );
        })}
      </div>

      <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
        <form method="get" className="relative max-w-md flex-1">
          <Search
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-sand-400"
          />
          <input
            type="search"
            name="q"
            defaultValue={query}
            placeholder={searchPlaceholder}
            aria-label={searchLabel}
            className="h-10 w-full rounded-md border border-sand-300 bg-white py-2 pr-4 pl-10 text-sm text-sand-900 shadow-sm transition-colors placeholder:text-sand-400 focus:ring-2 focus:ring-sand-400 focus:outline-none"
          />
          {activeStatus ? <input type="hidden" name="status" value={activeStatus} /> : null}
        </form>
        {extraControls ? (
          <div className="flex flex-wrap items-center gap-2">{extraControls}</div>
        ) : null}
      </div>
    </div>
  );
}