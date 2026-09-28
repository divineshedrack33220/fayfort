import type { Metadata } from "next";
import { ArrowRight, FilePlus2, FileSearch, ListChecks, PackageCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { AuthActionLink } from "@/components/marketing/auth-action-link";
import { Card } from "@/components/ui/card";
import { StatusPill } from "@/components/ui/status-pill";
import { Section, SectionHeading } from "@/components/marketing/section";

export const metadata: Metadata = {
  title: "How it works",
  description:
    "File a Fayfort sourcing request, get an itemized quote, then approve. Four steps from 'what will this cost?' to a sourced product.",
};

const steps = [
  {
    icon: FilePlus2,
    step: "01",
    title: "File a sourcing request",
    body: "Tell us the product, quantity and target economics. It enters the workflow as a tracked request — nothing disappears into a black hole.",
    takeaway: "One clear, tracked request from the start.",
  },
  {
    icon: FileSearch,
    step: "02",
    title: "We research and prepare a quote",
    body: "We shortlist verified suppliers, check the product evidence, and itemize every fee into one quote you can compare — not a vague 'all-in' number.",
    takeaway: "A quote where every line is on the table.",
  },
  {
    icon: ListChecks,
    step: "03",
    title: "You review the quote",
    body: "In your portal you can approve or decline the quote, and see the full history of every quote we've sent you. Decline, and we revisit the brief in Chat.",
    takeaway: "The decision — and the history — is yours.",
  },
  {
    icon: PackageCheck,
    step: "04",
    title: "You approve, we execute",
    body: "Nothing ships until you approve the quote. Once approved, you can follow the request through every stage — and every change is timestamped and audited.",
    takeaway: "You approve first. We execute after.",
  },
];

const stages = [
  { status: "SUBMITTED", description: "Your request is in, complete and ready to act on." },
  { status: "UNDER_REVIEW", description: "We review the product, requirements and target economics." },
  { status: "SUPPLIER_SEARCH", description: "We research and shortlist suppliers for your product." },
  { status: "QUOTE_READY", description: "A fully itemized quote is ready for your review." },
  { status: "CUSTOMER_APPROVAL", description: "You review and decide — approve or decline." },
  { status: "APPROVED", description: "Quote locked in; sourcing moves forward." },
];

export default function HowItWorksPage() {
  return (
    <div className="bg-white">
      <section className="relative overflow-hidden bg-brand-900">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-32 left-1/2 h-80 w-[56rem] -translate-x-1/2 rounded-full bg-brand-600/30 blur-[120px]"
        />
        <div className="container-shell relative flex flex-col items-center gap-5 py-16 text-center sm:py-24">
          <p className="text-xs font-semibold tracking-[0.2em] text-accent-300 uppercase">
            How it works
          </p>
          <h1 className="max-w-3xl font-display text-4xl leading-tight font-semibold tracking-tight text-balance text-white sm:text-5xl">
            Quote first. Source with confidence.
          </h1>
          <p className="max-w-2xl text-pretty text-lg leading-relaxed text-brand-100">
            Fayfort is built around one idea: you should know exactly what a
            China purchase will cost before you commit to it. This page walks
            through the path from first quote to shipping.
          </p>
          <AuthActionLink
            href="/apply"
            className={buttonVariants({ intent: "accent", size: "lg" })}
          >
            Get a Quote
            <ArrowRight aria-hidden className="size-4" />
          </AuthActionLink>
        </div>
      </section>

      <Section>
        <SectionHeading
          eyebrow="The journey"
          title="Four steps, one clear path."
          description="No runaround, no surprises at the end. Each step produces something you can act on."
        />
        <ol className="mt-12 flex flex-col gap-4">
          {steps.map((step) => (
            <li
              key={step.step}
              className="grid grid-cols-1 items-start gap-5 rounded-xl border border-sand-200 bg-white p-6 shadow-card md:grid-cols-[3rem_1fr_14rem]"
            >
              <div className="flex items-center gap-3 md:flex-col md:items-start">
                <span className="font-display text-2xl font-semibold text-brand-200">
                  {step.step}
                </span>
                <span className="flex size-10 items-center justify-center rounded-lg bg-brand-50 ring-1 ring-brand-100">
                  <step.icon aria-hidden className="size-5 text-brand-600" />
                </span>
              </div>
              <div className="flex flex-col gap-1.5">
                <h2 className="font-display text-lg font-semibold text-sand-900">
                  {step.title}
                </h2>
                <p className="text-sm leading-relaxed text-sand-500">
                  {step.body}
                </p>
              </div>
              <p className="rounded-lg bg-sand-100/70 px-3 py-2 text-sm font-medium text-sand-700 md:self-center">
                {step.takeaway}
              </p>
            </li>
          ))}
        </ol>
      </Section>

      <Section id="request-flow" className="bg-sand-100/70">
        <SectionHeading
          eyebrow="After you request"
          title="Your request, stage by stage."
          description="The same status vocabulary you'll see in the product really is the workflow — one stage leads to the next, and you always know where things stand."
        />
        <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {stages.map((stage, index) => (
            <Card key={stage.status} className="p-5">
              <div className="flex items-center justify-between gap-3">
                <StatusPill status={stage.status} />
                <Badge tone="neutral">
                  {String(index + 1).padStart(2, "0")}
                </Badge>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-sand-500">
                {stage.description}
              </p>
            </Card>
          ))}
        </div>
        <p className="mt-6 text-center text-xs text-sand-400">
          Every stage change is timestamped and audited — cancelled requests
          stay on the record too.
        </p>
      </Section>

      <Section>
        <SectionHeading
          eyebrow="The quote"
          title="One number, eight honest components."
          description="Nothing is hidden in a lump sum. Each line is visible before you commit, and each is clearly labelled."
        />
        <ul className="mx-auto mt-10 grid max-w-4xl grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
          {[
            "Product cost",
            "China domestic logistics",
            "Supplier & packaging fees",
            "Inspection",
            "International freight",
            "Customs & clearing",
            "Local transport",
            "Fayfort service fee",
          ].map((component) => (
            <li key={component} className="flex items-center gap-2.5 text-sm text-sand-700">
              <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-accent-500" />
              {component}
            </li>
          ))}
        </ul>
        <div className="mt-10 flex justify-center">
          <AuthActionLink
            href="/apply"
            className={buttonVariants({ intent: "primary", size: "lg" })}
          >
            Get a Quote
          </AuthActionLink>
        </div>
      </Section>
    </div>
  );
}