import Link from "next/link";
import { FileText, Plus } from "lucide-react";
import type { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/ui/status-pill";
import { LightboxTrigger } from "@/components/ui/image-viewer";
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeadCell,
  TableRow,
} from "@/components/ui/table";
import { ListToolbar } from "@/components/admin/list-toolbar";
import { DetailTriggerRow } from "@/components/admin/detail-row";
import { formatUsd } from "@/lib/admin";
import { getAdminQuotes } from "@/lib/data/admin";
import { QUOTE_STATUSES, quoteStatusMeta } from "@/lib/status";

export const metadata: Metadata = { title: "Quotes" };

export default async function AdminQuotesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const params = await searchParams;
  const query = (params.q ?? "").trim().toLowerCase();
  const activeStatus = (QUOTE_STATUSES as readonly string[]).includes(params.status ?? "")
    ? params.status!
    : null;

  const quotes = await getAdminQuotes();
  const rows = quotes.filter((quote) => {
    if (activeStatus && quote.status !== activeStatus) return false;
    if (query) {
      const haystack = `${quote.id} ${quote.product} ${quote.customer} ${quote.supplier} ${quote.requestId}`
        .toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  });

  const totalOutstanding = quotes.filter(
    (quote) => quote.status === "PENDING" || quote.status === "SENT",
  ).length;

  const statusCounts = quotes.reduce<Record<string, number>>((acc, quote) => {
    acc[quote.status] = (acc[quote.status] ?? 0) + 1;
    return acc;
  }, {});
  const pills = [
    { key: "", label: "All", count: quotes.length },
    ...(QUOTE_STATUSES as readonly string[]).map((status) => ({
      key: status,
      label: quoteStatusMeta(status).label,
      count: statusCounts[status] ?? 0,
    })),
  ];

  return (
    <div className="flex flex-col gap-6 px-6 py-8 lg:px-10">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-2xl font-semibold tracking-tight text-sand-950">
            Quotes &amp; estimates
          </h1>
          <p className="text-sm text-sand-500">
            {quotes.length} quotes on file — {totalOutstanding} still awaiting a customer
            decision.
          </p>
        </div>
        <Button intent="neutral" asChild>
          <Link href="/admin/quotes/new">
            <Plus aria-hidden className="size-4" />
            New quote
          </Link>
        </Button>
      </div>

      <ListToolbar
        basePath="/admin/quotes"
        query={query}
        statuses={pills}
        activeStatus={activeStatus}
        searchPlaceholder="Search quote, product or customer…"
        searchLabel="Search quotes"
      />

      {rows.length > 0 ? (
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableHeadCell>Quote</TableHeadCell>
                <TableHeadCell>Request</TableHeadCell>
                <TableHeadCell>Customer</TableHeadCell>
                <TableHeadCell>Supplier</TableHeadCell>
                <TableHeadCell className="text-right">Value (USD)</TableHeadCell>
                <TableHeadCell className="text-right">Margin</TableHeadCell>
                <TableHeadCell>Status</TableHeadCell>
                <TableHeadCell>Expires</TableHeadCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((quote) => (
                <DetailTriggerRow key={quote.id} entity="quotes" row={quote}>
                  <TableCell>
                    <Link
                      href={`/admin/requests/${quote.requestId}`}
                      className="font-mono text-xs font-semibold text-sand-700 hover:text-sand-950 hover:underline"
                    >
                      {quote.id}
                    </Link>
                  </TableCell>
                  <TableCell className="font-medium text-sand-900">
                    {quote.imageUrls?.filter(Boolean)[0] ? (
                      <LightboxTrigger
                        items={quote.imageUrls.filter(Boolean).map((url) => ({
                          url,
                          alt: `Product image for ${quote.product}`,
                        }))}
                        label={`View images for ${quote.product}`}
                        caption={quote.product}
                        className="mr-2 inline-block align-middle"
                        imageClassName="inline-block size-7 rounded-md object-cover ring-1 ring-sand-200"
                      />
                    ) : null}
                    {quote.product}
                  </TableCell>
                  <TableCell className="text-sand-700">{quote.customer}</TableCell>
                  <TableCell className="text-sand-600">{quote.supplier}</TableCell>
                  <TableCell className="text-right font-medium tabular-nums text-sand-900">
                    {formatUsd(quote.valueUsd)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-sand-600">
                    {quote.marginBps / 100}%
                  </TableCell>
                  <TableCell>
                    <StatusPill status={quote.status} variant="gray" />
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sand-500">
                    {quote.expiresAt}
                  </TableCell>
                </DetailTriggerRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      ) : (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-sand-300 bg-white px-6 py-14 text-center">
          <FileText aria-hidden className="size-6 text-sand-300" />
          <p className="text-sm font-medium text-sand-800">No quotes yet</p>
          <p className="text-sm text-sand-500">
            Supplier quotes will appear here the moment they&apos;re drafted.
          </p>
        </div>
      )}
    </div>
  );
}