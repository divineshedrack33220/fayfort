"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Printer, Eye, Send, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/dialog";
import { LightboxGallery } from "@/components/ui/image-viewer";
import { ImageUploader } from "@/components/ui/image-uploader";
import { issueQuoteToRequest } from "@/app/admin/(console)/quotes/new/actions";
import { cn } from "@/lib/utils";

export interface QuoteBuilderRequest {
  requestId: string;
  product: string;
  customer: string;
  quantity: number;
  currency: string;
  budgetUsd: number;
}

interface CostRow {
  key: string;
  label: string;
  hint: string;
}

const COST_ROWS: CostRow[] = [
  { key: "productCost", label: "Product cost", hint: "FOB factory price for the full quantity" },
  { key: "domesticShipping", label: "China domestic shipping", hint: "Truck / rail to the port of loading" },
  { key: "inspection", label: "Inspection", hint: "Pre-shipment inspection at the factory" },
  { key: "packaging", label: "Packaging", hint: "Export cartons, pallets and labelling" },
  { key: "serviceFee", label: "Fayfort service fee", hint: "Handling, sourcing and coordination" },
  { key: "freight", label: "International freight", hint: "Ocean / air freight to destination" },
  { key: "customs", label: "Customs / other", hint: "Duties, clearance and port charges" },
  { key: "additional", label: "Additional charges", hint: "Sample runs, rush fees, amendments" },
];

const usd = (value: number): string =>
  value.toLocaleString("en-US", { style: "currency", currency: "USD" });

interface QuoteDraft {
  costs: Record<string, number>;
  customerPrice: number;
  supplier: string;
  productImages: string[];
}

const draftKey = (requestId: string) => `fayfort:quote-draft:${requestId}`;

/**
 * Drafts live in localStorage only — there is no quote-draft endpoint yet.
 * Read as an external store so the server render never sees a draft and the
 * client can offer to restore one without an effect cascade.
 */
const draftMemo = new Map<string, { raw: string | null; value: QuoteDraft | null }>();

function parseDraft(raw: string | null): QuoteDraft | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as QuoteDraft;
    return parsed && typeof parsed.customerPrice === "number" && parsed.costs ? parsed : null;
  } catch {
    return null;
  }
}

function useStoredDraft(requestId: string): QuoteDraft | null {
  return React.useSyncExternalStore(
    () => () => {}, // no subscription: drafts change only through this component
    () => {
      const raw = window.localStorage.getItem(draftKey(requestId));
      const cached = draftMemo.get(requestId);
      if (cached && cached.raw === raw) return cached.value;
      const value = parseDraft(raw);
      draftMemo.set(requestId, { raw, value });
      return value;
    },
    () => null, // server snapshot — never touches the client store
  );
}

function writeDraft(requestId: string, draft: QuoteDraft): boolean {
  try {
    window.localStorage.setItem(draftKey(requestId), JSON.stringify(draft));
    draftMemo.delete(requestId);
    return true;
  } catch {
    return false;
  }
}

function clearDraft(requestId: string) {
  draftMemo.delete(requestId);
  try {
    window.localStorage.removeItem(draftKey(requestId));
  } catch {
    // Nothing to do: a blocked store simply keeps the draft.
  }
}

