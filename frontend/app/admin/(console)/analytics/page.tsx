import { ArrowUpRight, BarChart3, TrendingUp } from "lucide-react";
import type { Metadata } from "next";
import { TrendChart } from "@/components/admin/trend-chart";
import { formatUsd } from "@/lib/admin";
import {
  getAdminAnalytics,
  getAdminCustomers,
  getAdminOrders,
  getAdminRequests,
} from "@/lib/data/admin";

export const metadata: Metadata = { title: "Analytics" };

function BarChart({
  data,
  labelKey,
}: {
  data: Array<{ label: string; count: number }>;
  labelKey: string;
}) {
  const max = Math.max(...data.map((entry) => entry.count), 1);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex h-40 items-end gap-2">
        {data.map((entry) => (
          <div key={entry.label} className="flex flex-1 flex-col items-center gap-1.5">
            <span className="text-xs font-semibold tabular-nums text-sand-700">
              {entry.count}
            </span>
            <div
              role="img"
              aria-label={`${labelKey}: ${entry.label} — ${entry.count}`}
              className="w-full max-w-10 rounded-t-md bg-gradient-to-t from-brand-700 to-brand-500 transition-opacity hover:opacity-80"
              style={{ height: `${Math.round((entry.count / max) * 100)}%` }}
            />
            <span className="text-[11px] text-sand-500">{entry.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function RankedList({
  title,
  subtitle,
  items,
}: {
  title: string;
  subtitle?: string;
  items: Array<{ label: string; sub?: string; value: string; pct: number }>;
}) {
  const max = Math.max(...items.map((item) => item.pct), 1);
  return (
    <section className="rounded-xl border border-sand-200 bg-white shadow-sm">
      <div className="border-b border-sand-200 px-5 py-4">
        <h2 className="font-display text-base font-semibold text-sand-950">{title}</h2>
        {subtitle ? <p className="text-xs text-sand-500">{subtitle}</p> : null}
      </div>
      <ul className="flex flex-col gap-4 px-5 py-5">
        {items.map((item) => (
          <li key={item.label} className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between gap-3">
              <p className="truncate text-sm font-medium text-sand-800">{item.label}</p>
              <p className="shrink-0 text-sm font-semibold tabular-nums text-sand-900">
                {item.value}
              </p>
            </div>
            {item.sub ? <p className="text-xs text-sand-400">{item.sub}</p> : null}
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-sand-100">
              <div
                className="block h-full rounded-full bg-sand-400"
                style={{ width: `${(item.pct / max) * 100}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default async function AdminAnalyticsPage() {
  const [analytics, requests, orders, customers] = await Promise.all([
    getAdminAnalytics(),
    getAdminRequests(),
    getAdminOrders(),
    getAdminCustomers(),
  ]);

  const totalRequests = requests.length;
  const completed = orders.filter((order) => order.status === "DELIVERED").length;
  const active =
    analytics?.activeOrders ?? orders.filter((order) => order.status !== "DELIVERED").length;
  const totalValue = orders.reduce((sum, order) => sum + order.valueUsd, 0);
  const avgValue = orders.length ? totalValue / orders.length : 0;

  const metrics = [
    { label: "Total sourcing requests", value: String(totalRequests), hint: "All-time queue" },
    {
      label: "Request conversion rate",
      value: `${analytics?.conversionRate ?? 0}%`,
      hint: "Requests → orders",
    },
    { label: "Active orders", value: String(active), hint: "In production or transit" },
    { label: "Completed orders", value: String(completed), hint: "Delivered to customer" },
    { label: "Total order value", value: formatUsd(totalValue), hint: "Across all orders" },
    { label: "Average order value", value: formatUsd(avgValue), hint: "Per confirmed order" },
  ];

  const requestsTime: Array<{ label: string; count: number }> = [];
  const ordersTime = (analytics?.ordersByMonth ?? []).map((entry) => ({
    label: entry.month,
    value: entry.count,
  }));

  const MONTH_ORDER = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const valueByMonth = new Map(MONTH_ORDER.map((month) => [month, 0]));
  for (const order of orders) {
    const month = order.date.split(" ")[0];
    if (valueByMonth.has(month)) valueByMonth.set(month, valueByMonth.get(month)! + order.valueUsd);
  }
  const presentMonths = MONTH_ORDER.filter((month) => valueByMonth.get(month)! > 0);
  const valueTrend = presentMonths.map((month) => ({
    label: month,
    value: valueByMonth.get(month)!,
  }));
  const peakMonth = valueTrend.length
    ? valueTrend.reduce((best, entry) => (entry.value > best.value ? entry : best), valueTrend[0])
    : null;

  const categoryCounts = requests.reduce<Record<string, number>>((acc, row) => {
    acc[row.category] = (acc[row.category] ?? 0) + 1;
    return acc;
  }, {});
  const categories = Object.entries(categoryCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([label, count]) => ({ label, count }));

  const totalPipeline = customers.reduce((sum, customer) => sum + customer.pipelineValue, 0);

  return (
    <div className="flex flex-col gap-6 px-6 py-8 lg:px-10">
      <div className="flex flex-col gap-3 border-b border-sand-200 pb-6">
        <h1 className="font-display text-2xl font-semibold tracking-tight text-sand-950">
          Performance overview
        </h1>
        <p className="text-sm text-sand-500">
          Throughput and performance across the sourcing lifecycle — requests to delivery.
        </p>
      </div>

      <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {metrics.map((metric) => (
          <div
            key={metric.label}
            className="flex flex-col gap-1.5 rounded-xl border border-sand-200 bg-white p-5 shadow-sm"
          >
            <dt className="text-xs font-semibold tracking-wide text-sand-500 uppercase">
              {metric.label}
            </dt>
            <dd className="font-display text-2xl font-semibold tracking-tight text-sand-950 tabular-nums">
              {metric.value}
            </dd>
            <dd className="text-xs text-sand-500">{metric.hint}</dd>
          </div>
        ))}
      </dl>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <section className="rounded-xl border border-sand-200 bg-white shadow-sm xl:col-span-7">
          <div className="flex items-start justify-between border-b border-sand-200 px-5 py-4">
            <div>
              <h2 className="font-display text-base font-semibold text-sand-950">
                Requests over time
              </h2>
              <p className="text-xs text-sand-500">Inbound sourcing requests this week.</p>
            </div>
            <BarChart3 aria-hidden className="size-4 text-sand-400" />
          </div>
          <div className="px-5 py-5">
            <BarChart data={requestsTime} labelKey="requests" />
          </div>
        </section>

        <section className="rounded-xl border border-sand-200 bg-white shadow-sm xl:col-span-5">
          <div className="flex items-start justify-between border-b border-sand-200 px-5 py-4">
            <div>
              <h2 className="font-display text-base font-semibold text-sand-950">
                Orders over time
              </h2>
              <p className="text-xs text-sand-500">Confirmed orders by month.</p>
            </div>
            <TrendingUp aria-hidden className="size-4 text-sand-400" />
          </div>
          <div className="px-5 py-5">
            <TrendChart
              data={ordersTime}
              ariaLabel="Confirmed orders per month"
              formatValue={(value) => `${value} orders`}
            />
          </div>
        </section>
      </div>

      <section className="rounded-xl border border-sand-200 bg-white shadow-sm">
        <div className="flex items-start justify-between border-b border-sand-200 px-5 py-4">
          <div>
            <h2 className="font-display text-base font-semibold text-sand-950">
              Order value trend
            </h2>
            <p className="text-xs text-sand-500">Monthly value of confirmed orders in USD.</p>
          </div>
          <span className="flex items-center gap-1.5 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700 ring-1 ring-brand-200">
            <ArrowUpRight aria-hidden className="size-3" />
            {peakMonth
              ? `Peak ${formatUsd(peakMonth.value)} — ${peakMonth.label}`
              : "No confirmed orders yet"}
          </span>
        </div>
        <div className="px-5 py-5">
          <TrendChart
            data={valueTrend}
            ariaLabel="Monthly order value in USD"
            formatValue={formatUsd}
          />
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
        <RankedList
          title="Top requested products"
          subtitle="By inbound request volume"
          items={(analytics?.topRequestedProducts ?? []).map((entry) => ({
            label: entry.product,
            sub: `${entry.valueUsd.toLocaleString()} USD pipeline value`,
            value: String(entry.count),
            pct: entry.count,
          }))}
        />
        <RankedList
          title="Top customers"
          subtitle="By pipeline value"
          items={(analytics?.topCustomers ?? []).map((entry) => ({
            label: entry.name,
            value: formatUsd(entry.value),
            pct: totalPipeline ? Math.round((entry.value / totalPipeline) * 100) : 0,
          }))}
        />
        <RankedList
          title="Supplier performance"
          subtitle="Requests handled and reliability"
          items={(analytics?.topSuppliers ?? []).map((entry) => ({
            label: entry.name,
            sub: `${entry.orders} orders`,
            value: `${entry.reliability}%`,
            pct: entry.reliability,
          }))}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <section className="rounded-xl border border-sand-200 bg-white shadow-sm xl:col-span-12">
          <div className="border-b border-sand-200 px-5 py-4">
            <h2 className="font-display text-base font-semibold text-sand-950">
              Popular product categories
            </h2>
            <p className="text-xs text-sand-500">Share of inbound requests by category.</p>
          </div>
          <div className="flex flex-col gap-3 px-5 py-5 sm:flex-row sm:items-center sm:gap-6">
            <BarChart data={categories} labelKey="requests" />
            <ul className="flex flex-col gap-2">
              {categories.map((entry) => (
                <li key={entry.label} className="flex items-center gap-2 text-sm">
                  <span aria-hidden className="size-2.5 rounded-sm bg-brand-500/70" />
                  <span className="text-sand-700">{entry.label}</span>
                  <span className="text-sand-400">
                    · {requests.length
                      ? Math.round((entry.count / requests.length) * 100)
                      : 0}%
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </div>

      <p className="flex items-center gap-2 text-xs text-sand-400">
        <span className="inline-flex size-2 rounded-full bg-sand-300" aria-hidden />
        Figures reflect the requests, quotes and orders currently in your workspace.
      </p>
    </div>
  );
}