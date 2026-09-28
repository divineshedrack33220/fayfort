import * as React from "react";
import { cn } from "@/lib/utils";

type SkeletonProps = React.ComponentPropsWithRef<"div">;

/**
 * Skeleton loading placeholder with a warm shimmer.
 * Pairs with `aria-busy` regions and `animate-pulse`-style feedback.
 */
export const Skeleton = React.forwardRef<HTMLDivElement, SkeletonProps>(function Skeleton(
  { className, ...props },
  ref,
) {
  return (
    <div
      ref={ref}
      aria-hidden
      className={cn(
        "animate-shimmer bg-sand-200/80 rounded-md bg-[linear-gradient(110deg,var(--color-sand-200)_35%,var(--color-sand-100)_50%,var(--color-sand-200)_65%)] bg-[length:200%_100%]",
        className,
      )}
      {...props}
    />
  );
});