export function QuoteBuilder({ request }: { request: QuoteBuilderRequest }) {
  const router = useRouter();
  const defaults = React.useMemo(() => {
    const productCost = Math.round((request.budgetUsd * 0.48) / 10) * 10;
    return {
      productCost,
      domesticShipping: Math.round((40 + productCost * 0.012) / 10) * 10,
      inspection: Math.round((90 + productCost * 0.008) / 10) * 10,
      packaging: Math.round((25 + productCost * 0.015) / 10) * 10,
      serviceFee: Math.round((60 + productCost * 0.05) / 10) * 10,
      freight: Math.round((120 + productCost * 0.06) / 10) * 10,
      customs: Math.round((80 + productCost * 0.02) / 10) * 10,
      additional: 0,
    };
  }, [request.budgetUsd]);

  const [costs, setCosts] = React.useState<Record<string, number>>(defaults);
  const [customerPrice, setCustomerPrice] = React.useState<number>(
    Math.round((Object.values(defaults).reduce((sum, value) => sum + value, 0) * 1.15) / 10) * 10,
  );
  const [supplier, setSupplier] = React.useState("To be confirmed");
  const [productImages, setProductImages] = React.useState<string[]>([]);
  const [sending, setSending] = React.useState(false);
  const [previewOpen, setPreviewOpen] = React.useState(false);
  const [showErrors, setShowErrors] = React.useState(false);
  const [draftDismissed, setDraftDismissed] = React.useState(false);
  const storedDraft = useStoredDraft(request.requestId);
  const summaryRef = React.useRef<HTMLDivElement | null>(null);
  const [failedSubmits, setFailedSubmits] = React.useState(0);

  // Move focus to the summary after it has rendered, so keyboard and screen
  // reader users land on what just blocked them.
  React.useEffect(() => {
    if (failedSubmits > 0) summaryRef.current?.focus();
  }, [failedSubmits]);

  const totalCost = Object.values(costs).reduce((sum, value) => sum + value, 0);
  const costPerUnit = request.quantity > 0 ? totalCost / request.quantity : 0;
  const margin = customerPrice - totalCost;
  const marginPct = customerPrice > 0 ? (margin / customerPrice) * 100 : 0;
  const marginBps = Math.round(marginPct * 100);

  const issues = React.useMemo(() => {
    const found: { field: "supplier" | "costs" | "customerPrice"; message: string }[] = [];
    if (!supplier.trim()) {
      found.push({ field: "supplier", message: "Name the supplier, or keep “To be confirmed”." });
    }
    if (totalCost <= 0) {
      found.push({ field: "costs", message: "Add at least one cost component — there is nothing to quote against." });
    }
    if (customerPrice <= 0) {
      found.push({ field: "customerPrice", message: "Enter a customer price above zero." });
    } else if (totalCost > 0 && customerPrice < totalCost) {
      found.push({
        field: "customerPrice",
        message: `${usd(customerPrice)} is below the ${usd(totalCost)} landed cost — that is a ${usd(totalCost - customerPrice)} loss.`,
      });
    }
    return found;
  }, [supplier, totalCost, customerPrice]);

  const errorFor = (field: "supplier" | "costs" | "customerPrice") =>
    showErrors ? (issues.find((issue) => issue.field === field)?.message ?? null) : null;

  const handleSendQuote = async () => {
    if (sending) return;
    if (issues.length > 0) {
      setShowErrors(true);
      setFailedSubmits((count) => count + 1);
      return;
    }
    setSending(true);
    const result = await issueQuoteToRequest({
      requestId: request.requestId,
      product: request.product,
      customer: request.customer,
      supplier,
      valueUsd: customerPrice,
      marginBps,
      imageUrls: productImages,
    });
    setSending(false);
    if (!result.ok) {
      toast.error(result.error ?? "Could not send the quote.");
      return;
    }
    clearDraft(request.requestId);
    toast.success(`Quote ${result.quoteId} issued for ${request.requestId}`);
    router.push(`/admin/requests/${request.requestId}`);
  };

  const saveDraft = () => {
    if (writeDraft(request.requestId, { costs, customerPrice, supplier, productImages })) {
      setDraftDismissed(true);
      toast.success("Draft saved on this device");
    } else {
      toast.error("This browser blocked local storage, so the draft was not saved.");
    }
  };

  const restoreDraft = () => {
    if (!storedDraft) return;
    setCosts({ ...defaults, ...storedDraft.costs });
    setCustomerPrice(storedDraft.customerPrice);
    setSupplier(storedDraft.supplier);
    setProductImages(storedDraft.productImages);
    setDraftDismissed(true);
    toast.success("Draft restored");
  };

  const setCost = (key: string, raw: string) => {
    setCosts((prev) => ({ ...prev, [key]: Math.max(0, Number(raw) || 0) }));
  };

  const rows = COST_ROWS.map((row) => ({ ...row, value: costs[row.key] ?? 0 }));

  return (
    <div className="flex flex-col gap-6">
      {showErrors && issues.length > 0 ? (
        <div
          ref={summaryRef}
          tabIndex={-1}
          role="alert"
          className="rounded-xl border border-danger-200 bg-danger-50/60 px-5 py-4 focus:outline-none"
        >
          <p className="text-sm font-semibold text-danger-700">
            Fix {issues.length} {issues.length === 1 ? "problem" : "problems"} before sending
          </p>
          <ul className="mt-2 flex list-disc flex-col gap-1 pl-5 text-sm text-danger-700">
            {issues.map((issue) => (
              <li key={issue.field + issue.message}>{issue.message}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {storedDraft && !draftDismissed ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand-200 bg-brand-50 px-5 py-3">
          <p className="text-sm text-brand-800">
            A draft for this request is saved on this device.
          </p>
          <div className="flex gap-2">
            <Button
              intent="neutral-outline"
              size="sm"
              onClick={() => setDraftDismissed(true)}
            >
              Keep current values
            </Button>
            <Button intent="primary" size="sm" onClick={restoreDraft}>
              Restore draft
            </Button>
          </div>
        </div>
      ) : null}

      {/* Product summary */}
      <section className="rounded-xl border border-sand-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-medium text-sand-500">Preparing a quote for</p>
        <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between">
          <div>
            <p className="font-display text-lg font-semibold text-sand-950">{request.product}</p>
            <p className="text-sm text-sand-500">
              {request.requestId} · {request.customer}
            </p>
          </div>
          <p className="text-sm text-sand-600">
            {request.quantity.toLocaleString()} units · {request.currency}
          </p>
        </div>
        <div className="mt-4 flex flex-col gap-1.5 border-t border-sand-100 pt-4">
          <label htmlFor="quote-supplier" className="text-sm font-medium text-sand-700">
            Supplier
          </label>
          <input
            id="quote-supplier"
            type="text"
            value={supplier}
            onChange={(event) => setSupplier(event.target.value)}
            placeholder="e.g. Shenzhen AmpCore Electronics"
            aria-invalid={errorFor("supplier") ? true : undefined}
            aria-describedby={errorFor("supplier") ? "quote-supplier-error" : undefined}
            className="h-10 w-full max-w-md rounded-md border border-sand-300 bg-white px-3 text-sm text-sand-900 shadow-sm transition-colors placeholder:text-sand-400 focus:ring-2 focus:ring-sand-400 focus:outline-none"
          />
          {errorFor("supplier") ? (
            <p id="quote-supplier-error" className="text-xs font-medium text-danger-600">
              {errorFor("supplier")}
            </p>
          ) : null}
        </div>
        <div className="mt-4 border-t border-sand-100 pt-4">
          <ImageUploader
            value={productImages}
            onChange={setProductImages}
            label="Product images"
            hint="Attach the supplier photos or reference images the customer will see on the quote."
          />
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        {/* Cost components */}
        <section className="rounded-xl border border-sand-200 bg-white shadow-sm xl:col-span-7">
          <div className="border-b border-sand-200 px-5 py-4">
            <h2 className="font-display text-base font-semibold text-sand-950">
              Cost components
            </h2>
            <p className="text-xs text-sand-500">
              Landed-cost breakdown. Adjust each line to reflect the supplier quote and freight.
            </p>
          </div>
          <ul className="flex flex-col px-5 py-3">
            {rows.map((row) => (
              <li
                key={row.key}
                className="flex flex-col gap-1 border-b border-sand-100 py-3 last:border-0 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <label
                    htmlFor={`cost-${row.key}`}
                    className="block text-sm font-medium text-sand-800"
                  >
                    {row.label}
                  </label>
                  <p className="text-xs text-sand-400">{row.hint}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-sand-400">USD</span>
                  <input
                    id={`cost-${row.key}`}
                    type="number"
                    min={0}
                    step={10}
                    value={row.value}
                    onChange={(event) => setCost(row.key, event.target.value)}
                    className="h-9 w-40 rounded-md border border-sand-300 bg-white px-3 text-right text-sm font-medium tabular-nums text-sand-900 shadow-sm focus:ring-2 focus:ring-sand-400 focus:outline-none"
                  />
                </div>
              </li>
            ))}
          </ul>
          <div className="flex items-center justify-between gap-4 border-t border-sand-200 bg-sand-50 px-5 py-4">
            <p className="text-sm font-semibold text-sand-900">Total estimated cost</p>
            <p className="font-display text-xl font-semibold tabular-nums text-sand-950">
              {usd(totalCost)}
            </p>
          </div>
          {errorFor("costs") ? (
            <p className="border-t border-danger-200 bg-danger-50 px-5 py-3 text-xs font-medium text-danger-600">
              {errorFor("costs")}
            </p>
          ) : null}
        </section>

        {/* Totals + actions */}
        <section className="flex flex-col gap-4 xl:col-span-5">
          <div className="rounded-xl border border-sand-200 bg-white p-5 shadow-sm">
            <h2 className="font-display text-base font-semibold text-sand-950">Pricing</h2>
            <div className="mt-4 flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="customer-price" className="text-sm font-medium text-sand-700">
                  Customer price
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-sand-400">USD</span>
                  <input
                    id="customer-price"
                    type="number"
                    min={0}
                    step={10}
                    value={customerPrice}
                    onChange={(event) =>
                      setCustomerPrice(Math.max(0, Number(event.target.value) || 0))
                    }
                    aria-invalid={errorFor("customerPrice") ? true : undefined}
                    aria-describedby={errorFor("customerPrice") ? "customer-price-error" : undefined}
                    className="h-10 w-full rounded-md border border-sand-300 bg-white px-3 text-right text-base font-semibold tabular-nums text-sand-950 shadow-sm focus:ring-2 focus:ring-sand-400 focus:outline-none"
                  />
                </div>
                {errorFor("customerPrice") ? (
                  <p id="customer-price-error" className="text-xs font-medium text-danger-600">
                    {errorFor("customerPrice")}
                  </p>
                ) : null}
              </div>
              <dl className="flex flex-col gap-2 border-t border-sand-100 pt-4 text-sm">
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-sand-500">Total estimated cost</dt>
                  <dd className="font-semibold tabular-nums text-sand-900">{usd(totalCost)}</dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-sand-500">Cost per unit</dt>
                  <dd className="font-semibold tabular-nums text-sand-900">
                    {usd(costPerUnit)}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-sand-500">Estimated margin</dt>
                  <dd
                    className={cn(
                      "tabular-nums text-sand-900",
                      margin < 0 && "font-semibold text-danger-600",
                    )}
                  >
                    {usd(margin)}
                    <span className="ml-1.5 text-sand-500">({marginPct.toFixed(1)}%)</span>
                  </dd>
                </div>
              </dl>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button intent="neutral-outline" className="flex-1" onClick={saveDraft}>
              <Save aria-hidden className="size-4" />
              Save draft
            </Button>
            <Button intent="neutral" className="flex-1" onClick={() => setPreviewOpen(true)}>
              <Eye aria-hidden className="size-4" />
              Preview quote
            </Button>
            <Button
              intent="primary"
              className="flex-1"
              onClick={handleSendQuote}
              loading={sending}
              disabled={sending}
            >
              <Send aria-hidden className="size-4" />
              {sending ? "Sending…" : "Send quote"}
            </Button>
          </div>
        </section>
      </div>

      {/* Quote preview document */}
      <Modal
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        title={`Quote preview — ${request.requestId}`}
        description="Professional quote document as the customer will see it."
        size="lg"
      >
        <div
          data-quote-print
          className="rounded-lg border border-sand-300 bg-white p-6"
        >
          <div className="flex items-start justify-between border-b border-sand-200 pb-5">
            <div>
              <p className="font-display text-2xl font-semibold tracking-tight text-sand-950">
                FAYFORT
              </p>
              <p className="text-xs text-sand-500">
                Sourcing · Inspection · Logistics
              </p>
            </div>
            <div className="text-right text-sm">
              <p className="font-mono text-xs font-semibold text-sand-500">Q-{request.requestId}</p>
              <p className="text-sand-600">{request.product}</p>
            </div>
          </div>
          {productImages.filter(Boolean).length > 0 ? (
            <LightboxGallery
              items={productImages.filter(Boolean).map((url) => ({
                url,
                alt: `Product image for ${request.product}`,
              }))}
              label={`Product images for ${request.product}`}
              caption={request.product}
              className="mt-5 flex flex-wrap gap-3"
              triggerClassName="block"
              imageClassName="max-h-44 w-auto rounded-lg border border-sand-200 object-cover"
            />
          ) : null}
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 py-5 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-xs font-medium text-sand-500">Prepared for</dt>
              <dd className="mt-0.5 text-sand-800">{request.customer}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-sand-500">Reference</dt>
              <dd className="mt-0.5 text-sand-800">{request.requestId}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-sand-500">Quantity</dt>
              <dd className="mt-0.5 text-sand-800 tabular-nums">
                {request.quantity.toLocaleString()} units
              </dd>
            </div>
          </dl>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-sand-200 text-left text-xs text-sand-500 uppercase">
                <th className="py-2 font-medium">Component</th>
                <th className="py-2 text-right font-medium">USD</th>
              </tr>
            </thead>
            <tbody>
              {COST_ROWS.map((row) => (
                <tr key={row.key} className="border-b border-sand-100">
                  <td className="py-2 text-sand-700">{row.label}</td>
                  <td className="py-2 text-right tabular-nums text-sand-800">
                    {usd(costs[row.key] ?? 0)}
                  </td>
                </tr>
              ))}
              <tr className="border-b border-sand-200">
                <td className="py-2.5 font-semibold text-sand-900">Total estimated cost</td>
                <td className="py-2.5 text-right font-semibold tabular-nums text-sand-900">
                  {usd(totalCost)}
                </td>
              </tr>
              <tr>
                <td className="py-2.5 font-semibold text-sand-900">Customer price</td>
                <td className="py-2.5 text-right font-semibold tabular-nums text-sand-900">
                  {usd(customerPrice)}
                </td>
              </tr>
            </tbody>
          </table>
          <div className="mt-5 flex items-center justify-between border-t border-sand-200 pt-4">
            <p className="text-xs text-sand-500">
              Valid for 14 days · Freight terms DDP to destination port
            </p>
            <p className="text-xs text-sand-400">Issued by Fayfort Admin</p>
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <Button intent="neutral-outline" onClick={() => window.print()}>
            <Printer aria-hidden className="size-4" />
            Print / save as PDF
          </Button>
        </div>
      </Modal>
    </div>
  );
}