import * as React from "react";
import * as LabelPrimitive from "@radix-ui/react-label";
import { cn } from "@/lib/utils";

interface FieldContextValue {
  id: string;
  invalid: boolean;
  /** ids of the hint and error nodes, so a control can reference them. */
  describedBy?: string;
}

const FieldContext = React.createContext<FieldContextValue | null>(null);

export function useFieldContext() {
  return React.useContext(FieldContext);
}

export interface FieldProps extends React.ComponentPropsWithRef<"div"> {
  label: string;
  htmlFor?: string;
  hint?: string;
  error?: string;
  required?: boolean;
}

/** Wraps a form control with a label, optional hint and inline error. */
export const Field = React.forwardRef<HTMLDivElement, FieldProps>(function Field(
  { label, htmlFor, hint, error, required, className, children, ...props },
  ref,
) {
  const autoId = React.useId();
  const id = htmlFor ?? autoId;
  const invalid = error != null && error.length > 0;
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = invalid ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <FieldContext.Provider value={{ id, invalid, describedBy }}>
      <div ref={ref} className={cn("flex flex-col gap-1.5", className)} {...props}>
        <div className="flex items-baseline justify-between gap-2">
          <LabelPrimitive.Root htmlFor={id} className="text-sand-800 text-sm font-medium">
            {label}
            {required ? (
              <span aria-hidden className="text-danger-500 ml-0.5">
                *
              </span>
            ) : null}
          </LabelPrimitive.Root>
          {hint ? (
            <span id={hintId} className="text-sand-500 text-xs">
              {hint}
            </span>
          ) : null}
        </div>
        {children}
        {error ? (
          <p id={errorId} role="alert" className="text-danger-600 text-xs font-medium">
            {error}
          </p>
        ) : null}
      </div>
    </FieldContext.Provider>
  );
});
