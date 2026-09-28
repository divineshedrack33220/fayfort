import type { Metadata } from "next";
import { Section, SectionHeading } from "@/components/marketing/section";

export const metadata: Metadata = {
  title: "Terms of service",
  description:
    "The terms that govern your use of the Fayfort platform and sourcing services.",
};

const sections = [
  {
    title: "Use of this site",
    body: "These terms govern your use of the Fayfort platform and sourcing services, operated by Fayfort International Trading. By using the portal, you agree to these terms and to use the service for legitimate sourcing activity.",
  },
  {
    title: "Estimates are indicative",
    body: "Quote lines and reference FX are first-pass estimates. A firm, itemized quote is prepared only after you file a sourcing request with confirmed requirements — and nothing ships until you approve it.",
  },
  {
    title: "Orders and payment",
    body: "An order becomes binding only once you approve a quote. Fees are itemized and confirmed in writing at booking. No markup is hidden inside product prices.",
  },
  {
    title: "Your requests",
    body: "You’re responsible for the accuracy of briefs you submit. Fayfort verifies suppliers and inspects goods where requested, but destination-side compliance (licences, VAT, prohibited goods) remains your responsibility.",
  },
  {
    title: "Liability",
    body: "To the fullest extent permitted by law, Fayfort is not liable for indirect or consequential losses. In-transit damage is handled through the documented freight agreement and inspection results.",
  },
  {
    title: "Changes",
    body: "These terms may be updated as the platform grows. Material changes are announced on the site before taking effect.",
  },
];

export default function TermsPage() {
  return (
    <main>
      <Section>
        <SectionHeading
          eyebrow="Terms"
          title="Terms of service"
          description="Last updated: September 2026. Plain-language terms for using the Fayfort platform."
        />
        <div className="mx-auto mt-12 flex max-w-3xl flex-col gap-8">
          {sections.map((section, index) => (
            <div key={section.title} className="flex flex-col gap-2">
              <p className="text-xs font-semibold tracking-widest text-accent-600">
                {String(index + 1).padStart(2, "0")}
              </p>
              <h2 className="font-display text-xl font-semibold text-brand-900">
                {section.title}
              </h2>
              <p className="text-sm leading-relaxed text-sand-600">
                {section.body}
              </p>
            </div>
          ))}
          <p className="border-t border-sand-200 pt-6 text-xs text-sand-400">
            Questions about these terms? Email hello@fayfort.com.
          </p>
        </div>
      </Section>
    </main>
  );
}