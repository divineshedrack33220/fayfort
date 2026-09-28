import { RefreshCw, TriangleAlert } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export interface ErrorStateProps extends React.ComponentPropsWithRef<"div"> {
  title?: string;
  description?: string;
  onRetry?: () => void;
  compact?: boolean;
}

/**
 * Full or inline error state. Always explains what the user can do next
 * (restore a session, retry, contact support) — never a bare error string.
 */
export const ErrorState = React.forwardRef<HTMLDivElement, ErrorStateProps>(function ErrorState(
  {
    title = "Something went wrong",
    description = "We couldn't load this right now. Please try again.",
    onRetry,
    compact = false,
    className,
    ...props
  },
  ref,
) {
  return (
    <div
      ref={ref}
      role="alert"
      className={cn(
        "border-danger-200 bg-danger-50/60 flex flex-col items-center justify-center gap-2 rounded-xl border px-6 py-10 text-center",
        compact && "py-6",
        className,
      )}
      {...props}
    >
      <div className="border-danger-200 flex size-12 items-center justify-center rounded-full border bg-white">
        <TriangleAlert aria-hidden className="text-danger-500 size-5" />
      </div>
      <h3 className="font-display text-sand-900 mt-2 text-base font-semibold">{title}</h3>
      <p className={cn("text-sand-600 max-w-sm text-sm", compact && "max-w-xs")}>{description}</p>
      {onRetry ? (
        <Button intent="outline" size="sm" className="mt-3" onClick={onRetry}>
          <RefreshCw aria-hidden className="size-4" />
          Try again
        </Button>
      ) : null}
    </div>
  );
});
