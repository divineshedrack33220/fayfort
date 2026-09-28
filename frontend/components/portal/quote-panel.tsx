"use client";

import { useState } from "react";
import { Building2, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Modal, ModalTitle } from "@/components/ui/dialog";
import { StatusPill } from "@/components/ui/status-pill";
import { LightboxGallery } from "@/components/ui/image-viewer";
import { toast } from "@/components/ui/toast";
import { REFERENCE_FX_NGN_PER_USD } from "@/lib/estimate";
import { normalizeQuote, postQuoteDecision, type PortalQuote } from "@/lib/quote-client";

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

function canDecide(status: PortalQuote["status"]): boolean {
  return status === "PENDING" || status === "SENT";
}

export function QuotePanel({ quote }: { quote: PortalQuote }) {
  const safe = normalizeQuote(quote);
  const [status, setStatus] = useState<PortalQuote["status"]>(safe.status);
  const [decidedAt, setDecidedAt] = useState(safe.decidedAt ?? "");
  const [decisionReason, setDecisionReason] = useState(safe.decisionReason ?? "");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [declineOpen, setDeclineOpen] = useState(false);
  const [reason, setReason] = useState(DECLINE_REASONS[0]);
  const [busy, setBusy] = useState(false);

  const accepted = status === "APPROVED";
  const declined = status === "DECLINED";
  const decisionable = canDecide(status);

  const handleAccept = async () => {
    setConfirmOpen(false);
    setBusy(true);
    try {
      const updated = await postQuoteDecision(safe.requestId, "APPROVED");
      setStatus(updated.status);
      if (updated.decidedAt) setDecidedAt(updated.decidedAt);
      toast.success(`Quote accepted for ${safe.product}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not approve the quote");
    } finally {
      setBusy(false);
    }
  };

  const handleDecline = async () => {
    const selected = reason;
    setDeclineOpen(false);
    setBusy(true);
    try {
      const updated = await postQuoteDecision(safe.requestId, "DECLINED", selected);
      setStatus(updated.status);
      if (updated.decidedAt) setDecidedAt(updated.decidedAt);
      setDecisionReason(updated.decisionReason ?? selected);
      toast.info(`Quote declined — ${selected.toLowerCase()}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not decline the quote");
    } finally {
      setBusy(false);
    }
  };

  const perUnit = safe.valueUsd / safe.quantity;

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col gap-2 border-b border-sand-100 p-5 sm:flex-row sm:items-start sm:justify-between sm:p-6">
        <div className="flex flex-col gap-1">
          <p className="font-display text-lg font-semibold text-brand-900">
            Quoted price
          </p>
          <p className="text-sm text-sand-500">
            {safe.product} · {safe.quantity.toLocaleString("en-US")} units ·
            {safe.id}
          </p>
        </div>
        <StatusPill status={status} />
      </div>

      <CardContent className="flex flex-col gap-6 p-5 sm:p-6">
        {safe.imageUrls && safe.imageUrls.length > 0 ? (
          <LightboxGallery
            items={safe.imageUrls.filter(Boolean).map((url) => ({
              url,
              alt: `Product image for ${safe.product}`,
            }))}
            label={`Product images for ${safe.product}`}
            caption={safe.product}
            className="flex flex-wrap gap-3"
            triggerClassName="block"
            imageClassName="max-h-56 w-auto rounded-xl border border-sand-200 object-cover"
          />
        ) : null}

        <dl className="flex flex-col">
          <div className="flex items-center justify-between gap-3 border-b border-sand-100 py-2">
            <dt className="flex items-center gap-1.5 text-sm text-sand-600">
              <Building2 aria-hidden className="size-4" />
              Supplier
            </dt>
            <dd className="text-sm font-medium text-brand-900">{safe.supplier}</dd>
          </div>
          <div className="flex items-center justify-between gap-3 border-b border-sand-100 py-2">
            <dt className="flex items-center gap-1.5 text-sm text-sand-600">
              <CalendarDays aria-hidden className="size-4" />
              Valid
            </dt>
            <dd className="text-sm text-sand-600">
              {safe.issuedAt} – {safe.expiresAt}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3 border-b border-sand-100 py-2">
            <dt className="text-sm text-sand-600">Quantity</dt>
            <dd className="text-sm font-medium text-brand-900">
              {safe.quantity.toLocaleString("en-US")} units
            </dd>
          </div>
          <div className="flex items-end justify-between gap-3 rounded-lg bg-brand-950 px-4 py-3.5">
            <dt className="text-sm font-medium text-brand-200">
              Quoted total
            </dt>
            <dd className="flex flex-col items-end">
              <span className="font-display text-lg font-semibold text-white">
                {usd.format(safe.valueUsd)}
              </span>
              <span className="text-xs tabular-nums text-brand-300">
                ≈ {ngn.format(Math.round(safe.valueUsd * REFERENCE_FX_NGN_PER_USD))} ·{" "}
                {usd.format(perUnit)}/unit
              </span>
            </dd>
          </div>
        </dl>

        <p className="text-xs leading-relaxed text-sand-400">
          ≈ {usd.format(perUnit)} per unit at the reference FX rate of{" "}
          {REFERENCE_FX_NGN_PER_USD.toLocaleString("en-US")} ₦/$ — indicative
          only, confirmed on booking.
        </p>

        {decisionable ? (
          <div className="flex flex-col-reverse items-stretch gap-2 border-t border-sand-100 pt-5 sm:flex-row sm:items-center sm:justify-end">
            <Button
              intent="danger-outline"
              size="sm"
              disabled={busy}
              onClick={() => setDeclineOpen(true)}
            >
              Decline quote
            </Button>
            <Button
              intent="accent"
              size="sm"
              disabled={busy}
              onClick={() => setConfirmOpen(true)}
            >
              Accept & continue
            </Button>
          </div>
        ) : accepted ? (
          <p className="rounded-lg bg-success-50 px-3 py-2.5 text-sm leading-relaxed text-success-800">
            Quote accepted on {decidedAt}. The sourcing team has been notified
            and will confirm next steps.
          </p>
        ) : declined ? (
          <p className="rounded-lg bg-danger-50 px-3 py-2.5 text-sm leading-relaxed text-danger-800">
            Quote declined on {decidedAt}
            {decisionReason ? ` — “${decisionReason}”` : ""}. The team will
            revisit the brief or suggest alternatives in Chat.
          </p>
        ) : (
          <p className="text-sm text-sand-500">
            This quote is {status.toLowerCase()}. We’ll follow up with an updated
            quote here as soon as it’s ready.
          </p>
        )}
      </CardContent>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Accept this quote?"
        description={`This accepts the ${usd.format(safe.valueUsd)} quote for ${safe.requestId}. You can still adjust details in Chat.`}
        confirmLabel="Accept quote"
        tone="primary"
        onConfirm={handleAccept}
      />

      <Modal open={declineOpen} onOpenChange={setDeclineOpen} size="sm">
        <ModalTitle>Decline quote</ModalTitle>
        <p className="text-sm text-sand-500">
          Let the team know why, so they can improve the next one.
        </p>
        <fieldset className="mt-4 flex flex-col gap-2">
          <legend className="sr-only">Decline reason</legend>
          {DECLINE_REASONS.map((option) => (
            <label
              key={option}
              className={
                reason === option
                  ? "flex cursor-pointer items-center gap-2 rounded-lg border border-brand-300 bg-brand-50 px-3 py-2.5 text-sm text-brand-900 transition-colors"
                  : "flex cursor-pointer items-center gap-2 rounded-lg border border-sand-200 px-3 py-2.5 text-sm text-sand-700 transition-colors hover:border-sand-300"
              }
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
          <Button intent="outline" size="sm" onClick={() => setDeclineOpen(false)}>
            Cancel
          </Button>
          <Button intent="danger" size="sm" disabled={busy} onClick={handleDecline}>
            Decline quote
          </Button>
        </div>
      </Modal>
    </Card>
  );
}