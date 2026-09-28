"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { TableCell, TableRow } from "@/components/ui/table";
import {
  ViewDetailModal,
  type ViewDetailRow,
} from "@/components/admin/view-detail-modal";

export type DetailTriggerRowProps = ViewDetailRow & { children: React.ReactNode };

/**
 * Table row that opens the entity's detail modal when clicked — the primary
 * way to inspect a record in the admin lists. Inner links/buttons keep
 * their own behaviour, and the trailing chevron is the keyboard-accessible
 * trigger.
 *
 * Lives in its own "use client" module (separate from the modal) to keep the
 * Turbopack client-component chunk lean during fast refresh.
 */
export function DetailTriggerRow(props: DetailTriggerRowProps) {
  const { children, ...row } = props;
  const [open, setOpen] = useState(false);
  return (
    <>
      <TableRow
        className="cursor-pointer"
        onClick={(event) => {
          const target = event.target as HTMLElement;
          if (
            event.defaultPrevented ||
            target.closest("a, button, input, select, textarea, [data-ignore-row-click]")
          ) {
            return;
          }
          setOpen(true);
        }}
      >
        {children}
        <TableCell className="w-10 pr-4 text-right">
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Open details"
            className="ml-auto flex size-8 items-center justify-center rounded-md border border-sand-200 text-sand-400 shadow-sm transition-colors hover:border-brand-300 hover:bg-brand-50 hover:text-brand-800"
          >
            <ChevronRight aria-hidden className="size-4" />
          </button>
        </TableCell>
      </TableRow>
      <ViewDetailModal {...row} open={open} onOpenChange={setOpen} />
    </>
  );
}