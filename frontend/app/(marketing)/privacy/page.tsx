import type { Metadata } from "next";
import { Section, SectionHeading } from "@/components/marketing/section";

export const metadata: Metadata = {
  title: "Privacy policy",
  description:
    "How Fayfort International Trading handles the information you share on this site.",
};

const sections = [
  {
    title: "What we collect",
    body: "We collect the information needed to run your sourcing — your name, contact details, the products and destinations you ask about, and the order and quote records we create with you. When you sign in we use a session cookie to keep you signed in; nothing is stored in your browser beyond that.",
  },
  {
    title: "How we use it",
    body: "We use your information to prepare estimates, source products, prepare quotes and keep you updated on requests. We never sell your data, and we never add hidden markups to your landed cost.",
  },
  {
    title: "Cookies",
    body: "We use a single session cookie for authentication in the portal and analytics that help us improve the experience. You can clear it at any time in your browser.",
  },
  {
    title: "Sharing",
    body: "We share only what an order realistically requires — product and destination details with shortlisted suppliers and logistics partners — and never marketing data.",
  },
  {
    title: "Your rights",
    body: "You can ask us to correct or remove the information we hold about you at any time by contacting support. We respond to every request and delete data where we no longer need it to run your sourcing.",
  },
];

export default function PrivacyPage() {
  return (
    <main>
      <Section>
        <SectionHeading
          eyebrow="Privacy"
          title="Privacy policy"
          description="Last updated: September 2026. Short version — we use your data to run your sourcing, and nothing else."
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
            Questions or requests to remove data? Email hello@fayfort.com.
          </p>
        </div>
      </Section>
    </main>
  );
}