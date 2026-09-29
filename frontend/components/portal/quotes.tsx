"use client";

import { useState } from "react";
import Link from "next/link";
import { Building2, CalendarDays, ChevronDown, FileText } from "lucide-react";
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

function unitPrice(quote: PortalQuote): string {
  return usd.format(quote.valueUsd / quote.quantity);
}

export function Quotes({ quotes }: { quotes: PortalQuote[] }) {
  const [items, setItems] = useState<PortalQuote[]>(() => quotes.map(normalizeQuote));
  const [acting, setActing] = useState<PortalQuote | null>(null);
  const [declining, setDeclining] = useState<PortalQuote | null>(null);
  const [reason, setReason] = useState(DECLINE_REASONS[0]);
  const [busy, setBusy] = useState(false);
  const [segment, setSegment] = useState<"action" | "history">("action");
  const [expandedId, setExpandedId] = useState<string | null>(null);

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
      setExpandedId(updated.id);
      setSegment("history");
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
      setExpandedId(updated.id);
      setSegment("history");
      toast.info(`Quote declined — ${selected.toLowerCase()}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not decline the quote");
    } finally {
      setBusy(false);
      void refresh();
    }
  };

  const actionItems = items.filter((quote) => canDecide(quote.status));
  const historyItems = items.filter((quote) => !canDecide(quote.status));
  const visible = segment === "action" ? actionItems : historyItems;

  const segmentButton = (value: "action" | "history", label: string, count: number) => (
    <button
      type="button"
      aria-pressed={segment === value}
      onClick={() => setSegment(value)}
      className={cn(
        "flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors sm:flex-initial",
        segment === value
          ? "text-brand-900 bg-white shadow-sm"
          : "text-sand-500 hover:text-brand-800",
      )}
    >
      {label}
      {count > 0 ? (
        <span className="bg-accent-600 rounded-full px-1.5 py-0.5 text-[10px] leading-none font-bold text-white tabular-nums">
          {count}
        </span>
      ) : null}
    </button>
  );

  return (
    <div className="container-shell flex flex-col gap-4 py-4 sm:gap-6 sm:py-10">
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="font-display text-brand-900 text-xl font-semibold tracking-tight sm:text-4xl">
            Quotes
          </h1>
          <p className="text-sand-500 text-sm sm:text-base">
            Approve or decline the quotes on your sourcing requests, and review your full history.
          </p>
        </div>
        <Button asChild intent="accent" size="sm" className="w-full sm:w-fit">
          <Link href="/apply">
            <FileText aria-hidden className="size-4" />
            New Request
          </Link>
        </Button>
      </div>

      <div className="bg-sand-200/70 flex gap-1 rounded-xl p-1">
        {segmentButton("action", "Action needed", actionItems.length)}
        {segmentButton("history", "History", historyItems.length)}
      </div>

      {visible.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 px-6 py-14 text-center">
            <p className="font-display text-brand-900 text-lg font-semibold">
              {segment === "action" ? "You're all caught up" : "Nothing here yet"}
            </p>
            <p className="text-sand-500 max-w-md text-sm leading-relaxed">
              {segment === "action"
                ? "No quotes are waiting on a decision. New quotes will land here as the team prepares them."
                : "Quotes you approve or decline will show up here as your history."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <ul className="flex flex-col gap-4">
          {visible.map((quote) => {
            const decisionable = canDecide(quote.status);
            const accepted = quote.status === "APPROVED";
            const declined = quote.status === "DECLINED";
            const expanded = expandedId === quote.id || (decisionable && expandedId === null);
            return (
              <li key={quote.id}>
                <Card className="overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setExpandedId(expanded ? null : quote.id)}
                    aria-expanded={expanded}
                    className="hover:bg-sand-50/60 flex w-full items-center gap-3 bg-white px-4 py-4 text-left transition-colors sm:px-6"
                  >
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="font-display text-brand-900 truncate text-[15px] font-semibold">
                        {quote.product}
                      </span>
                      <span className="text-sand-500 truncate font-mono text-[11px]">
                        {quote.requestId}
                      </span>
                    </span>
                    <span className="flex shrink-0 flex-col items-end gap-1">
                      <StatusPill status={quote.status} />
                      <span className="flex flex-col items-end">
                        <span className="font-display text-brand-900 text-xl font-semibold tracking-tight">
                          {usd.format(quote.valueUsd)}
                        </span>
                        <span className="text-sand-400 text-[10px] tabular-nums">
                          ≈ {ngn.format(Math.round(quote.valueUsd * REFERENCE_FX_NGN_PER_USD))}
                        </span>
                      </span>
                    </span>
                    <ChevronDown
                      aria-hidden
                      className={cn(
                        "text-sand-400 size-4 shrink-0 transition-transform",
                        expanded && "rotate-180",
                      )}
                    />
                  </button>

                  {expanded ? (
                    <CardContent className="border-sand-100 flex flex-col gap-5 border-t p-4 sm:gap-6 sm:p-6">
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

                      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                        <div className="flex min-w-0 items-center gap-4">
                          <dt className="text-sand-600 flex items-center gap-1.5">
                            <Building2 aria-hidden className="size-4" />
                            Supplier
                          </dt>
                          <dd className="text-brand-900 min-w-0 truncate font-medium">
                            {quote.supplier}
                          </dd>
                        </div>
                        <div className="flex min-w-0 flex-col gap-0.5">
                          <dt className="text-sand-500 text-xs font-medium">Quantity</dt>
                          <dd className="text-brand-900 font-medium">
                            {quote.quantity.toLocaleString("en-US")} units
                          </dd>
                        </div>
                        <div className="flex min-w-0 flex-col gap-0.5">
                          <dt className="text-sand-500 text-xs font-medium">Unit price</dt>
                          <dd className="text-brand-900 font-medium">{unitPrice(quote)}</dd>
                        </div>
                        <div className="col-span-2 flex items-center gap-4">
                          <dt className="text-sand-500 flex items-center gap-1.5 text-xs font-medium">
                            <CalendarDays aria-hidden className="size-4" />
                            Valid
                          </dt>
                          <dd className="text-sand-600">
                            {quote.issuedAt} – {quote.expiresAt}
                          </dd>
                        </div>
                      </dl>

                      {declined ? (
                        <p className="bg-danger-50 text-danger-800 rounded-lg px-3 py-2.5 text-sm leading-relaxed">
                          Declined on {quote.decidedAt}
                          {quote.decisionReason
                            ? ` — "${quote.decisionReason}". The team will revisit the brief or suggest alternatives in Chat.`
                            : ". The team will revisit the brief or suggest alternatives in Chat."}
                        </p>
                      ) : accepted ? (
                        <p className="bg-success-50 text-success-800 rounded-lg px-3 py-2.5 text-sm leading-relaxed">
                          Accepted on {quote.decidedAt}. The sourcing team has been notified and
                          will confirm next steps.
                        </p>
                      ) : decisionable ? (
                        <div className="border-sand-100 flex flex-col-reverse items-stretch gap-2 border-t pt-5 sm:flex-row sm:items-center sm:justify-end">
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
                        <p className="text-sand-500 text-sm">
                          This quote is {quote.status.toLowerCase()}. New quotes appear here as the
                          team prepares them.
                        </p>
                      )}
                    </CardContent>
                  ) : null}
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
        <p className="text-sand-500 text-sm">
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
          <Button intent="outline" size="sm" onClick={() => setDeclining(null)}>
            Cancel
          </Button>
          <Button intent="danger" size="sm" disabled={busy} onClick={handleDecline}>
            Decline quote
          </Button>
        </div>
      </Modal>
    </div>
  );
}
