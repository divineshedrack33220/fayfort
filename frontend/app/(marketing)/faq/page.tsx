import type { Metadata } from "next";
import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { AuthActionLink } from "@/components/marketing/auth-action-link";
import { Section, SectionHeading } from "@/components/marketing/section";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "FAQ",
  description:
    "Answers to common questions about Fayfort sourcing, landed costs, quotes, shipping and payment.",
};

const faqs = [
  {
    category: "Getting started",
    questions: [
      {
        q: "Do I need an account to see quotes?",
        a: "Yes — quotes are prepared against your sourcing request, so you sign in to review, approve or decline them. You can browse pricing and how it works without an account.",
      },
      {
        q: "What does a sourcing request cost?",
        a: "Nothing to request. A quote is prepared based on your brief, and you only move forward after approving it. The service fee is a fixed percentage of the landed cost, shown as its own line.",
      },
    ],
  },
  {
    category: "Estimates & quotes",
    questions: [
      {
        q: "Is a quote binding?",
        a: "Quotes are itemized and prepared from verified suppliers. Approval locks the price lines you saw; the confirmed FX rate and final charges are confirmed when the order is booked.",
      },
      {
        q: "Can I decline a quote?",
        a: "Yes. Decline a quote in your portal and the team revisits the brief or suggests alternatives in Chat. Every decision is kept in your quote history.",
      },
      {
        q: "How is the FX rate set?",
        a: "Quotes use a reference FX rate (shown on the quote) that is indicative. The rate used for payment is confirmed when the order is booked.",
      },
      {
        q: "Why do I see every fee as a separate line?",
        a: "So you can see exactly what you’re paying for and compare like-for-like. No markup is hidden inside the product price.",
      },
    ],
  },
  {
    category: "Shipping & delivery",
    questions: [
      {
        q: "Which countries do you ship to?",
        a: "We focus on West Africa today — Nigeria is fully supported in the portal. More destinations are coming.",
      },
      {
        q: "How long does sourcing take?",
        a: "It depends on the product and supplier. You can follow every stage on the portal, and each change is timestamped.",
      },
      {
        q: "What happens if goods are damaged?",
        a: "Inspection is available before shipping, and freight is handled under a documented contract. If anything is damaged in transit, the claim path is laid out in your order agreement.",
      },
    ],
  },
  {
    category: "Payment",
    questions: [
      {
        q: "When do I pay?",
        a: "Nothing is charged until you approve a quote and place the order. Fees are itemized and confirmed in writing at booking.",
      },
      {
        q: "Can I track a payment?",
        a: "Order and payment milestones appear on the request timeline in your portal.",
      },
    ],
  },
];

export default function FaqPage() {
  return (
    <main>
      <Section>
        <SectionHeading
          eyebrow="FAQ"
          title="Questions, answered"
          description="If you don’t see your question here, the team replies in Chat once you’re signed in."
        />
        <div className="mx-auto mt-12 flex max-w-3xl flex-col gap-10">
          {faqs.map((group) => (
            <div key={group.category} className="flex flex-col gap-4">
              <p className="text-xs font-semibold tracking-widest text-accent-600 uppercase">
                {group.category}
              </p>
              <dl className="flex flex-col divide-y divide-sand-200 rounded-xl border border-sand-200 bg-white">
                {group.questions.map((item) => (
                  <div key={item.q} className="flex flex-col gap-1.5 px-5 py-4">
                    <dt className="text-sm font-semibold text-brand-900">
                      {item.q}
                    </dt>
                    <dd
                      className={cn(
                        "text-sm leading-relaxed text-sand-500",
                      )}
                    >
                      {item.a}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}

          <div className="flex flex-col items-center gap-3 rounded-xl bg-brand-950 px-6 py-8 text-center">
            <p className="font-display text-lg font-semibold text-white">
              Still have a question?
            </p>
            <p className="max-w-md text-sm leading-relaxed text-brand-200">
              Sign in and message the Fayfort team directly — or file a request
              to see a firm quote.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button asChild intent="light-outline" size="sm">
                <Link href="/contact">
                  <MessageCircle aria-hidden className="size-4" />
                  Contact us
                </Link>
              </Button>
              <AuthActionLink
                href="/apply"
                className={buttonVariants({ intent: "accent", size: "sm" })}
              >
                Get a Quote
              </AuthActionLink>
            </div>
          </div>
        </div>
      </Section>
    </main>
  );
}