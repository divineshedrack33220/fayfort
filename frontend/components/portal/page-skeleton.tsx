import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

function HeaderSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-9 w-64 max-w-full" />
      <Skeleton className="h-4 w-80 max-w-full" />
    </div>
  );
}

function CardSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "rounded-xl border border-sand-200 bg-white p-4 shadow-card sm:p-5",
        className,
      )}
    >
      <div className="flex items-center gap-3 sm:gap-4">
        <Skeleton className="size-12 shrink-0 rounded-xl sm:size-14" />
        <div className="flex flex-1 flex-col gap-2">
          <Skeleton className="h-4 w-40 max-w-full" />
          <Skeleton className="h-3 w-24" />
        </div>
        <Skeleton className="h-6 w-16 shrink-0 rounded-full" />
      </div>
    </div>
  );
}

export function PageSkeleton({
  variant = "list",
  rows = 4,
}: {
  variant?: "list" | "detail" | "chat";
  rows?: number;
}) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading content"
      className="container-shell flex flex-col gap-6 py-8 sm:py-10"
    >
      <HeaderSkeleton />

      {variant === "chat" ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[16rem_minmax(0,1fr)]">
          <div className="flex flex-col gap-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-16 rounded-lg" />
            ))}
          </div>
          <Skeleton className="h-80 rounded-xl" />
        </div>
      ) : variant === "detail" ? (
        <>
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-72 rounded-xl" />
        </>
      ) : (
        <div className="flex flex-col gap-3">
          {Array.from({ length: rows }).map((_, index) => (
            <CardSkeleton key={index} />
          ))}
        </div>
      )}

      <span className="sr-only">Loading…</span>
    </div>
  );
}