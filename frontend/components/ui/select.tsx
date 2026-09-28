import { ChevronDown } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";
import { useFieldContext } from "@/components/ui/field";

export interface SelectProps extends React.ComponentPropsWithRef<"select"> {
  invalid?: boolean;
}

/**
 * Native select with custom chrome. Native <select> keeps the mobile
 * picker experience (critical for the mobile-first portal) while the
 * chevron and styles match the rest of the system.
 */
export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className, invalid, id, children, ...props },
  ref,
) {
  const field = useFieldContext();
  const isInvalid = invalid ?? field?.invalid ?? false;
  const resolvedId = id ?? field?.id;

  return (
    <div className="relative">
      <select
        ref={ref}
        id={resolvedId}
        aria-invalid={isInvalid || undefined}
        aria-describedby={field?.describedBy}
        className={cn(
          "text-sand-900 h-10 w-full cursor-pointer appearance-none rounded-md border bg-white pr-9 pl-3 text-sm shadow-sm transition-[border-color,box-shadow] duration-200",
          "focus:ring-brand-500/60 focus:border-brand-500 focus:ring-2 focus:outline-none",
          "disabled:bg-sand-100 disabled:text-sand-500 disabled:cursor-not-allowed",
          "[&>option]:text-sand-900",
          isInvalid
            ? "border-danger-400 focus:ring-danger-500/60 focus:border-danger-500"
            : "border-sand-300",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden="true"
        className="text-sand-500 pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2"
      />
    </div>
  );
});
