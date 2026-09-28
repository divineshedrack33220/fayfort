import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "@/lib/utils";

export const ModalTrigger = DialogPrimitive.Trigger;
export const ModalClose = DialogPrimitive.Close;
export const ModalTitle = DialogPrimitive.Title;
export const ModalDescription = DialogPrimitive.Description;

const modalContentVariants = cva(
  "fixed left-1/2 top-1/2 z-50 w-full -translate-x-1/2 -translate-y-1/2 flex flex-col rounded-2xl border border-sand-200 bg-white shadow-dialog focus:outline-none data-[state=open]:animate-scale-in transition-[transform] duration-200 [&[data-state=closed]]:animate-fade-out",
  {
    variants: {
      size: {
        sm: "max-w-sm",
        md: "max-w-md",
        lg: "max-w-2xl",
        xl: "max-w-4xl",
      },
    },
    defaultVariants: { size: "md" },
  },
);

export interface ModalProps
  extends React.ComponentPropsWithRef<"div">, VariantProps<typeof modalContentVariants> {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  hideCloseIcon?: boolean;
}

export const Modal = React.forwardRef<HTMLDivElement, ModalProps>(function Modal(
  { open, onOpenChange, title, description, size, hideCloseIcon, className, children, ...props },
  ref,
) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="animate-overlay-in bg-sand-950/50 data-[state=closed]:animate-overlay-out fixed inset-0 z-50 backdrop-blur-[2px]" />
        <DialogPrimitive.Content
          ref={ref}
          className={cn(modalContentVariants({ size }), className)}
          {...props}
        >
          {title || description || !hideCloseIcon ? (
            <div className="border-sand-100 flex items-start justify-between gap-4 border-b p-5">
              <div className="min-w-0">
                {title ? (
                  <DialogPrimitive.Title className="font-display text-sand-900 text-lg font-semibold">
                    {title}
                  </DialogPrimitive.Title>
                ) : null}
                {description ? (
                  <DialogPrimitive.Description className="text-sand-500 mt-1 text-sm">
                    {description}
                  </DialogPrimitive.Description>
                ) : null}
              </div>
              {!hideCloseIcon ? (
                <DialogPrimitive.Close
                  aria-label="Close"
                  className="text-sand-400 hover:bg-sand-100 hover:text-sand-700 focus:ring-brand-500/60 flex size-8 shrink-0 items-center justify-center rounded-md transition-colors focus:ring-2 focus:outline-none"
                >
                  <X aria-hidden className="size-4" />
                </DialogPrimitive.Close>
              ) : null}
            </div>
          ) : null}
          <div className="scroll-line max-h-[70vh] overflow-y-auto p-5">{children}</div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
});
