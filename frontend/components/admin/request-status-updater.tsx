"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ChevronsUpDown } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/dialog";
import { StatusPill } from "@/components/ui/status-pill";
import { REQUEST_STATUSES, requestStatusMeta } from "@/lib/status";
import { cn } from "@/lib/utils";

export function RequestStatusUpdater({
  requestId,
  current,
  className,
}: {
  requestId: string;
  current: string;
  className?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const choices = (REQUEST_STATUSES as readonly string[]).filter(
    (status) => status !== current,
  );

  return (
    <>
      <Button intent="neutral-outline" onClick={() => setOpen(true)} className={className}>
        <ChevronsUpDown aria-hidden className="size-4" />
        Update status
      </Button>
      <Modal
        open={open}
        onOpenChange={setOpen}
        title="Update request status"
        description={`Advance ${requestId} to the next stage of the sourcing pipeline.`}
      >
        <ul className="flex flex-col gap-1">
          {choices.map((status) => (
            <li key={status}>
              <button
                type="button"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    const response = await fetch(
                      `/api/backend/admin/requests/${encodeURIComponent(requestId)}/status`,
                      {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ status }),
                      },
                    );
                    if (!response.ok) throw new Error("Request failed");
                    toast.success(`${requestId} moved to ${requestStatusMeta(status).label}`);
                    router.refresh();
                    setOpen(false);
                  } catch {
                    toast.error(`Could not update ${requestId}`);
                  } finally {
                    setBusy(false);
                  }
                }}
                className={cn(
                  "flex w-full items-center justify-between gap-3 rounded-md px-3 py-2.5 text-left text-sm transition-colors hover:bg-sand-100",
                )}
              >
                <span className="font-medium text-sand-800">
                  {requestStatusMeta(status).label}
                </span>
                <StatusPill status={status} variant="gray" />
              </button>
            </li>
          ))}
        </ul>
      </Modal>
    </>
  );
}