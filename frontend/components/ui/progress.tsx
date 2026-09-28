import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Determinate progress bar. `value` is 0–100.
 *
 * Hand-rolled rather than Radix because the app only ships the Radix packages
 * it actually uses (dialog, label, slot, tooltip, checkbox) and a single bar
 * does not justify a new dependency. It keeps the same ARIA role and value
 * semantics Radix exposes, so screen readers announce progress identically.
 */
export const Progress = React.forwardRef<
  HTMLDivElement,
  {
    value: number;
    className?: string;
    indicatorClassName?: string;
    label?: string;
  }
>(function Progress({ value, className, indicatorClassName, label }, ref) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div
      ref={ref}
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className={cn("bg-sand-200 relative h-1.5 w-full overflow-hidden rounded-full", className)}
    >
      <div
        className={cn(
          "h-full rounded-full bg-brand-600 transition-transform duration-200 ease-out",
          indicatorClassName,
        )}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
});
