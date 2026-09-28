import type { Metadata } from "next";
import { Mail } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Section } from "@/components/marketing/section";
import { ContactForm } from "@/components/marketing/contact-form";

/** TODO(release): replace with the real business contact before launch. */
const CONTACT_EMAIL = "hello@fayfort.com";

export const metadata: Metadata = {
  title: "Contact",
  description: "Get in touch with Fayfort International Trading about sourcing from China.",
};

const reasons = [
  "You have a product and want to understand the landed cost.",
  "You already have a quote and want it checked line by line.",
  "You want to hand a repeat sourcing flow to a team you can trust.",
];

export default function ContactPage() {
  return (
    <Section className="bg-sand-100/70">
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 lg:grid-cols-[1fr_1.2fr] lg:items-start">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-3">
            <p className="text-xs font-semibold tracking-[0.2em] text-accent-600 uppercase">
              Contact
            </p>
            <h1 className="font-display text-3xl font-semibold tracking-tight text-balance text-brand-900 sm:text-4xl">
              Talk to Fayfort about your next import.
            </h1>
            <p className="text-pretty leading-relaxed text-sand-500 sm:text-lg">
              Tell us what you are sourcing and where it is going. If you have a
              supplier price already, send it — the fastest way to a useful
              conversation is a number on the table.
            </p>
          </div>
          <Card className="p-5">
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-lg bg-brand-50 ring-1 ring-brand-100">
                <Mail aria-hidden className="size-5 text-brand-600" />
              </span>
              <div className="flex flex-col">
                <span className="text-xs font-medium text-sand-400">
                  Direct email
                </span>
                <a
                  href={`mailto:${CONTACT_EMAIL}`}
                  className="text-sm font-semibold text-brand-800 hover:text-brand-900"
                >
                  {CONTACT_EMAIL}
                </a>
              </div>
            </div>
          </Card>
          <ul className="flex flex-col gap-2.5">
            {reasons.map((reason) => (
              <li key={reason} className="flex items-start gap-2.5 text-sm text-sand-600">
                <span aria-hidden className="mt-1.5 size-1.5 shrink-0 rounded-full bg-accent-500" />
                {reason}
              </li>
            ))}
          </ul>
        </div>

        <Card className="p-6">
          <h2 className="font-display text-lg font-semibold text-sand-900">
            Send a message
          </h2>
          <p className="mt-1 mb-4 text-sm text-sand-500">
            Fields validate locally; nothing leaves your browser in this build.
          </p>
          <ContactForm />
        </Card>
      </div>
    </Section>
  );
}