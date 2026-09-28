import Link from "next/link";
import { notFound } from "next/navigation";
import { MapPin } from "lucide-react";
import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/admin/breadcrumbs";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/ui/status-pill";
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeadCell,
  TableRow,
} from "@/components/ui/table";
import { formatNaira, formatUsd } from "@/lib/admin";
import {
  getAdminCustomers,
  getAdminOrders,
  getAdminQuotes,
  getAdminRequests,
} from "@/lib/data/admin";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const customers = await getAdminCustomers();
  const customer = customers.find((entry) => entry.id === id);
  return { title: customer ? customer.name : "Customer not found" };
}

export default async function AdminCustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const customers = await getAdminCustomers();
  const customer = customers.find((entry) => entry.id === id);
  if (!customer) notFound();

  const requestsAll = await getAdminRequests();
  const requests = requestsAll
    .filter((row) => row.customer === customer.name)
    .sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
  const quotes = (await getAdminQuotes()).filter((entry) => entry.customer === customer.name);
  const orders = (await getAdminOrders()).filter((entry) => entry.customer === customer.name);
  const activeOrders = orders.filter((entry) => entry.status !== "DELIVERED");
  const completedOrders = orders.filter((entry) => entry.status === "DELIVERED");
  const totalOrderValue = orders.reduce((sum, entry) => sum + entry.valueUsd, 0);
  const openQuoteTotal = quotes.filter(
    (entry) => entry.status !== "EXPIRED" && entry.status !== "DECLINED",
  ).length;

  const initials = customer.name
    .split(" ")
    .map((part) => part.charAt(0))
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="flex flex-col gap-6 px-6 py-8 lg:px-10">
      <Breadcrumbs
        crumbs={[{ label: "Customers", href: "/admin/customers" }, { label: customer.name }]}
      />

      {/* Profile header */}
      <div className="border-sand-200 flex flex-col gap-4 rounded-xl border bg-white p-5 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-4">
          <span
            aria-hidden
            className="bg-sand-100 font-display text-sand-700 ring-sand-200 flex size-12 shrink-0 items-center justify-center rounded-full text-base font-semibold ring-1"
          >
            {initials}
          </span>
          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-sand-950 text-xl font-semibold tracking-tight lg:text-2xl">
                {customer.name}
              </h1>
              <StatusPill status={customer.status} variant="gray" />
              <span className="text-sand-400 font-mono text-xs">{customer.id}</span>
            </div>
            <p className="text-sand-500 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              {customer.company ? (
                <span className="text-sand-700 font-medium">{customer.company}</span>
              ) : null}
              <span>{customer.email}</span>
              <span className="inline-flex items-center gap-1">
                <MapPin aria-hidden className="text-sand-400 size-3.5" />
                {customer.city}
              </span>
              <span className="font-mono text-xs">{customer.currency}</span>
            </p>
          </div>
        </div>
        <Button intent="neutral" asChild>
          <a
            href={`mailto:${customer.email}?subject=${encodeURIComponent("Fayfort — your sourcing progress")}`}
          >
            Message customer
          </a>
        </Button>
      </div>

      {/* KPIs */}
      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Requests", value: String(requests.length) },
          { label: "Pipeline value", value: formatNaira(customer.pipelineValue) },
          { label: "Open quotes", value: String(openQuoteTotal) },
          { label: "Order value (USD)", value: formatUsd(totalOrderValue) },
        ].map((stat) => (
          <div
            key={stat.label}
            className="border-sand-200 rounded-xl border bg-white p-4 shadow-sm"
          >
            <dt className="text-sand-500 text-xs font-semibold tracking-wide uppercase">
              {stat.label}
            </dt>
            <dd className="font-display text-sand-950 mt-1 text-xl font-semibold tabular-nums">
              {stat.value}
            </dd>
          </div>
        ))}
      </dl>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        {/* Current requests */}
        <section className="border-sand-200 rounded-xl border bg-white shadow-sm xl:col-span-7">
          <div className="border-sand-200 flex items-center justify-between border-b px-5 py-4">
            <div>
              <h2 className="font-display text-sand-950 text-base font-semibold">
                Sourcing history
              </h2>
              <p className="text-sand-500 text-xs">
                Requests filed by {customer.name.split(" ")[0]}, newest first.
              </p>
            </div>
            <Link
              href="/admin/requests"
              className="text-sand-600 hover:text-sand-900 text-sm font-medium"
            >
              Requests queue
            </Link>
          </div>
          {requests.length > 0 ? (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableHeadCell>Request</TableHeadCell>
                    <TableHeadCell>Product</TableHeadCell>
                    <TableHeadCell className="text-right">Quantity</TableHeadCell>
                    <TableHeadCell>Status</TableHeadCell>
                    <TableHeadCell>Received</TableHeadCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {requests.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>
                        <Link
                          href={`/admin/requests/${row.id}`}
                          className="text-sand-700 hover:text-sand-950 font-mono text-xs font-semibold hover:underline"
                        >
                          {row.id}
                        </Link>
                      </TableCell>
                      <TableCell className="text-sand-900 font-medium">{row.product}</TableCell>
                      <TableCell className="text-sand-600 text-right tabular-nums">
                        {row.quantity.toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <StatusPill status={row.status} variant="gray" />
                      </TableCell>
                      <TableCell className="text-sand-500 whitespace-nowrap">{row.date}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          ) : (
            <p className="text-sand-500 px-5 py-8 text-center text-sm">
              No sourcing requests on file yet.
            </p>
          )}
        </section>

        {/* Orders */}
        <div className="flex flex-col gap-6 xl:col-span-5">
          <section className="border-sand-200 rounded-xl border bg-white shadow-sm">
            <div className="border-sand-200 border-b px-5 py-4">
              <h2 className="font-display text-sand-950 text-base font-semibold">Current orders</h2>
            </div>
            {activeOrders.length > 0 ? (
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableHeadCell>Order</TableHeadCell>
                      <TableHeadCell>Product</TableHeadCell>
                      <TableHeadCell>Stage</TableHeadCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {activeOrders.map((order) => (
                      <TableRow key={order.id}>
                        <TableCell>
                          <Link
                            href={`/admin/orders/${order.id}`}
                            className="text-sand-700 hover:text-sand-950 font-mono text-xs font-semibold hover:underline"
                          >
                            {order.id}
                          </Link>
                        </TableCell>
                        <TableCell className="text-sand-800">{order.product}</TableCell>
                        <TableCell>
                          <StatusPill status={order.status} variant="gray" />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <p className="text-sand-500 px-5 py-6 text-sm">No orders in motion right now.</p>
            )}
          </section>

          <section className="border-sand-200 rounded-xl border bg-white shadow-sm">
            <div className="border-sand-200 border-b px-5 py-4">
              <h2 className="font-display text-sand-950 text-base font-semibold">
                Completed orders
              </h2>
            </div>
            {completedOrders.length > 0 ? (
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableHeadCell>Order</TableHeadCell>
                      <TableHeadCell>Product</TableHeadCell>
                      <TableHeadCell className="text-right">Value</TableHeadCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {completedOrders.map((order) => (
                      <TableRow key={order.id}>
                        <TableCell className="text-sand-500 font-mono text-xs">
                          {order.id}
                        </TableCell>
                        <TableCell className="text-sand-800">{order.product}</TableCell>
                        <TableCell className="text-sand-800 text-right tabular-nums">
                          {formatUsd(order.valueUsd)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <p className="text-sand-500 px-5 py-6 text-sm">No completed orders to show yet.</p>
            )}
          </section>
        </div>
      </div>

      {/* Quotes */}
      <section className="border-sand-200 rounded-xl border bg-white shadow-sm">
        <div className="border-sand-200 border-b px-5 py-4">
          <h2 className="font-display text-sand-950 text-base font-semibold">Quotes</h2>
          <p className="text-sand-500 text-xs">
            Supplier quotes issued against this customer&apos;s requests.
          </p>
        </div>
        {quotes.length > 0 ? (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeadCell>Quote</TableHeadCell>
                  <TableHeadCell>Supplier</TableHeadCell>
                  <TableHeadCell className="text-right">Value (USD)</TableHeadCell>
                  <TableHeadCell>Status</TableHeadCell>
                  <TableHeadCell>Expires</TableHeadCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {quotes.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell>
                      <Link
                        href={`/admin/requests/${entry.requestId}`}
                        className="text-sand-700 hover:text-sand-950 font-mono text-xs font-semibold hover:underline"
                      >
                        {entry.id}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sand-600">{entry.supplier}</TableCell>
                    <TableCell className="text-sand-900 text-right tabular-nums">
                      {formatUsd(entry.valueUsd)}
                    </TableCell>
                    <TableCell>
                      <StatusPill status={entry.status} variant="gray" />
                    </TableCell>
                    <TableCell className="text-sand-500 whitespace-nowrap">
                      {entry.expiresAt}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        ) : (
          <p className="text-sand-500 px-5 py-8 text-center text-sm">
            No quotes issued for this customer yet.
          </p>
        )}
      </section>
    </div>
  );
}
