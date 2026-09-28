import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface AdminPaginationProps {
  page: number;
  pageCount: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}

export function AdminPagination({
  page,
  pageCount,
  total,
  pageSize,
  onPageChange,
}: AdminPaginationProps) {
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="flex flex-col gap-3 border-t border-sand-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-sand-500">
        Showing <span className="font-medium text-sand-900">{from}–{to}</span> of{" "}
        <span className="font-medium text-sand-900">{total}</span>
      </p>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="flex h-9 items-center gap-1.5 rounded-md border border-sand-300 bg-white px-3 text-sm font-medium text-sand-700 shadow-sm transition-colors hover:bg-sand-50 disabled:pointer-events-none disabled:opacity-50"
        >
          <ChevronLeft aria-hidden className="size-4" />
          Previous
        </button>
        <span className="px-2 text-sm tabular-nums text-sand-500">
          {page} / {pageCount}
        </span>
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= pageCount}
          className={cn(
            "flex h-9 items-center gap-1.5 rounded-md border border-sand-300 bg-white px-3 text-sm font-medium text-sand-700 shadow-sm transition-colors hover:bg-sand-50 disabled:pointer-events-none disabled:opacity-50",
          )}
        >
          Next
          <ChevronRight aria-hidden className="size-4" />
        </button>
      </div>
    </div>
  );
}