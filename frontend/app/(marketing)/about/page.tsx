import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Boxes,
  CircleCheckBig,
  Compass,
  Eye,
  Handshake,
  Repeat,
  ShieldCheck,
  Target,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { AuthActionLink } from "@/components/marketing/auth-action-link";
import { Card } from "@/components/ui/card";
import { Section, SectionHeading, Eyebrow } from "@/components/marketing/section";

export const metadata: Metadata = {
  title: "About Fayfort International Trading",
  description:
    "Fayfort International Trading connects individuals, entrepreneurs, brands and businesses with products, suppliers and opportunities across international markets — built on firsthand experience in China.",
};

const services = [
  "Product Sourcing",
  "Supplier & Manufacturer Connections",
  "International Procurement",
  "China-to-Africa Trade Support",
  "Import & Export Assistance",
  "Product Research",
  "Business Sourcing Solutions",
  "International Business Connections",
] as const;

const approach = [
  {
    icon: ShieldCheck,
    title: "Trust",
    body: "International business is built on more than transactions — trust is where every relationship starts.",
  },
  {
    icon: Handshake,
    title: "Relationships",
    body: "We focus on building relationships that create value beyond a single transaction.",
  },
  {
    icon: Eye,
    title: "Transparency",
    body: "Clear costs, honest process and no surprises — so every decision is made with confidence.",
  },
  {
    icon: Repeat,
    title: "Consistency",
    body: "The same standard on every order, whether it's your first shipment or your fiftieth.",
  },
] as const;

