"use client";

import { useState } from "react";
import { Copy, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal, ModalTitle } from "@/components/ui/dialog";
import { toast } from "@/components/ui/toast";

export function ShareDialog({
  label,
  variant = "outline",
}: {
  label: string;
  variant?: "outline" | "secondary";
}) {
  const [open, setOpen] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success("Link copied to clipboard");
      setOpen(false);
    } catch {
      toast.error("Couldn't copy — copy the link manually below");
    }
  };

  return (
    <>
      <Button
        intent={variant}
        size="sm"
        onClick={() => setOpen(true)}
      >
        <Share2 aria-hidden className="size-4" />
        {label}
      </Button>

      <Modal open={open} onOpenChange={setOpen} size="md">
        <ModalTitle>Share this request</ModalTitle>
        <p className="text-sm text-sand-500">
          Copy the link to share this request and its quote with a colleague.
        </p>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <input
            type="text"
            readOnly
            value={typeof window === "undefined" ? "" : window.location.href}
            onFocus={(event) => event.currentTarget.select()}
            aria-label="Request link"
            className="h-10 min-w-0 flex-1 rounded-lg border border-sand-200 bg-white px-3 text-sm text-brand-900 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/60 focus:outline-none"
          />
          <Button intent="accent" size="md" onClick={handleCopy} className="shrink-0">
            <Copy aria-hidden className="size-4" />
            Copy link
          </Button>
        </div>
      </Modal>
    </>
  );
}