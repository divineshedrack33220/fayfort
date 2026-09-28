import * as React from "react";
import { cn } from "@/lib/utils";
import { useFieldContext } from "@/components/ui/field";

export interface TextareaProps extends React.ComponentPropsWithRef<"textarea"> {
  invalid?: boolean;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, invalid, id, rows = 4, ...props },
  ref,
) {
  const field = useFieldContext();
  const isInvalid = invalid ?? field?.invalid ?? false;
  const resolvedId = id ?? field?.id;

  return (
    <textarea
      ref={ref}
      id={resolvedId}
      rows={rows}
      aria-invalid={isInvalid || undefined}
      aria-describedby={field?.describedBy}
      className={cn(
        "text-sand-900 w-full rounded-md border bg-white px-3 py-2.5 text-sm shadow-sm transition-[border-color,box-shadow] duration-200",
        "placeholder:text-sand-400",
        "focus:ring-brand-500/60 focus:border-brand-500 focus:ring-2 focus:outline-none",
        "disabled:bg-sand-100 disabled:text-sand-500 disabled:cursor-not-allowed",
        "resize-y",
        isInvalid
          ? "border-danger-400 focus:ring-danger-500/60 focus:border-danger-500"
          : "border-sand-300",
        className,
      )}
      {...props}
    />
  );
});
