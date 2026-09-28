import { CirclePlus, TrendingUp } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export interface EmptyStateProps extends React.ComponentPropsWithRef<"div"> {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  actionIcon?: React.ComponentType<{ className?: string }>;
  /** "sand" suits the public portal; "neutral" suits the staff console. */
  variant?: "sand" | "neutral";
}

/** Meaningful empty state — never a bare empty table. */
export const EmptyState = React.forwardRef<HTMLDivElement, EmptyStateProps>(function EmptyState(
  {
    icon: Icon = TrendingUp,
    title,
    description,
    actionLabel,
    onAction,
    actionIcon: ActionIcon = CirclePlus,
    variant = "sand",
    className,
    ...props
  },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cn(
        "relative flex flex-col items-center justify-center overflow-hidden rounded-2xl border border-dashed border-sand-300 bg-white/60 px-6 py-14 text-center",
        className,
      )}
      {...props}
    >
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <span className="absolute -top-10 left-1/2 h-32 w-32 -translate-x-1/2 rounded-full bg-brand-100/60 blur-2xl" />
        <span className="absolute -bottom-12 left-8 h-24 w-24 rounded-full bg-sand-200/70 blur-2xl" />
      </div>

      <div className="relative">
        <div className="relative flex size-14 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-sand-200">
          <span
            aria-hidden
            className="absolute inset-0 rounded-2xl bg-gradient-to-br from-brand-500/10 to-accent-500/10"
          />
          <Icon aria-hidden className="relative size-6 text-brand-600" />
        </div>
        <span
          aria-hidden
          className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-sand-200"
        >
          <TrendingUp aria-hidden className="size-2.5 text-accent-500" />
        </span>
      </div>

      <h3 className="font-display relative mt-4 text-base font-semibold text-sand-900">{title}</h3>
      {description ? (
        <p className="relative max-w-sm text-sm text-sand-500">{description}</p>
      ) : null}
      {actionLabel ? (
        <Button
          intent={variant === "sand" ? "primary" : "neutral"}
          size="sm"
          className="relative mt-4"
          onClick={onAction}
        >
          <ActionIcon aria-hidden className="size-4" />
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
});