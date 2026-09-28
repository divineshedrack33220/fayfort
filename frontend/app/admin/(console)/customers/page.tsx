import Link from "next/link";
import { UsersRound } from "lucide-react";
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
import {
  getAdminCustomers,
  getAdminOrders,
  getAdminRequests,
} from "@/lib/data/admin";
import { CUSTOMER_STATUSES, customerStatusMeta } from "@/lib/status";

export const metadata: Metadata = { title: "Customers" };

export default async function AdminCustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const params = await searchParams;
  const query = (params.q ?? "").trim().toLowerCase();
  const activeStatus = (CUSTOMER_STATUSES as readonly string[]).includes(params.status ?? "")
    ? params.status!
    : null;

  const [customers, ordersAll, requestsAll] = await Promise.all([
    getAdminCustomers(),
    getAdminOrders(),
    getAdminRequests(),
  ]);

  const totalValue = ordersAll
    .filter((order) => customers.some((customer) => customer.name === order.customer))
    .reduce((sum, order) => sum + order.valueUsd, 0);

  const enriched = customers.map((customer) => {
    const orders = ordersAll.filter((order) => order.customer === customer.name);
    const requestCount = requestsAll.filter((row) => row.customer === customer.name).length;
    const activeOrders = orders.filter((order) => order.status !== "DELIVERED").length;
    const completedOrders = orders.filter((order) => order.status === "DELIVERED").length;
    const orderValue = orders.reduce((sum, order) => sum + order.valueUsd, 0);
    const lastRequest = requestsAll
      .filter((row) => row.customer === customer.name)
      .map((row) => row.date)
      .sort((a, b) => Date.parse(b) - Date.parse(a))[0];
    return {
      customer,
      requestCount,
      activeOrders,
      completedOrders,
      orderValue,
      lastActivity: lastRequest ?? "—",
    };
  });

  const rows = enriched.filter(({ customer }) => {
    if (activeStatus && customer.status !== activeStatus) return false;
    if (query) {
      const haystack = `${customer.name} ${customer.email} ${customer.company ?? ""} ${customer.city}`
        .toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  });

  const statusCounts = enriched.reduce<Record<string, number>>((acc, { customer }) => {
    acc[customer.status] = (acc[customer.status] ?? 0) + 1;
    return acc;
  }, {});
  const pills = [
    { key: "", label: "All", count: enriched.length },
    ...(CUSTOMER_STATUSES as readonly string[]).map((status) => ({
      key: status,
      label: customerStatusMeta(status).label,
      count: statusCounts[status] ?? 0,
    })),
  ];

  return (
    <div className="flex flex-col gap-6 px-6 py-8 lg:px-10">
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-2xl font-semibold tracking-tight text-sand-950">
          Customer accounts
        </h1>
        <p className="text-sm text-sand-500">
          {customers.length} accounts · {formatUsd(totalValue)} in confirmed order value across
          the book.
        </p>
      </div>

      <ListToolbar
        basePath="/admin/customers"
        query={query}
        statuses={pills}
        activeStatus={activeStatus}
        searchPlaceholder="Search name, email or city…"
        searchLabel="Search customers"
      />

      {rows.length > 0 ? (
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableHeadCell>Customer</TableHeadCell>
                <TableHeadCell className="text-right">Requests</TableHeadCell>
                <TableHeadCell className="text-right">Active orders</TableHeadCell>
                <TableHeadCell className="text-right">Completed</TableHeadCell>
                <TableHeadCell className="text-right">Total value</TableHeadCell>
                <TableHeadCell>Last activity</TableHeadCell>
                <TableHeadCell>Status</TableHeadCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map(
                ({
                  customer,
                  requestCount,
                  activeOrders,
                  completedOrders,
                  orderValue,
                  lastActivity,
                }) => {
                  const initials = customer.name
                    .split(" ")
                    .map((part) => part.charAt(0))
                    .join("")
                    .slice(0, 2)
                    .toUpperCase();
                  return (
                    <DetailTriggerRow
                      key={customer.id}
                      entity="customers"
                      row={customer}
                      counts={{
                        requests: requestCount,
                        activeOrders,
                        completedOrders,
                        orderValue,
                        lastActivity,
                      }}
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <span
                            aria-hidden
                            className="bg-sand-100 font-display text-sand-700 ring-sand-200 flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ring-1"
                          >
                            {initials}
                          </span>
                          <div>
                            <Link
                              href={`/admin/customers/${customer.id}`}
                              className="text-sand-900 hover:text-sand-950 font-medium hover:underline"
                            >
                              {customer.name}
                            </Link>
                            <p className="text-sand-400 text-xs">
                              {customer.company ?? customer.city}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-sand-700 text-right tabular-nums">
                        {requestCount}
                      </TableCell>
                      <TableCell className="text-sand-700 text-right tabular-nums">
                        {activeOrders}
                      </TableCell>
                      <TableCell className="text-sand-700 text-right tabular-nums">
                        {completedOrders}
                      </TableCell>
                      <TableCell className="text-sand-900 text-right font-medium tabular-nums">
                        {formatUsd(orderValue)}
                      </TableCell>
                      <TableCell className="text-sand-500 whitespace-nowrap">
                        {lastActivity}
                      </TableCell>
                      <TableCell>
                        <StatusPill status={customer.status} variant="gray" />
                      </TableCell>
                    </DetailTriggerRow>
                  );
                },
              )}
            </TableBody>
          </Table>
        </TableContainer>
      ) : (
        <div className="border-sand-300 flex flex-col items-center gap-3 rounded-xl border border-dashed bg-white px-6 py-14 text-center">
          <UsersRound aria-hidden className="text-sand-300 size-6" />
          <p className="text-sand-800 text-sm font-medium">No customers yet</p>
          <p className="text-sand-500 text-sm">New accounts appear here the moment they sign up.</p>
        </div>
      )}
    </div>
  );
}