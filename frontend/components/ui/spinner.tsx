import { LoaderCircle } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";

export interface SpinnerProps extends React.ComponentPropsWithRef<"svg"> {
  size?: "sm" | "md" | "lg";
}

const sizes = {
  sm: "size-4",
  md: "size-5",
  lg: "size-8",
} as const;

export const Spinner = React.forwardRef<SVGSVGElement, SpinnerProps>(function Spinner(
  { className, size = "md", ...props },
  ref,
) {
  return (
    <LoaderCircle
      ref={ref}
      className={cn("text-sand-400 animate-spin", sizes[size], className)}
      aria-hidden
      {...props}
    />
  );
});
