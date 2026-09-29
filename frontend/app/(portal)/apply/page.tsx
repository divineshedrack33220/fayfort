import type { Metadata } from "next";
import { FilePlus2 } from "lucide-react";
import { RequestForm } from "@/components/portal/request-form";

export const metadata: Metadata = {
  title: "File a sourcing request — Fayfort",
  description:
    "Share what you want to source and Fayfort will find verified suppliers, negotiate pricing and confirm the real landed cost before you pay anything.",
};

export default function ApplyPage() {
  return (
    <div className="container-shell flex flex-col gap-6 py-8 sm:py-10">
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 ring-1 ring-brand-100">
            <FilePlus2 aria-hidden className="size-6 text-brand-600" />
          </span>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-sand-950">
            File a sourcing request
          </h1>
        </div>
        <p className="max-w-2xl text-sm leading-relaxed text-sand-500">
          Tell us what you want to source, your target economics and attach a
          reference photo. The team picks it up right away — you can track
          progress in My Requests.
        </p>
      </div>

      <RequestForm />
    </div>
  );
}