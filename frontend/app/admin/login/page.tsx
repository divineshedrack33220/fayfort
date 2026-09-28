import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Globe2, ShieldHalf, TrendingUp } from "lucide-react";
import { SiteLogo } from "@/components/marketing/site-logo";
import { AdminLoginForm } from "@/components/admin/admin-login-form";
import { getSession } from "@/lib/session";
import { isAdmin } from "@/lib/auth";
import { formatUsd } from "@/lib/admin";
import { getAdminOrders, getAdminRequests } from "@/lib/data/admin";

export const metadata: Metadata = {
  title: "Staff sign-in — Fayfort Admin",
  description: "Sign in to the Fayfort staff console.",
  robots: { index: false, follow: false },
};

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  // Session and page stats are independent, so fetch them together: a slow or
  // wedged backend then costs one backend timeout instead of two.
  const [session, orders, requests] = await Promise.all([
    getSession(),
    getAdminOrders(),
    getAdminRequests(),
  ]);
  if (isAdmin(session)) {
    redirect("/admin");
  }

  const next = (await searchParams).next ?? "/admin";

  const totalOrderValue = orders.reduce((sum, order) => sum + order.valueUsd, 0);
  const awaitingSourcing = requests.filter((row) =>
    ["SUBMITTED", "UNDER_REVIEW", "SUPPLIER_SEARCH"].includes(row.status),
  ).length;
  const MONTH_ORDER = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const valueByMonth = new Map(MONTH_ORDER.map((month) => [month, 0]));
  for (const order of orders) {
    const month = order.date.split(" ")[0];
    if (valueByMonth.has(month)) valueByMonth.set(month, valueByMonth.get(month)! + order.valueUsd);
  }
  const presentMonths = MONTH_ORDER.filter((month) => valueByMonth.get(month)! > 0);
  const peakMonth = presentMonths.length
    ? presentMonths.reduce(
        (best, month) => (valueByMonth.get(month)! > valueByMonth.get(best)! ? month : best),
        presentMonths[0],
      )
    : null;

  const stats = [
    { value: String(requests.length), delta: `${awaitingSourcing} awaiting sourcing`, label: "Sourcing requests" },
    { value: formatUsd(totalOrderValue), delta: peakMonth ? `peak in ${peakMonth}` : "no orders yet", label: "Confirmed order value" },
  ];

  return (
    <div className="min-h-dvh bg-sand-100/70 lg:grid lg:grid-cols-2">
      {/* Brand panel */}
      <section className="relative hidden overflow-hidden bg-brand-950 lg:flex lg:flex-col lg:justify-between lg:p-12 xl:p-16">
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <span className="absolute -top-24 -right-24 size-96 rounded-full bg-brand-600/30 blur-3xl" />
          <span className="absolute -bottom-32 -left-16 size-96 rounded-full bg-brand-700/40 blur-3xl" />
          <span className="absolute top-1/3 left-1/2 size-64 -translate-x-1/2 rounded-full bg-brand-500/10 blur-3xl" />
        </div>

        <div className="relative">
          <Link
            href="/"
            aria-label="Fayfort Sourcing — staff console"
            className="inline-flex rounded-md p-1"
          >
            <SiteLogo onDark />
          </Link>
        </div>

        <div className="relative flex flex-col gap-6">
          <span className="inline-flex w-fit items-center gap-2 rounded-full bg-white/5 px-3 py-1 text-xs font-medium tracking-wide text-sand-300 uppercase ring-1 ring-white/10">
            <ShieldHalf aria-hidden className="size-3.5 text-accent-400" />
            Staff ops console
          </span>
          <h1 className="font-display max-w-md text-4xl font-semibold tracking-tight text-white xl:text-5xl">
            Run your sourcing pipeline in one place.
          </h1>
          <p className="max-w-sm text-sm leading-relaxed text-sand-400">
            Turn requests into quotes, manage orders and track every shipment
            from factory floor to delivery — without leaving the console.
          </p>
          <dl className="grid max-w-md grid-cols-3 gap-6 border-t border-white/10 pt-6">
            {stats.map((stat) => (
              <div key={stat.label} className="flex flex-col gap-1">
                <dt className="text-xs leading-snug text-sand-500">{stat.label}</dt>
                <dd className="font-display text-xl font-semibold tabular-nums text-white">
                  {stat.value}
                </dd>
                <dd className="flex items-center gap-1 text-[11px] font-medium text-success-400">
                  <TrendingUp aria-hidden className="size-3" />
                  {stat.delta}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        <p className="relative flex items-center justify-between gap-4 text-xs text-sand-500">
          <span className="flex items-center gap-2">
            <Globe2 aria-hidden className="size-3.5" />
            © {new Date().getFullYear()} Fayfort Sourcing Ltd.
          </span>
          <Link
            href="/contact"
            className="font-medium text-sand-300 transition-colors hover:text-white"
          >
            Contact support
          </Link>
        </p>
      </section>

      {/* Sign-in panel */}
      <section className="flex min-h-dvh flex-col px-6 py-8 sm:px-10 lg:min-h-0 lg:items-center lg:justify-center lg:py-16">
        <span className="mb-8 flex items-center lg:hidden">
          <Link href="/" aria-label="Fayfort Sourcing — staff console" className="inline-flex rounded-md p-1">
            <SiteLogo />
          </Link>
        </span>

        <div className="w-full max-w-md">
          <div className="mb-6 flex flex-col items-center gap-3 text-center">
            <span className="flex size-12 items-center justify-center rounded-xl bg-white text-brand-600 shadow-sm ring-1 ring-sand-200">
              <ShieldHalf aria-hidden className="size-6" />
            </span>
            <div>
              <h2 className="font-display text-xl font-semibold text-sand-950">Staff sign-in</h2>
              <p className="mt-1 text-sm text-sand-500">
                The admin console is visible to authorised Fayfort team members only.
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-sand-200 bg-white p-6 shadow-sm">
            <AdminLoginForm next={next} />
          </div>

          <p className="mt-6 flex items-center justify-center gap-1.5 text-center text-sm text-sand-500">
            Not staff?
            <Link
              href="/"
              className="font-medium text-brand-700 transition-colors hover:text-brand-800"
            >
              Customer sign-in
            </Link>
          </p>
        </div>
      </section>
    </div>
  );
}