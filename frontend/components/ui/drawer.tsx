import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "@/lib/utils";

export const DrawerTitle = DialogPrimitive.Title;
export const DrawerDescription = DialogPrimitive.Description;

const drawerContentVariants = cva(
  "fixed z-50 flex flex-col bg-white shadow-dialog focus:outline-none",
  {
    variants: {
      side: {
        right: "inset-y-0 right-0 w-full max-w-md border-l border-sand-200",
        left: "inset-y-0 left-0 w-full max-w-md border-r border-sand-200",
        bottom: "inset-x-0 bottom-0 max-h-[85vh] rounded-t-2xl border-t border-sand-200",
        top: "inset-x-0 top-0 max-h-[85vh] rounded-b-2xl border-b border-sand-200",
      },
    },
    defaultVariants: { side: "right" },
  },
);

export interface DrawerProps
  extends React.ComponentPropsWithRef<"div">, VariantProps<typeof drawerContentVariants> {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  side?: "right" | "left" | "bottom" | "top";
  hideCloseIcon?: boolean;
}

export const Drawer = React.forwardRef<HTMLDivElement, DrawerProps>(function Drawer(
  { open, onOpenChange, title, side, hideCloseIcon, className, children, ...props },
  ref,
) {
  const sideClass: Record<NonNullable<typeof side>, string> = {
    right: "data-[state=open]:animate-slide-in-right data-[state=closed]:animate-slide-out-right",
    left: "data-[state=open]:animate-slide-in-left data-[state=closed]:animate-slide-out-left",
    bottom: "data-[state=open]:animate-slide-in-up data-[state=closed]:animate-slide-out-down",
    top: "data-[state=open]:animate-slide-in-down data-[state=closed]:animate-slide-out-up",
  };
  const resolvedSide = side ?? "right";

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="animate-overlay-in bg-sand-950/50 data-[state=closed]:animate-overlay-out fixed inset-0 z-50 backdrop-blur-[2px]" />
        <DialogPrimitive.Content
          ref={ref}
          className={cn(
            drawerContentVariants({ side: resolvedSide }),
            sideClass[resolvedSide],
            className,
          )}
          {...props}
        >
          <div className="border-sand-100 flex items-center justify-between gap-4 border-b p-5">
            {title ? (
              <DialogPrimitive.Title className="font-display text-sand-900 text-lg font-semibold">
                {title}
              </DialogPrimitive.Title>
            ) : (
              <span />
            )}
            {!hideCloseIcon ? (
              <DialogPrimitive.Close
                aria-label="Close drawer"
                className="text-sand-400 hover:bg-sand-100 hover:text-sand-700 focus:ring-brand-500/60 flex size-8 shrink-0 items-center justify-center rounded-md transition-colors focus:ring-2 focus:outline-none"
              >
                <X aria-hidden className="size-4" />
              </DialogPrimitive.Close>
            ) : null}
          </div>
          <div className="flex-1 overflow-y-auto p-5">{children}</div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
});
