import { cva, type VariantProps } from "class-variance-authority";
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";

const alertVariants = cva("flex items-start gap-3 rounded-lg border px-4 py-3", {
  variants: {
    tone: {
      info: "border-info-200 bg-info-50 text-info-800",
      success: "border-success-200 bg-success-50 text-success-800",
      warning: "border-warning-300/80 bg-warning-50 text-warning-900",
      danger: "border-danger-200 bg-danger-50 text-danger-800",
    },
  },
  defaultVariants: { tone: "info" },
});

const alertIcons = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  danger: XCircle,
} as const;

const alertIconClasses = {
  info: "text-info-500",
  success: "text-success-600",
  warning: "text-warning-600",
  danger: "text-danger-600",
} as const;

export interface AlertProps
  extends React.ComponentPropsWithRef<"div">, VariantProps<typeof alertVariants> {
  title?: string;
}

/** Inline message for non-blocking feedback (estimate disclaimers, notes, warnings). */
export const Alert = React.forwardRef<HTMLDivElement, AlertProps>(function Alert(
  { className, tone = "info", title, children, ...props },
  ref,
) {
  const resolvedTone = tone ?? "info";
  const Icon = alertIcons[resolvedTone];
  return (
    <div
      ref={ref}
      role={resolvedTone === "danger" ? "alert" : undefined}
      className={cn(alertVariants({ tone: resolvedTone }), className)}
      {...props}
    >
      <Icon aria-hidden className={cn("mt-0.5 size-4 shrink-0", alertIconClasses[resolvedTone])} />
      <div className="min-w-0 text-sm">
        {title ? <p className="leading-snug font-semibold">{title}</p> : null}
        <div className={cn("leading-relaxed", title ? "mt-0.5 text-[0.92em]" : "")}>{children}</div>
      </div>
    </div>
  );
});
