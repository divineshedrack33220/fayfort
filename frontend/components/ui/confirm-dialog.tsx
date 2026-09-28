import * as React from "react";
import { Modal } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "danger" | "primary";
  loading?: boolean;
  onConfirm?: () => void;
  onCancel?: () => void;
}

/**
 * Confirmation dialog for destructive or consequential actions.
 * Does not auto-close on confirm — the caller controls `open` (so loading
 * states and async flows stay in control).
 */
export const ConfirmDialog = React.forwardRef<HTMLDivElement, ConfirmDialogProps>(
  function ConfirmDialog(
    {
      open,
      onOpenChange,
      title,
      description,
      confirmLabel = "Confirm",
      cancelLabel = "Cancel",
      tone = "danger",
      loading,
      onConfirm,
      onCancel,
    },
    ref,
  ) {
    return (
      <Modal ref={ref} open={open} onOpenChange={onOpenChange} size="sm" hideCloseIcon>
        <div className="flex flex-col gap-5">
          <div>
            <p className="font-display text-sand-900 text-base font-semibold">{title}</p>
            {description ? (
              <div className="text-sand-500 mt-1 text-sm leading-relaxed">{description}</div>
            ) : null}
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              intent="outline"
              onClick={() => {
                onCancel?.();
                onOpenChange(false);
              }}
              disabled={loading}
            >
              {cancelLabel}
            </Button>
            <Button
              type="button"
              intent={tone === "danger" ? "danger" : "primary"}
              loading={loading}
              onClick={() => onConfirm?.()}
            >
              {confirmLabel}
            </Button>
          </div>
        </div>
      </Modal>
    );
  },
);
