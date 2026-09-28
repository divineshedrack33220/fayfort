import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "@/lib/utils";
import { toneClasses, type Tone } from "@/lib/status";

export const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border-0 px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset",
  {
    variants: {
      tone: {
        neutral: "bg-sand-100 text-sand-700 ring-sand-300/70",
        brand: "bg-brand-50 text-brand-700 ring-brand-200",
        info: "bg-info-50 text-info-700 ring-info-300/70",
        success: "bg-success-50 text-success-700 ring-success-300/70",
        warning: "bg-warning-50 text-warning-800 ring-warning-300/70",
        danger: "bg-danger-50 text-danger-700 ring-danger-300/70",
        accent: "bg-accent-50 text-accent-800 ring-accent-300/70",
      },
    },
    defaultVariants: {
      tone: "neutral",
    },
  },
);

export interface BadgeProps
  extends React.ComponentPropsWithRef<"span">, VariantProps<typeof badgeVariants> {
  dot?: Tone | boolean;
}

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(function Badge(
  { className, tone, dot, children, ...props },
  ref,
) {
  const withDot = dot === true ? (tone ?? "neutral") : dot;
  return (
    <span
      ref={ref}
      className={cn(badgeVariants({ tone }), "whitespace-nowrap", className)}
      {...props}
    >
      {withDot ? (
        <span aria-hidden className={cn("size-1.5 rounded-full", toneClasses[withDot].dot)} />
      ) : null}
      {children}
    </span>
  );
});
