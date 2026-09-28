import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";
import { useFieldContext } from "@/components/ui/field";

export interface CheckboxProps extends React.ComponentPropsWithRef<"button"> {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  invalid?: boolean;
}

export const Checkbox = React.forwardRef<HTMLButtonElement, CheckboxProps>(function Checkbox(
  { className, checked, onCheckedChange, disabled, invalid, ...props },
  ref,
) {
  const field = useFieldContext();
  const id = props.id ?? field?.id;
  const isInvalid = invalid ?? field?.invalid ?? false;

  return (
    <CheckboxPrimitive.Root
      ref={ref}
      id={id}
      checked={checked ?? false}
      onCheckedChange={(value) => onCheckedChange?.(value === true)}
      disabled={disabled}
      aria-invalid={isInvalid || undefined}
      aria-describedby={field?.describedBy}
      className={cn(
        "flex size-[18px] shrink-0 items-center justify-center rounded-[5px] border bg-white shadow-sm transition-colors duration-150",
        "focus:ring-brand-500/60 focus:border-brand-500 focus:ring-2 focus:outline-none",
        "disabled:cursor-not-allowed disabled:opacity-60",
        "data-[state=checked]:border-brand-600 data-[state=checked]:bg-brand-600",
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator className="flex items-center justify-center text-white">
        <Check aria-hidden className="size-3.5" strokeWidth={3} />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
});
