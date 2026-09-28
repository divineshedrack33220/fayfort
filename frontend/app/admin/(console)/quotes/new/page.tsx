import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/admin/breadcrumbs";
import { QuoteBuilder, type QuoteBuilderRequest } from "@/components/admin/quote-builder";
import { getRequestById } from "@/lib/data/admin";

export const metadata: Metadata = { title: "New quote" };

export default async function AdminQuoteBuilderPage({
  searchParams,
}: {
  searchParams: Promise<{ requestId?: string }>;
}) {
  const params = await searchParams;
  const request = params.requestId ? await getRequestById(params.requestId) : null;

  const budgetUsd = request ? Math.round((request.budget / 1580) / 10) * 10 : 0;

  return (
    <div className="flex flex-col gap-6 px-6 py-8 lg:px-10">
      <Breadcrumbs
        crumbs={[
          { label: "Quotes", href: "/admin/quotes" },
          { label: "New quote" },
        ]}
      />
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-2xl font-semibold tracking-tight text-sand-950">
          Create quote
        </h1>
        <p className="text-sm text-sand-500">
          Build the landed-cost estimate from supplier pricing and freight. Totals update as you edit.
        </p>
      </div>

      {request ? (
        <QuoteBuilder
          request={{
            requestId: request.id,
            product: request.product,
            customer: request.customer,
            quantity: request.quantity,
            currency: request.currency,
            budgetUsd,
          } satisfies QuoteBuilderRequest}
        />
      ) : (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-sand-300 bg-white px-6 py-14 text-center">
          <p className="text-sm font-medium text-sand-800">Select a sourcing request</p>
          <p className="max-w-sm text-sm text-sand-500">
            Quotes are built from a sourcing request so the product, quantity and budget are pre-filled.
            Choose a request from the queue to start.
          </p>
          <Link
            href="/admin/requests"
            className="inline-flex items-center gap-1.5 rounded-md border border-sand-300 bg-white px-3 py-2 text-sm font-medium text-sand-700 shadow-sm transition-colors hover:bg-sand-50"
          >
            <ArrowLeft aria-hidden className="size-4" />
            Open sourcing queue
          </Link>
        </div>
      )}
    </div>
  );
}