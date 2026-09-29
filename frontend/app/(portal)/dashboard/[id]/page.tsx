import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileText, MessageSquare, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { StatusPill } from "@/components/ui/status-pill";
import { LightboxGallery } from "@/components/ui/image-viewer";
import { Reveal } from "@/components/motion/reveal";
import { QuotePanel } from "@/components/portal/quote-panel";
import { ShareDialog } from "@/components/portal/share-dialog";
import { getPortalQuotes, getPortalRequests } from "@/lib/data/portal";
import { ProductIcon } from "@/lib/product-icons";
import { REQUEST_STATUS_META, type RequestStatus } from "@/lib/status";
import { cn } from "@/lib/utils";

const naira = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  maximumFractionDigits: 0,
});

const TRACKABLE_STATUSES = new Set<RequestStatus>([
  "APPROVED",
  "IN_PROGRESS",
  "CONVERTED",
  "COMPLETED",
]);

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const requests = await getPortalRequests();
  const request = requests.find((r) => r.id === id);
  return {
    title: request ? `${request.product} — sourcing request` : "Sourcing request",
  };
}

export default async function RequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [requests, quotes] = await Promise.all([
    getPortalRequests(),
    getPortalQuotes(),
  ]);
  const request = requests.find((r) => r.id === id);
  if (!request) {
    notFound();
  }

  const quote = quotes.find((q) => q.requestId === id);

  const stages = request.timeline;
  const meta = REQUEST_STATUS_META[request.status as RequestStatus];

  return (
    <div className="container-shell flex flex-col gap-6 py-8 sm:py-10">
      <Link
        href="/dashboard"
        className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-brand-700 hover:text-brand-800"
      >
        <ArrowLeft aria-hidden className="size-4" />
        Back to My Requests
      </Link>

      <Reveal>
        <Card className="overflow-hidden">
          <div className="flex flex-col gap-4 border-b border-sand-100 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="flex items-center gap-4">
            <span
              aria-hidden
              className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-brand-50 ring-1 ring-brand-100"
            >
              <ProductIcon product={request.product} className="size-7 text-brand-600" />
            </span>
            <div className="flex items-baseline gap-2">
              <p className="truncate font-display text-lg font-semibold text-brand-900">
                {request.product}
              </p>
              <p className="shrink-0 font-mono text-xs text-sand-500">
                {request.id}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <ShareDialog label="Share" />
            <StatusPill status={request.status} />
          </div>
        </div>

        <CardContent className="flex flex-col gap-6 p-5 sm:p-6">
          {request.imageUrls && request.imageUrls.length > 0 ? (
            <LightboxGallery
              items={request.imageUrls.filter(Boolean).map((url) => ({
                url,
                alt: `Reference photo for ${request.product}`,
              }))}
              label={`Reference photos for ${request.product}`}
              caption={request.product}
              className="flex flex-wrap gap-3"
              triggerClassName="block w-full"
              imageClassName="w-full rounded-xl border border-sand-200 object-cover sm:max-h-72"
            />
          ) : null}

          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            {[
              { label: "Quantity", value: `${request.quantity.toLocaleString("en-NG")} units` },
              { label: "Budget", value: naira.format(request.budget) },
              { label: "Requested", value: request.date },
              { label: "Reference", value: request.id },
            ].map((stat) => (
              <div
                key={stat.label}
                className="rounded-lg border border-sand-200 bg-sand-50/60 px-3 py-2.5"
              >
                <dt className="text-[10px] font-semibold tracking-widest text-sand-500 uppercase">
                  {stat.label}
                </dt>
                <dd className="mt-0.5 truncate text-sm font-medium tabular-nums text-brand-900">
                  {stat.value}
                </dd>
              </div>
            ))}
          </dl>

          <div className="flex flex-col gap-3">
            <p className="text-[10px] font-semibold tracking-widest text-sand-500 uppercase">
              Progress
            </p>
            <ol
              aria-label={`Progress: ${meta.label}`}
              className="flex items-start gap-2"
            >
              {stages.map((stage, index) => (
                <li key={stage.label} className="flex flex-1 flex-col items-start gap-1.5">
                  <span className="flex w-full items-center gap-2">
                    <span
                      title={stage.label}
                      className={cn(
                        "size-2.5 shrink-0 rounded-full",
                        stage.state === "done" && "bg-brand-600",
                        stage.state === "active" &&
                          "bg-accent-500 ring-4 ring-accent-500/20",
                        stage.state === "pending" && "bg-sand-200",
                      )}
                    />
                    {index < stages.length - 1 ? (
                      <span
                        className={cn(
                          "h-px flex-1",
                          stage.state === "done" ? "bg-brand-600" : "bg-sand-200",
                        )}
                      />
                    ) : null}
                  </span>
                  <span
                    className={cn(
                      "text-xs font-medium",
                      stage.state === "pending" ? "text-sand-400" : "text-sand-700",
                    )}
                  >
                    {stage.label}
                  </span>
                </li>
              ))}
            </ol>
          </div>

          <p className="rounded-lg bg-brand-50 px-3 py-2.5 text-sm leading-relaxed text-brand-800">
            {meta.description}
          </p>

          <div className="flex flex-col-reverse items-stretch gap-2 border-t border-sand-100 pt-5 sm:flex-row sm:items-center">
            {TRACKABLE_STATUSES.has(request.status) ? (
              <Button asChild intent="secondary" size="sm">
                <Link href={`/dashboard/${request.id}/tracking`}>
                  <Truck aria-hidden className="size-4" />
                  Track shipment
                </Link>
              </Button>
            ) : null}
            <Button asChild intent="secondary" size="sm">
              <Link href="/quotes">
                <FileText aria-hidden className="size-4" />
                Review quotes
              </Link>
            </Button>
            <Button asChild intent="accent" size="sm" className="sm:ml-auto">
              <Link href={`/chat?request=${request.id}`}>
                <MessageSquare aria-hidden className="size-4" />
                Message the Fayfort team
              </Link>
            </Button>
          </div>
        </CardContent>
        </Card>
      </Reveal>

      {quote ? (
        <Reveal delay={140}>
          <QuotePanel quote={quote} />
        </Reveal>
      ) : null}
    </div>
  );
}