export default function AboutPage() {
  return (
    <div className="bg-white">
      <section className="relative overflow-hidden bg-brand-900">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-32 left-1/2 h-80 w-[56rem] -translate-x-1/2 rounded-full bg-brand-600/30 blur-[120px]"
        />
        <div className="container-shell relative flex flex-col items-center gap-5 py-16 text-center sm:py-24">
          <Eyebrow onDark>About Fayfort International Trading</Eyebrow>
          <h1 className="max-w-3xl font-display text-4xl leading-tight font-semibold tracking-tight text-balance text-white sm:text-5xl">
            Connecting Markets. Creating Opportunities.
          </h1>
          <p className="max-w-2xl text-pretty text-lg leading-relaxed text-brand-100">
            Fayfort International Trading is an international trading and
            sourcing company founded by Fayfay, an entrepreneur and
            international business professional with experience living,
            studying, and doing business in China.
          </p>
        </div>
      </section>

      <Section>
        <div className="mx-auto flex max-w-3xl flex-col gap-5">
          <SectionHeading
            eyebrow="Who we are"
            title="Built from firsthand experience."
          />
          <p className="text-pretty text-base leading-relaxed text-sand-600">
            Built from firsthand experience navigating the Chinese market,
            Fayfort connects individuals, entrepreneurs, brands, and businesses
            with products, suppliers, manufacturers, and business
            opportunities across international markets.
          </p>
          <p className="text-pretty text-base leading-relaxed text-sand-600">
            Our focus is simple:{" "}
            <strong className="font-semibold text-sand-900">
              to make international trade more accessible, transparent, and
              practical.
            </strong>
          </p>
        </div>
      </Section>

      <Section className="bg-sand-100/70">
        <SectionHeading
          eyebrow="Our story"
          title="One journey, many opportunities."
        />
        <div className="mx-auto mt-8 flex max-w-3xl flex-col gap-5">
          <p className="text-pretty text-base leading-relaxed text-sand-600">
            Fayfay&rsquo;s journey into international business began through her
            experience in China, where she spent years studying, building
            relationships, and gaining firsthand knowledge of the country&rsquo;s
            business and manufacturing environment.
          </p>
          <p className="text-pretty text-base leading-relaxed text-sand-600">
            Through this experience, she discovered both the opportunities and
            challenges that come with doing business across borders.
          </p>
          <p className="text-pretty text-base leading-relaxed text-sand-600">
            Finding reliable suppliers, identifying quality products,
            negotiating with manufacturers, understanding the market, and
            managing international logistics can be overwhelming — especially
            for entrepreneurs entering the market for the first time.
          </p>
          <p className="text-pretty text-base leading-relaxed text-sand-600">
            This experience became the foundation for{" "}
            <strong className="font-semibold text-sand-900">
              Fayfort International Trading
            </strong>
            . What began with Fayfay&rsquo;s personal journey has grown into a
            business focused on helping others access international markets
            with greater confidence.
          </p>
        </div>
      </Section>

      <Section>
        <SectionHeading
          eyebrow="What we do"
          title="Sourcing and trading, end to end."
          description="Fayfort provides international sourcing and trading solutions designed to connect businesses with opportunities across global markets."
        />
        <Card className="mx-auto mt-10 max-w-3xl p-6">
          <ul className="grid grid-cols-1 gap-3 text-sm text-sand-700 sm:grid-cols-2">
            {services.map((service) => (
              <li key={service} className="flex items-start gap-2.5">
                <CircleCheckBig
                  aria-hidden
                  className="mt-0.5 size-4 shrink-0 text-accent-600"
                />
                {service}
              </li>
            ))}
          </ul>
        </Card>
        <p className="mx-auto mt-8 max-w-2xl text-center text-pretty text-base leading-relaxed text-sand-600">
          Whether you are an entrepreneur searching for products, a growing
          brand looking for manufacturers, or an established business seeking
          new international opportunities, Fayfort helps simplify the process.
        </p>
      </Section>

      <Section className="bg-sand-100/70">
        <SectionHeading
          eyebrow="Our approach"
          title="Based on more than transactions."
          description="Our experience in China gives us an understanding of the market from the inside — so we can help businesses source internationally while navigating the realities of working with suppliers and manufacturers."
        />
        <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {approach.map((value) => (
            <Card key={value.title} className="flex flex-col gap-3 p-5">
              <span className="flex size-10 items-center justify-center rounded-lg bg-brand-50 ring-1 ring-brand-100">
                <value.icon aria-hidden className="size-5 text-brand-600" />
              </span>
              <h2 className="font-display text-base font-semibold text-sand-900">
                {value.title}
              </h2>
              <p className="text-sm leading-relaxed text-sand-500">
                {value.body}
              </p>
            </Card>
          ))}
        </div>
      </Section>

      <Section>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card className="flex flex-col gap-4 p-6">
            <span className="flex size-11 items-center justify-center rounded-lg bg-brand-50 ring-1 ring-brand-100">
              <Target aria-hidden className="size-5 text-brand-600" />
            </span>
            <h2 className="font-display text-lg font-semibold text-brand-900">
              Our mission
            </h2>
            <p className="text-pretty text-base leading-relaxed text-sand-600">
              To connect businesses and entrepreneurs to global opportunities
              while making international trade easier to navigate. We aim to
              reduce the barriers that prevent businesses from accessing
              quality products, reliable suppliers, and international markets.
            </p>
          </Card>
          <Card className="flex flex-col gap-4 p-6">
            <span className="flex size-11 items-center justify-center rounded-lg bg-brand-50 ring-1 ring-brand-100">
              <Compass aria-hidden className="size-5 text-brand-600" />
            </span>
            <h2 className="font-display text-lg font-semibold text-brand-900">
              Our vision
            </h2>
            <p className="text-pretty text-base leading-relaxed text-sand-600">
              To build a trusted bridge between Africa, China, and the global
              marketplace. We believe entrepreneurs should have access to the
              knowledge, connections, and opportunities needed to build
              businesses that can operate beyond borders.
            </p>
          </Card>
        </div>
      </Section>

      <section className="bg-brand-900">
        <div className="container-shell flex flex-col items-center gap-6 py-16 text-center sm:py-24">
          <span className="flex size-12 items-center justify-center rounded-xl bg-brand-600/40 ring-1 ring-white/10">
            <Boxes aria-hidden className="size-6 text-accent-300" />
          </span>
          <h2 className="max-w-2xl font-display text-2xl font-semibold tracking-tight text-balance text-white sm:text-4xl">
            More than trading.
          </h2>
          <p className="max-w-2xl text-pretty text-base leading-relaxed text-brand-100">
            Fayfort International Trading is more than a trading company. It is
            a growing network built around people, relationships, products, and
            opportunities. Founded from Fayfay&rsquo;s personal experience in
            China and her passion for international business, Fayfort continues
            to create connections between markets and help businesses take
            their next step into the global economy.
          </p>
          <p className="font-display text-xl font-semibold text-accent-300 sm:text-2xl">
            From China to Africa and beyond.
          </p>
          <p className="text-sm text-brand-200">
            Fayfort International Trading — Connecting Markets. Creating
            Opportunities.
          </p>
          <div className="mt-2 flex flex-wrap justify-center gap-3">
            <AuthActionLink
              href="/apply"
              className={buttonVariants({ intent: "accent", size: "lg" })}
            >
              Get a Quote
              <ArrowRight aria-hidden className="size-4" />
            </AuthActionLink>
            <Button asChild intent="outline" size="lg">
              <Link href="/how-it-works">How it works</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}