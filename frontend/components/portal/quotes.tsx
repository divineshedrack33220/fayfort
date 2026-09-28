"use client";

import { useState } from "react";
import Link from "next/link";
import { Building2, CalendarDays, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Modal, ModalTitle } from "@/components/ui/dialog";
import { StatusPill } from "@/components/ui/status-pill";
import { LightboxGallery } from "@/components/ui/image-viewer";
import { toast } from "@/components/ui/toast";
import { REFERENCE_FX_NGN_PER_USD } from "@/lib/estimate";
import {
  getPortalQuotesClient,
  normalizeQuote,
  postQuoteDecision,
  type PortalQuote,
} from "@/lib/quote-client";
import { cn } from "@/lib/utils";

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const ngn = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  maximumFractionDigits: 0,
});

const DECLINE_REASONS = [
  "Too expensive",
  "Specs don't match the brief",
  "Comparing other suppliers",
  "Changed my mind for now",
];

/** Quotes awaiting a customer decision can be approved or declined. */
function canDecide(status: PortalQuote["status"]): boolean {
  return status === "PENDING" || status === "SENT";
}

export function Quotes({ quotes }: { quotes: PortalQuote[] }) {
  const [items, setItems] = useState<PortalQuote[]>(() => quotes.map(normalizeQuote));
  const [acting, setActing] = useState<PortalQuote | null>(null);
  const [declining, setDeclining] = useState<PortalQuote | null>(null);
  const [reason, setReason] = useState(DECLINE_REASONS[0]);
  const [busy, setBusy] = useState(false);

  const replaceQuote = (updated: PortalQuote) =>
    setItems((prev) =>
      prev.map((quote) => (quote.requestId === updated.requestId ? updated : quote)),
    );

  const refresh = async () => {
    try {
      const fresh = await getPortalQuotesClient();
      setItems(fresh.filter(Boolean).map(normalizeQuote));
    } catch {
      /* keep the current list on a fetch hiccup */
    }
  };

  const handleAccept = async () => {
    if (!acting) return;
    const requestId = acting.requestId;
    const product = acting.product;
    setActing(null);
    setBusy(true);
    try {
      const updated = await postQuoteDecision(requestId, "APPROVED");
      replaceQuote(updated);
      toast.success(`Quote accepted for ${product}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not approve the quote");
    } finally {
      setBusy(false);
      void refresh();
    }
  };

  const handleDecline = async () => {
    if (!declining) return;
    const requestId = declining.requestId;
    const selected = reason;
    setDeclining(null);
    setBusy(true);
    try {
      const updated = await postQuoteDecision(requestId, "DECLINED", selected);
      replaceQuote(updated);
      toast.info(`Quote declined — ${selected.toLowerCase()}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not decline the quote");
    } finally {
      setBusy(false);
      void refresh();
    }
  };

  return (
    <div className="container-shell flex flex-col gap-5 py-6 sm:gap-6 sm:py-10">
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-2xl font-semibold tracking-tight text-brand-900 sm:text-4xl">
            Quotes
          </h1>
          <p className="text-sm text-sand-500 sm:text-base">
            Approve or decline the quotes on your sourcing requests, and review
            your full history.
          </p>
        </div>
        <Button asChild intent="accent" size="sm" className="w-full sm:w-fit">
          <Link href="/apply">
            <FileText aria-hidden className="size-4" />
            New Request
          </Link>
        </Button>
      </div>

      {items.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 px-6 py-14 text-center">
            <p className="font-display text-lg font-semibold text-brand-900">
              No quotes yet
            </p>
            <p className="max-w-md text-sm leading-relaxed text-sand-500">
              Once the team has researched your request, an itemized quote will
              appear here for you to review and approve.
            </p>
          </CardContent>
        </Card>
      ) : (
        <ul className="flex flex-col gap-4">
          {items.map((quote) => {
            const decisionable = canDecide(quote.status);
            const accepted = quote.status === "APPROVED";
            const declined = quote.status === "DECLINED";
            return (
              <li key={quote.id}>
                <Card className="overflow-hidden">
                  <div className="flex flex-col gap-3 border-b border-sand-100 p-5 sm:flex-row sm:items-start sm:justify-between sm:p-6">
                    <div className="flex flex-col gap-1">
                      <p className="font-display text-lg font-semibold text-brand-900">
                        {quote.product}
                      </p>
                      <p className="font-mono text-xs text-sand-500">
                        {quote.requestId} · {quote.id}
                      </p>
                    </div>
                    <StatusPill status={quote.status} />
                  </div>

                  <CardContent className="flex flex-col gap-5 p-5 sm:p-6">
                    {quote.imageUrls && quote.imageUrls.length > 0 ? (
                      <LightboxGallery
                        items={quote.imageUrls.filter(Boolean).map((url) => ({
                          url,
                          alt: `Product image for ${quote.product}`,
                        }))}
                        label={`Product images for ${quote.product}`}
                        caption={quote.product}
                        className="flex flex-wrap gap-3"
                        triggerClassName="block"
                        imageClassName="max-h-44 w-auto rounded-xl border border-sand-200 object-cover"
                      />
                    ) : null}

                    <dl className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                        <div className="col-span-2 flex items-center gap-4">
                          <dt className="flex items-center gap-1.5 text-sm text-sand-600">
                            <Building2 aria-hidden className="size-4" />
                            Supplier
                          </dt>
                          <dd className="text-sm font-medium text-brand-900">
                            {quote.supplier}
                          </dd>
                        </div>
                        <div className="flex min-w-0 flex-col gap-0.5">
                          <dt className="flex items-center gap-1.5 text-xs font-medium text-sand-500 sm:text-sm">
                            <CalendarDays aria-hidden className="size-4" />
                            Valid
                          </dt>
                          <dd className="text-sm text-sand-600">
                            {quote.issuedAt} – {quote.expiresAt}
                          </dd>
                        </div>
                        <div className="flex min-w-0 flex-col gap-0.5">
                          <dt className="text-xs font-medium text-sand-500 sm:text-sm">Quantity</dt>
                          <dd className="text-sm font-medium text-brand-900">
                            {quote.quantity.toLocaleString("en-US")} units
                          </dd>
                        </div>
                      </div>

                      <div className="flex w-full flex-col items-start gap-0.5 rounded-lg bg-brand-950 px-4 py-3 sm:w-auto sm:items-end">
                        <dt className="text-xs text-brand-200">
                          Quoted total ({quote.quantity.toLocaleString("en-US")} units)
                        </dt>
                        <dd className="font-display text-2xl font-semibold text-white">
                          {usd.format(quote.valueUsd)}
                        </dd>
                        <dd className="text-xs tabular-nums text-brand-300">
                          ≈ {ngn.format(Math.round(quote.valueUsd * REFERENCE_FX_NGN_PER_USD))}{" "}
                          · {usd.format(quote.valueUsd / quote.quantity)}/unit
                        </dd>
                      </div>
                    </dl>

                    {declined ? (
                      <p className="rounded-lg bg-danger-50 px-3 py-2.5 text-sm leading-relaxed text-danger-800">
                        Declined on {quote.decidedAt}
                        {quote.decisionReason
                          ? ` — “${quote.decisionReason}”. The team will revisit the brief or suggest alternatives in Chat.`
                          : ". The team will revisit the brief or suggest alternatives in Chat."}
                      </p>
                    ) : accepted ? (
                      <p className="rounded-lg bg-success-50 px-3 py-2.5 text-sm leading-relaxed text-success-800">
                        Accepted on {quote.decidedAt}. The sourcing team has been
                        notified and will confirm next steps.
                      </p>
                    ) : decisionable ? (
                      <div
                        className={cn(
                          "flex flex-col-reverse items-stretch gap-2 border-t border-sand-100 pt-5 sm:flex-row sm:items-center sm:justify-end",
                        )}
                      >
                        <Button
                          intent="danger-outline"
                          size="sm"
                          disabled={busy}
                          onClick={() => {
                            setReason(DECLINE_REASONS[0]);
                            setDeclining(quote);
                          }}
                        >
                          Decline quote
                        </Button>
                        <Button
                          intent="accent"
                          size="sm"
                          disabled={busy}
                          onClick={() => setActing(quote)}
                        >
                          Accept & continue
                        </Button>
                      </div>
                    ) : (
                      <p className="text-sm text-sand-500">
                        This quote is {quote.status.toLowerCase()}. New quotes
                        appear here as the team prepares them.
                      </p>
                    )}
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      <ConfirmDialog
        open={acting !== null}
        onOpenChange={(open) => {
          if (!open) setActing(null);
        }}
        title="Accept this quote?"
        description={
          acting
            ? `This accepts the ${usd.format(acting.valueUsd)} quote for ${acting.product}. You can still adjust details in Chat.`
            : undefined
        }
        confirmLabel="Accept quote"
        tone="primary"
        onConfirm={handleAccept}
      />

      <Modal
        open={declining !== null}
        onOpenChange={(open) => {
          if (!open) setDeclining(null);
        }}
        size="sm"
      >
        <ModalTitle>Decline quote</ModalTitle>
        <p className="text-sm text-sand-500">
          Let the team know why, so they can improve the next one.
        </p>
        <fieldset className="mt-4 flex flex-col gap-2">
          <legend className="sr-only">Decline reason</legend>
          {DECLINE_REASONS.map((option) => (
            <label
              key={option}
              className={cn(
                "flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2.5 text-sm transition-colors",
                reason === option
                  ? "border-brand-300 bg-brand-50 text-brand-900"
                  : "border-sand-200 text-sand-700 hover:border-sand-300",
              )}
            >
              <input
                type="radio"
                name="decline-reason"
                value={option}
                checked={reason === option}
                onChange={() => setReason(option)}
                className="accent-brand-600"
              />
              {option}
            </label>
          ))}
        </fieldset>
        <div className="mt-5 flex justify-end gap-2">
          <Button
            intent="outline"
            size="sm"
            onClick={() => setDeclining(null)}
          >
            Cancel
          </Button>
          <Button
            intent="danger"
            size="sm"
            disabled={busy}
            onClick={handleDecline}
          >
            Decline quote
          </Button>
        </div>
      </Modal>
    </div>
  );
}