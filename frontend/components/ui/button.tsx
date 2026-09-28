import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { LoaderCircle } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-[color,background-color,border-color,box-shadow,transform] duration-200 select-none disabled:pointer-events-none disabled:opacity-60 active:scale-[0.98]",
  {
    variants: {
      intent: {
        primary:
          "bg-brand-600 text-white shadow-sm hover:bg-brand-700 focus-visible:bg-brand-700",
        accent:
          "bg-accent-600 text-white shadow-sm hover:bg-accent-700 focus-visible:bg-accent-700",
        dark: "bg-sand-900 text-white shadow-sm hover:bg-sand-950 focus-visible:bg-sand-950",
        "dark-outline":
          "border border-sand-300 bg-white text-sand-800 shadow-sm hover:bg-sand-50 focus-visible:bg-sand-50",
        light: "bg-white text-sand-900 shadow-sm hover:bg-sand-100 focus-visible:bg-sand-100",
        "light-outline":
          "border border-white/40 text-white hover:bg-white/10 focus-visible:bg-white/10",
        secondary:
          "bg-sand-200 text-sand-900 hover:bg-sand-300 focus-visible:bg-sand-300",
        outline:
          "border border-sand-300 bg-white text-sand-800 shadow-sm hover:bg-sand-50 focus-visible:bg-sand-50",
        ghost: "text-sand-700 hover:bg-sand-100 focus-visible:bg-sand-100",
        danger:
          "bg-danger-600 text-white shadow-sm hover:bg-danger-700 focus-visible:bg-danger-700",
        "danger-outline":
          "border border-danger-200 bg-danger-50 text-danger-700 hover:bg-danger-100 focus-visible:bg-danger-100",
        "on-dark-outline":
          "border border-white/25 bg-white/5 text-white shadow-sm hover:bg-white/10 focus-visible:bg-white/10",
        neutral:
          "bg-brand-700 text-white shadow-sm hover:bg-brand-800 focus-visible:bg-brand-800",
        "neutral-outline":
          "border border-brand-200 bg-white text-brand-800 shadow-sm hover:bg-brand-50 focus-visible:bg-brand-50",
      },
      size: {
        sm: "h-9 gap-1.5 rounded-md px-3.5",
        md: "h-10 rounded-md px-4",
        lg: "h-12 gap-2.5 rounded-lg px-6 text-base",
        icon: "size-10 rounded-md",
      },
    },
    defaultVariants: {
      intent: "primary",
      size: "md",
    },
  },
);

export interface ButtonProps
  extends React.ComponentPropsWithRef<"button">,
    VariantProps<typeof buttonVariants> {
  /** When true, renders the button chrome around a single child element (e.g. a Link). */
  asChild?: boolean;
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      className,
      intent,
      size,
      loading,
      disabled,
      asChild,
      children,
      ...props
    },
    ref,
  ) {
    const Comp = asChild ? Slot : "button";
    const renderedChildren = loading ? (
      <>
        <LoaderCircle aria-hidden className="size-4 animate-spin" />
        {children}
      </>
    ) : (
      children
    );
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ intent, size }), className)}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {renderedChildren}
      </Comp>
    );
  },
);

export { buttonVariants };