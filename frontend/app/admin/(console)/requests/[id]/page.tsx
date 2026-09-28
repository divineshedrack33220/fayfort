import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Check, Mail, ScrollText } from "lucide-react";
import type { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { Breadcrumbs } from "@/components/admin/breadcrumbs";
import { StatusPill } from "@/components/ui/status-pill";
import { LightboxGallery } from "@/components/ui/image-viewer";
import { RequestStatusUpdater } from "@/components/admin/request-status-updater";
import { formatNaira } from "@/lib/admin";
import { getAdminCustomers, getRequestById } from "@/lib/data/admin";
import {
  requestCustomerInfo,
  requestProductInfo,
  type RequestTimelineEvent,
} from "@/lib/admin-request-detail";
import { requestStatusMeta } from "@/lib/status";
import { cn } from "@/lib/utils";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const request = await getRequestById(id);
  return { title: request ? `${request.product} — ${id}` : "Request not found" };
}

export default async function AdminRequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const request = await getRequestById(id);
  if (!request) notFound();

  const customers = await getAdminCustomers();
  const previousRequests =
    customers.find((entry) => entry.name === request.customer)?.requests ?? 0;
  const customer = requestCustomerInfo(request, previousRequests);
  const product = requestProductInfo(request);
  const quote = request.quote;
  const timeline: RequestTimelineEvent[] = (request.timeline ?? []).map((stage, index) => ({
    label: stage.label,
    date: stage.state === "pending" ? "—" : request.date,
    time: "",
    admin: stage.state === "pending" ? "—" : "Fayfort team",
    notes: index === 0 && stage.state !== "pending" ? "Request received through the portal and assigned for review." : "",
    state: stage.state,
  }));

  return (
    <div className="flex flex-col gap-6 px-6 py-8 lg:px-10">
      <Breadcrumbs
        crumbs={[
          { label: "Sourcing Requests", href: "/admin/requests" },
          { label: request.id },
        ]}
      />

      {/* Workspace header */}
      <div className="flex flex-col gap-4 border-b border-sand-200 pb-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs font-semibold text-sand-500">{request.id}</span>
            <StatusPill status={request.status} variant="gray" />
          </div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-sand-950 lg:text-3xl">
            {request.product}
          </h1>
          <p className="flex items-center gap-1.5 text-sm text-sand-500">
            {request.customer} · received {request.date}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <RequestStatusUpdater requestId={request.id} current={request.status} />
          {quote ? (
            <Button intent="neutral" asChild>
              <Link href={`/admin/quotes?q=${encodeURIComponent(request.id)}`}>
                <ScrollText aria-hidden className="size-4" />
                Quote issued
              </Link>
            </Button>
          ) : (
            <Button intent="primary" asChild>
              <Link href={`/admin/quotes/new?requestId=${encodeURIComponent(request.id)}`}>
                <ScrollText aria-hidden className="size-4" />
                Create quote
              </Link>
            </Button>
          )}
          <Button intent="neutral" asChild>
            <a href={`mailto:${customer.email}?subject=${encodeURIComponent(`RE: ${request.id} — ${request.product}`)}`}>
              <Mail aria-hidden className="size-4" />
              Contact customer
            </a>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        {/* Left — customer + product */}
        <div className="flex flex-col gap-6 xl:col-span-7">
          {/* Customer info */}
          <section className="rounded-xl border border-sand-200 bg-white shadow-sm">
            <div className="border-b border-sand-200 px-5 py-4">
              <h2 className="font-display text-base font-semibold text-sand-950">
                Customer information
              </h2>
            </div>
            <dl className="grid grid-cols-1 gap-x-6 gap-y-4 px-5 py-5 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-medium text-sand-500">Customer</dt>
                <dd className="mt-0.5 text-sm font-semibold text-sand-900">{customer.name}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-sand-500">Email</dt>
                <dd className="mt-0.5 text-sm text-sand-700">{customer.email}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-sand-500">Phone</dt>
                <dd className="mt-0.5 text-sm text-sand-700">
                  {request.contactPhone || customer.phone}
                  {request.contactPhone ? (
                    <span className="ml-1.5 rounded-full bg-sand-100 px-1.5 py-0.5 text-[10px] font-medium text-sand-600">
                      from request
                    </span>
                  ) : null}
                </dd>
              </div>
              {(() => {
                const digits = (request.contactPhone || customer.phone).replace(/\D/g, "");
                if (digits.replace(/0/g, "").length === 0) return null;
                return (
                  <div>
                    <dt className="text-xs font-medium text-sand-500">
                      WhatsApp
                    </dt>
                    <dd className="mt-0.5 text-sm text-sand-700">
                      <a
                        href={`https://wa.me/${digits}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-brand-700 hover:text-brand-800"
                      >
                        Chat on WhatsApp
                      </a>
                    </dd>
                  </div>
                );
              })()}
              <div>
                <dt className="text-xs font-medium text-sand-500">Previous requests</dt>
                <dd className="mt-0.5 text-sm tabular-nums text-sand-900">
                  {customer.previousRequests}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs font-medium text-sand-500">Notes</dt>
                <dd className="mt-0.5 text-sm leading-relaxed text-sand-700">
                  {customer.notes}
                </dd>
              </div>
            </dl>
          </section>

          {/* Product info */}
          <section className="rounded-xl border border-sand-200 bg-white shadow-sm">
            <div className="border-b border-sand-200 px-5 py-4">
              <h2 className="font-display text-base font-semibold text-sand-950">
                Product information
              </h2>
            </div>
            <div className="flex flex-col gap-5 px-5 py-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="font-medium text-sand-900">{product.name}</p>
                  <p className="text-xs text-sand-500">{product.category}</p>
                </div>
                <Link
                  href={`/dashboard/${request.id}`}
                  className="inline-flex items-center gap-1 text-xs font-medium text-sand-600 hover:text-sand-900"
                >
                  Product brief <ArrowLeft aria-hidden className="size-3 rotate-180" />
                </Link>
              </div>
              {request.imageUrls && request.imageUrls.length > 0 ? (
                <LightboxGallery
                  items={request.imageUrls.filter(Boolean).map((url) => ({
                    url,
                    alt: `Customer reference photo for ${request.product}`,
                  }))}
                  label={`Customer reference photos for ${request.product}`}
                  caption={request.product}
                  className="flex flex-wrap gap-3"
                  triggerClassName="block"
                  imageClassName="max-h-56 w-auto rounded-lg border border-sand-200 object-cover"
                />
              ) : null}
              <p className="text-sm leading-relaxed text-sand-700">{product.description}</p>
              <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-3">
                <div>
                  <dt className="text-xs font-medium text-sand-500">Quantity</dt>
                  <dd className="mt-0.5 text-sm font-semibold tabular-nums text-sand-900">
                    {product.quantity.toLocaleString()} units
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-sand-500">Budget</dt>
                  <dd className="mt-0.5 text-sm font-semibold tabular-nums text-sand-900">
                    {formatNaira(product.budget)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-sand-500">Destination</dt>
                  <dd className="mt-0.5 text-sm text-sand-700">{product.destination}</dd>
                </div>
              </dl>
              <div>
                <p className="text-xs font-medium text-sand-500">Requirements</p>
                <ul className="mt-2 flex flex-col gap-2">
                  {product.requirements.map((requirement) => (
                    <li key={requirement} className="flex items-start gap-2 text-sm text-sand-700">
                      <span
                        aria-hidden
                        className="mt-1.5 size-1.5 shrink-0 rounded-full bg-sand-400"
                      />
                      {requirement}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>
        </div>

        {/* Right — timeline */}
        <section className="rounded-xl border border-sand-200 bg-white shadow-sm xl:col-span-5">
          <div className="border-b border-sand-200 px-5 py-4">
            <h2 className="font-display text-base font-semibold text-sand-950">
              Request timeline
            </h2>
            <p className="text-xs text-sand-500">
              {requestStatusMeta(request.status).description}
            </p>
          </div>
          <ol className="flex flex-col px-5 py-4">
            {timeline.map((event, index) => {
              const isLast = index === timeline.length - 1;
              return (
                <li key={event.label} className="flex gap-3">
                  <span className="flex flex-col items-center">
                    {event.state === "done" ? (
                      <Check aria-hidden className="size-5 shrink-0 text-brand-700" />
                    ) : event.state === "active" ? (
                      <span aria-hidden className="size-3 shrink-0 rounded-full bg-brand-600 ring-4 ring-brand-100" />
                    ) : (
                      <span aria-hidden className="size-2 shrink-0 rounded-full bg-sand-200 ring-4 ring-sand-100" />
                    )}
                    {!isLast ? <span className="w-px flex-1 bg-sand-200" /> : null}
                  </span>
                  <span className={cn("flex-1 pb-6", isLast && "pb-0")}>
                    <span className="flex items-baseline justify-between gap-3">
                      <span
                        className={cn(
                          "text-sm font-semibold",
                          event.state === "pending" ? "text-sand-400" : "text-sand-900",
                        )}
                      >
                        {event.label}
                      </span>
                      <span className="shrink-0 text-right text-xs tabular-nums text-sand-400">
                        {event.date}
                        {event.time ? (
                          <span className="block text-sand-400">{event.time}</span>
                        ) : null}
                      </span>
                    </span>
                    {event.state !== "pending" && event.admin ? (
                      <span className="mt-0.5 block text-xs text-sand-500">
                        by {event.admin}
                      </span>
                    ) : null}
                    {event.notes ? (
                      <span className="mt-1 block text-xs leading-relaxed text-sand-600">
                        {event.notes}
                      </span>
                    ) : null}
                  </span>
                </li>
              );
            })}
          </ol>
          {quote ? (
            <div className="border-t border-sand-200 px-5 py-4">
              <p className="text-xs font-medium text-sand-500">Quote on file</p>
              {quote.imageUrls && quote.imageUrls.length > 0 ? (
                <LightboxGallery
                  items={quote.imageUrls.filter(Boolean).map((url) => ({
                    url,
                    alt: `Product image on ${quote.id}`,
                  }))}
                  label={`Product images on ${quote.id}`}
                  caption={quote.id}
                  className="mt-2 flex flex-wrap gap-2"
                  triggerClassName="block"
                  imageClassName="max-h-24 w-auto rounded-lg border border-sand-200 object-cover"
                />
              ) : null}
              <p className="mt-1 text-sm font-semibold text-sand-900">{quote.id}</p>
              <p className="text-xs text-sand-500">
                {quote.supplier} · {quote.issuedAt}
              </p>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}