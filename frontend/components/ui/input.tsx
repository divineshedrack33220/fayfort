import * as React from "react";
import { cn } from "@/lib/utils";
import { useFieldContext } from "@/components/ui/field";

export interface InputProps extends React.ComponentPropsWithRef<"input"> {
  invalid?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, invalid, id, ...props },
  ref,
) {
  const field = useFieldContext();
  const isInvalid = invalid ?? field?.invalid ?? false;
  const resolvedId = id ?? field?.id;

  return (
    <input
      ref={ref}
      id={resolvedId}
      aria-invalid={isInvalid || undefined}
      aria-describedby={field?.describedBy}
      className={cn(
        "text-sand-900 h-10 w-full rounded-md border bg-white px-3 text-sm shadow-sm transition-[border-color,box-shadow] duration-200",
        "placeholder:text-sand-400",
        "focus:ring-brand-500/60 focus:border-brand-500 focus:ring-2 focus:outline-none",
        "disabled:bg-sand-100 disabled:text-sand-500 disabled:cursor-not-allowed",
        isInvalid
          ? "border-danger-400 focus:ring-danger-500/60 focus:border-danger-500"
          : "border-sand-300",
        className,
      )}
      {...props}
    />
  );
});
