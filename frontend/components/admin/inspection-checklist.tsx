"use client";

import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/dialog";
import { INSPECTION_CHECKLIST } from "@/lib/admin";
import { cn } from "@/lib/utils";

type ItemState = "untouched" | "pass" | "issue";

export function InspectionChecklist({ inspectionId }: { inspectionId: string }) {
  const [items, setItems] = React.useState<Record<string, ItemState>>(
    Object.fromEntries(INSPECTION_CHECKLIST.map((item) => [item.key, "untouched"])),
  );
  const [notesOpen, setNotesOpen] = React.useState(false);
  const [notes, setNotes] = React.useState("");
  const completed = Object.values(items).filter((state) => state !== "untouched").length;

  const toggle = (key: string, state: ItemState) => {
    setItems((prev) => {
      const next = { ...prev };
      next[key] = prev[key] === state ? "untouched" : state;
      return next;
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col divide-y divide-sand-100">
        {INSPECTION_CHECKLIST.map((item) => {
          const state = items[item.key] ?? "untouched";
          return (
            <li key={item.key} className="flex items-center justify-between gap-4 px-5 py-3">
              <div>
                <p className="text-sm font-medium text-sand-800">{item.label}</p>
                <p className="text-xs text-sand-400">{item.intro}</p>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => toggle(item.key, "pass")}
                  aria-pressed={state === "pass"}
                  className={cn(
                    "rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
                    state === "pass"
                      ? "border-brand-800 bg-brand-800 text-white"
                      : "border-sand-300 bg-white text-sand-600 hover:bg-sand-50",
                  )}
                >
                  Pass
                </button>
                <button
                  type="button"
                  onClick={() => toggle(item.key, "issue")}
                  aria-pressed={state === "issue"}
                  className={cn(
                    "rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
                    state === "issue"
                      ? "border-brand-800 bg-brand-800 text-white"
                      : "border-sand-300 bg-white text-sand-600 hover:bg-sand-50",
                  )}
                >
                  Flag
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      <div className="flex flex-col gap-2 px-5 sm:flex-row">
        <Button
          intent="neutral-outline"
          className="flex-1"
          onClick={() => toast.success("Evidence files uploaded")}
        >
          Upload evidence
        </Button>
        <Button intent="neutral-outline" className="flex-1" onClick={() => setNotesOpen(true)}>
          Add notes
        </Button>
        <Button
          intent="neutral"
          className="flex-1"
          disabled={completed < INSPECTION_CHECKLIST.length}
          onClick={() => toast.success(`${inspectionId} marked complete`)}
        >
          Mark complete ({completed}/{INSPECTION_CHECKLIST.length})
        </Button>
      </div>

      <Modal
        open={notesOpen}
        onOpenChange={setNotesOpen}
        title="Inspector notes"
        description="Add findings to the inspection record."
      >
        <form
          onSubmit={(event) => {
            event.preventDefault();
            setNotesOpen(false);
            toast.success("Inspection notes saved");
            setNotes("");
          }}
          className="flex flex-col gap-4"
        >
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={4}
            placeholder="e.g. Sampled 10 cartons; all quantities and finish within spec…"
            className="rounded-md border border-sand-300 bg-white px-3 py-2 text-sm text-sand-900 shadow-sm placeholder:text-sand-400 focus:ring-2 focus:ring-sand-400 focus:outline-none"
          />
          <div className="flex justify-end gap-2">
            <Button type="button" intent="neutral-outline" onClick={() => setNotesOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" intent="neutral">
              Save notes
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}