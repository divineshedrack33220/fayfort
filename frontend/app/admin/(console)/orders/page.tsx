import Link from "next/link";
import { Package } from "lucide-react";
import type { Metadata } from "next";
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
import { ListToolbar } from "@/components/admin/list-toolbar";
import { DetailTriggerRow } from "@/components/admin/detail-row";
import { formatUsd } from "@/lib/admin";
import { getAdminOrders } from "@/lib/data/admin";
import { ORDER_STATUSES, orderStatusMeta } from "@/lib/status";

export const metadata: Metadata = { title: "Orders" };

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const params = await searchParams;
  const query = (params.q ?? "").trim().toLowerCase();
  const activeStatus = (ORDER_STATUSES as readonly string[]).includes(params.status ?? "")
    ? params.status!
    : null;

  const orders = await getAdminOrders();
  const rows = orders.filter((order) => {
    if (activeStatus && order.status !== activeStatus) return false;
    if (query) {
      const haystack = `${order.id} ${order.customer} ${order.product} ${order.supplier}`
        .toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  });

  const activeOrders = orders.filter((order) => order.status !== "DELIVERED").length;
  const inTransit = orders.filter(
    (order) => order.status === "SHIPPING" || order.status === "WAREHOUSE",
  ).length;
  const deliveredValue = orders.filter((order) => order.status === "DELIVERED").reduce(
    (sum, order) => sum + order.valueUsd,
    0,
  );

  const statusCounts = orders.reduce<Record<string, number>>((acc, order) => {
    acc[order.status] = (acc[order.status] ?? 0) + 1;
    return acc;
  }, {});
  const pills = [
    { key: "", label: "All", count: orders.length },
    ...(ORDER_STATUSES as readonly string[]).map((status) => ({
      key: status,
      label: orderStatusMeta(status).label,
      count: statusCounts[status] ?? 0,
    })),
  ];

  return (
    <div className="flex flex-col gap-6 px-6 py-8 lg:px-10">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-2xl font-semibold tracking-tight text-sand-950">
            Order book
          </h1>
          <p className="text-sm text-sand-500">
            {orders.length} orders on the book — {activeOrders} still in motion.
          </p>
        </div>

        <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            { label: "Active orders", value: String(activeOrders) },
            { label: "In transit / warehouse", value: String(inTransit) },
            { label: "Awaiting payment", value: String(orders.filter((order) => order.status === "PAYMENT").length) },
            { label: "Delivered value (USD)", value: formatUsd(deliveredValue) },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-xl border border-sand-200 bg-white p-4 shadow-sm"
            >
              <dt className="text-xs font-semibold tracking-wide text-sand-500 uppercase">
                {stat.label}
              </dt>
              <dd className="mt-1 font-display text-xl font-semibold tabular-nums text-sand-950">
                {stat.value}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      <ListToolbar
        basePath="/admin/orders"
        query={query}
        statuses={pills}
        activeStatus={activeStatus}
        searchPlaceholder="Search order, customer or product…"
        searchLabel="Search orders"
      />

      {rows.length > 0 ? (
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableHeadCell>Order ID</TableHeadCell>
                <TableHeadCell>Customer</TableHeadCell>
                <TableHeadCell>Product</TableHeadCell>
                <TableHeadCell className="text-right">Quantity</TableHeadCell>
                <TableHeadCell className="text-right">Order value</TableHeadCell>
                <TableHeadCell>Current stage</TableHeadCell>
                <TableHeadCell>Date</TableHeadCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((order) => (
                <DetailTriggerRow key={order.id} entity="orders" row={order}>
                  <TableCell>
                    <Link
                      href={`/admin/orders/${order.id}`}
                      className="font-mono text-xs font-semibold text-sand-700 hover:text-sand-950 hover:underline"
                    >
                      {order.id}
                    </Link>
                  </TableCell>
                  <TableCell className="text-sand-700">{order.customer}</TableCell>
                  <TableCell className="font-medium text-sand-900">{order.product}</TableCell>
                  <TableCell className="text-right tabular-nums text-sand-600">
                    {order.quantity.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums text-sand-900">
                    {formatUsd(order.valueUsd)}
                  </TableCell>
                  <TableCell>
                    <StatusPill status={order.status} variant="gray" />
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sand-500">{order.date}</TableCell>
                </DetailTriggerRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      ) : (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-sand-300 bg-white px-6 py-14 text-center">
          <Package aria-hidden className="size-6 text-sand-300" />
          <p className="text-sm font-medium text-sand-800">No orders yet</p>
          <p className="text-sm text-sand-500">
            Orders appear here once a quote is approved and purchasing begins.
          </p>
        </div>
      )}
    </div>
  );
}