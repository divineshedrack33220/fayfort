import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  Bell,
  CheckCircle2,
  FileText,
  Inbox,
  MessageSquare,
  Plus,
  Search,
} from "lucide-react";
import { StatusPill } from "@/components/ui/status-pill";
import { getPortalOverview, getPortalRequests } from "@/lib/data/portal";
import { ProductIcon } from "@/lib/product-icons";
import { getSession } from "@/lib/session";
import { Reveal } from "@/components/motion/reveal";
import { toneClasses, type Tone } from "@/lib/status";

export const metadata: Metadata = {
  title: "Overview",
  description:
    "An at-a-glance view of your Fayfort sourcing activity, quick actions and recent requests.",
};

/** Filled dot colour for a status tone, used on the pipeline grid. */
function toneDot(tone: Tone): string {
  return toneClasses[tone].dot;
}

export default async function OverviewPage() {
  const session = await getSession();
  const userName = session?.name ?? "David Green";
  const [overview, requests] = await Promise.all([
    getPortalOverview(),
    getPortalRequests(),
  ]);

  if (requests.length === 0) {
    redirect("/apply");
  }

  const quoted = requests.filter((r) => r.status === "QUOTE_READY").length;
  const inReview = requests.filter((r) => r.status === "UNDER_REVIEW").length;
  const converted = requests.filter((r) => r.status === "CONVERTED").length;

  // The same four numbers the stat grid shows, as a share of everything filed.
  const total = requests.length;
  const pipeline = [
    { label: "In review", value: inReview, tone: "brand" as Tone },
    { label: "Quoted", value: quoted, tone: "accent" as Tone },
    { label: "Converted", value: converted, tone: "success" as Tone },
  ];

  const stats = [
    { label: "Active", value: overview?.activeRequests ?? requests.length, icon: Search },
    { label: "In review", value: inReview, icon: Inbox },
    { label: "Quoted", value: quoted, icon: FileText },
    { label: "Converted", value: converted, icon: CheckCircle2 },
  ];

  const quickActions = [
    { href: "/apply", label: "New request", hint: "Brief a product", icon: Plus, primary: true },
    { href: "/dashboard", label: "My requests", hint: `${total} filed`, icon: Inbox },
    { href: "/quotes", label: "Quotes", hint: "Review and approve", icon: FileText },
    { href: "/chat", label: "Message us", hint: "Talk to the team", icon: MessageSquare },
    { href: "/notifications", label: "Alerts", hint: "Everything new", icon: Bell },
  ];

  const recent = requests.slice(0, 3);

  return (
    <div className="container-shell flex flex-col gap-4 py-4 sm:gap-6 sm:py-10">
      <Reveal>
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-xl font-semibold tracking-tight text-brand-900 sm:text-4xl">
            Welcome back, {userName.split(" ")[0]}.
          </h1>
          <p className="text-sm text-sand-500 sm:text-base">
            Here’s how your sourcing is looking right now.
          </p>
        </div>
      </Reveal>

      {/* Key numbers: a 2x2 tile grid on phones, four across on desktop. */}
      <Reveal delay={80}>
        <dl className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <div
                key={stat.label}
                className="flex flex-col gap-2 rounded-xl border border-sand-200 bg-white p-4 shadow-card sm:p-5"
              >
                <span
                  aria-hidden
                  className="flex size-8 items-center justify-center rounded-lg bg-brand-50 text-brand-700 sm:size-9"
                >
                  <Icon className="size-4 sm:size-[18px]" />
                </span>
                <dd className="font-display text-2xl leading-none font-semibold tabular-nums text-brand-900 sm:text-3xl">
                  {stat.value}
                </dd>
                <dt className="text-[11px] leading-tight font-semibold tracking-wide text-sand-500 uppercase sm:text-xs">
                  {stat.label}
                </dt>
              </div>
            );
          })}
        </dl>
      </Reveal>

      <Reveal delay={120}>
        {/* Primary actions, reachable in one tap from anywhere in the portal. */}
        <ul className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <li key={action.href}>
                <Link
                  href={action.href}
                  className={
                    "flex h-full items-center gap-3 rounded-xl border p-3.5 shadow-card transition-all duration-200 active:scale-[0.99] sm:p-4 " +
                    (action.primary
                      ? "border-transparent bg-brand-900 text-white hover:bg-brand-800"
                      : "border-sand-200 bg-white text-brand-900 hover:border-brand-200 hover:shadow-card-hover")
                  }
                >
                  <span
                    aria-hidden
                    className={
                      "flex size-10 shrink-0 items-center justify-center rounded-xl " +
                      (action.primary
                        ? "bg-white/10 text-white"
                        : "bg-sand-50 text-brand-700 ring-1 ring-sand-100")
                    }
                  >
                    <Icon className="size-[18px]" />
                  </span>
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-sm font-semibold">{action.label}</span>
                    <span
                      className={
                        "truncate text-xs " +
                        (action.primary ? "text-brand-200" : "text-sand-500")
                      }
                    >
                      {action.hint}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </Reveal>

      <Reveal delay={160}>
        <div className="flex flex-col gap-6">
          {/* Where everything filed currently sits. */}
          <section aria-labelledby="pipeline-heading" className="rounded-xl border border-sand-200 bg-white p-5 shadow-card sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <h2
                id="pipeline-heading"
                className="font-display text-sm font-semibold text-brand-900"
              >
                Your pipeline
              </h2>
              <span className="text-xs text-sand-500">
                {total} request{total === 1 ? "" : "s"}
              </span>
            </div>

            <ul className="mt-4 grid grid-cols-3 gap-3">
              {pipeline.map((stage) => (
                <li key={stage.label} className="flex flex-col gap-1.5">
                  <span className="flex items-center gap-1.5">
                    <span aria-hidden className={`size-2 rounded-full ${toneDot(stage.tone)}`} />
                    <span className="truncate text-[11px] font-semibold tracking-wide text-sand-500 uppercase sm:text-xs">
                      {stage.label}
                    </span>
                  </span>
                  <span className="font-display text-xl font-semibold tabular-nums text-brand-900 sm:text-2xl">
                    {stage.value}
                  </span>
                  <span
                    aria-hidden
                    className="h-1 overflow-hidden rounded-full bg-sand-100"
                  >
                    <span
                      className={`block h-full rounded-full ${toneDot(stage.tone)}`}
                      style={{ width: `${total ? (stage.value / total) * 100 : 0}%` }}
                    />
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="recent-heading" className="rounded-xl border border-sand-200 bg-white p-5 shadow-card sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <h2
                id="recent-heading"
                className="font-display text-sm font-semibold text-brand-900"
              >
                Recent requests
              </h2>
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:text-brand-800"
              >
                View all
                <ArrowRight aria-hidden className="size-3.5" />
              </Link>
            </div>

            <ul className="mt-3 flex flex-col divide-y divide-sand-100">
              {recent.map((request) => (
                <li key={request.id}>
                  <Link
                    href={`/dashboard/${request.id}`}
                    className="flex items-center gap-3 py-3 outline-none first:pt-1 last:pb-0 hover:opacity-80"
                  >
                    <span
                      aria-hidden
                      className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-sand-50 ring-1 ring-sand-100"
                    >
                      <ProductIcon product={request.product} className="size-5 text-brand-600" />
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-sm font-semibold text-brand-900">
                        {request.product}
                      </span>
                      <span className="truncate font-mono text-xs text-sand-500">
                        {request.id} · {request.date}
                      </span>
                    </span>
                    <StatusPill status={request.status} className="shrink-0" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </Reveal>
    </div>
  );
}
