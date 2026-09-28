import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import * as React from "react";
import { cn } from "@/lib/utils";

export const TooltipProvider = TooltipPrimitive.Provider;

export interface TooltipProps {
  content: React.ReactNode;
  side?: "top" | "right" | "bottom" | "left";
  delayDuration?: number;
  children: React.ReactNode;
  className?: string;
}

export const Tooltip = ({
  content,
  side = "top",
  delayDuration = 200,
  children,
  className,
}: TooltipProps) => {
  return (
    <TooltipPrimitive.Root delayDuration={delayDuration}>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={side}
          sideOffset={6}
          className={cn(
            "animate-scale-in bg-sand-900 text-sand-50 shadow-pop z-50 rounded-md px-2.5 py-1.5 text-xs font-medium",
            "data-[side=top]:[transform-origin:50%_100%]",
            className,
          )}
        >
          {content}
          <TooltipPrimitive.Arrow className="fill-sand-900" />
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
};
