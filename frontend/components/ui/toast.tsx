"use client";

import { CheckCircle2, Info, TriangleAlert, XCircle } from "lucide-react";
import * as React from "react";
import { Toaster as SonnerToaster, toast } from "sonner";

export { toast };

const iconStyles = {
  success: "size-[18px] text-success-600",
  error: "size-[18px] text-danger-600",
  warning: "size-[18px] text-warning-600",
  info: "size-[18px] text-info-600",
} as const;

/** App-wide toast host. Mount once in the root layout. */
export function Toaster() {
  return (
    <SonnerToaster
      position="bottom-right"
      gap={8}
      offset={16}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            "flex w-80 items-start gap-3 rounded-lg border border-sand-200 bg-white px-4 py-3 shadow-pop",
          title: "text-sm font-semibold text-sand-900",
          description: "text-sm leading-relaxed text-sand-500",
        },
      }}
      icons={{
        success: <CheckCircle2 aria-hidden className={iconStyles.success} />,
        error: <XCircle aria-hidden className={iconStyles.error} />,
        warning: <TriangleAlert aria-hidden className={iconStyles.warning} />,
        info: <Info aria-hidden className={iconStyles.info} />,
      }}
      closeButton={false}
    />
  );
}
