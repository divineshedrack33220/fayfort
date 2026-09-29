import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Check,
  ClipboardCheck,
  Factory,
  Package,
  Ship,
  Truck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { StatusPill } from "@/components/ui/status-pill";
import { Reveal } from "@/components/motion/reveal";
import { getPortalRequests } from "@/lib/data/portal";
import { ProductIcon } from "@/lib/product-icons";
import { cn } from "@/lib/utils";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const requests = await getPortalRequests();
  const request = requests.find((r) => r.id === id);
  return {
    title: request
      ? `${request.product} — shipment tracking`
      : "Shipment tracking",
  };
}

const MILESTONES = [
  {
    label: "Request submitted",
    note: "Your brief reached the Fayfort team.",
    icon: ClipboardCheck,
  },
  {
    label: "Supplier matched",
    note: "Verified supplier shortlisted for your product.",
    icon: Factory,
  },
  {
    label: "Order confirmed",
    note: "Quote agreed and the order was placed.",
    icon: Package,
  },
  {
    label: "Production & inspection",
    note: "Goods produced and quality-checked in China.",
    icon: Ship,
  },
  {
    label: "Shipped & delivered",
    note: "On the way to you — customs and door delivery follow.",
    icon: Truck,
  },
] as const;

export default async function TrackingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const requests = await getPortalRequests();
  const request = requests.find((r) => r.id === id);
  if (!request) {
    notFound();
  }

  const stages = request.timeline;
  const activeIndex = stages.findIndex((stage) => stage.state === "active");
  const stageStates = MILESTONES.map((_, index) =>
    index < activeIndex
      ? "done"
      : index === activeIndex
        ? "active"
        : "pending",
  );

  return (
    <div className="container-shell flex flex-col gap-6 py-8 sm:py-10">
      <Link
        href={`/dashboard/${request.id}`}
        className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-brand-700 hover:text-brand-800"
      >
        <ArrowLeft aria-hidden className="size-4" />
        Back to request
      </Link>

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-4 border-b border-sand-100 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="flex items-center gap-4">
            <span
              aria-hidden
              className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-brand-50 ring-1 ring-brand-100"
            >
              <ProductIcon product={request.product} className="size-7 text-brand-600" />
            </span>
            <div className="flex min-w-0 flex-col gap-0.5">
              <p className="pr-2 font-display text-lg font-semibold text-brand-900 sm:text-xl">
                {request.product}
              </p>
              <p className="font-mono text-xs text-sand-500">
                {request.id} · {request.date}
              </p>
            </div>
          </div>
          <StatusPill status={request.status} className="w-fit shrink-0" />
        </div>

        <CardContent className="flex flex-col gap-6 p-5 sm:p-6">
          <ol className="flex flex-col">
            {MILESTONES.map((milestone, index) => {
              const state = stageStates[index];
              const Icon = milestone.icon;
              const isLast = index === MILESTONES.length - 1;
              return (
                <Reveal
                  as="div"
                  key={milestone.label}
                  delay={index * 70}
                  className="relative flex gap-4 pb-8 last:pb-0"
                >
                  {!isLast ? (
                    <span
                      aria-hidden
                      className={cn(
                        "absolute top-6 left-[13px] h-full w-px",
                        state === "done" ? "bg-brand-600" : "bg-sand-200",
                      )}
                    />
                  ) : null}
                  <span
                    aria-hidden
                    className={cn(
                      "relative z-10 flex size-7 shrink-0 items-center justify-center rounded-full border-2",
                      state === "done" && "border-brand-600 bg-brand-600 text-white",
                      state === "active" &&
                        "border-brand-600 bg-white text-brand-600 ring-4 ring-brand-600/15",
                      state === "pending" && "border-sand-200 bg-white text-sand-300",
                    )}
                  >
                    {state === "done" ? (
                      <Check className="size-3.5" strokeWidth={3} />
                    ) : (
                      <Icon className="size-3.5" />
                    )}
                  </span>
                  <div
                    className={cn(
                      "flex min-w-0 flex-1 flex-col gap-0.5 pt-0.5",
                      state === "pending" && "opacity-60",
                    )}
                  >
                    <p
                      className={cn(
                        "text-sm font-semibold",
                        state === "pending" ? "text-sand-500" : "text-brand-900",
                      )}
                    >
                      {milestone.label}
                    </p>
                    <p className="text-sm text-sand-500">{milestone.note}</p>
                    {state === "active" ? (
                      <Badge tone="brand" className="mt-1 w-fit">
                        Current stage
                      </Badge>
                    ) : null}
</div>
                </Reveal>
              );
            })}
          </ol>
        </CardContent>
      </Card>

      <div className="flex flex-col-reverse items-stretch gap-2 sm:flex-row sm:items-center">
        <Button asChild intent="outline" size="sm">
          <Link href={`/dashboard/${request.id}`}>
            View request details
          </Link>
        </Button>
        <Button asChild intent="accent" size="sm">
          <Link href={`/chat?request=${request.id}`}>
            Ask the team about this shipment
          </Link>
        </Button>
      </div>
    </div>
  );
}