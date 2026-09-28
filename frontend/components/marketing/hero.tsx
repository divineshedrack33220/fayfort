import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { Reveal } from "@/components/motion/reveal";
import { Button, buttonVariants } from "@/components/ui/button";
import { AuthActionLink } from "@/components/marketing/auth-action-link";

function LogisticsScene() {
  return (
    <Reveal motion="fade-in" delay={180}>
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl border border-white/10 bg-brand-800/70 shadow-dialog">
        <Image
          src="/hero.webp"
          alt="Cargo containers at a Chinese port awaiting shipment to Africa"
          width={1280}
          height={853}
          className="size-full object-cover"
          priority
        />
      </div>
    </Reveal>
  );
}

export function Hero() {
  return (
    <section className="relative flex min-h-[calc(100dvh-4rem)] items-center overflow-hidden bg-brand-900">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 h-[36rem] w-[64rem] -translate-x-1/2 rounded-full bg-brand-600/30 blur-[120px]"
      />
      <div className="container-shell relative grid w-full grid-cols-1 items-center gap-12 py-14 sm:py-20 lg:grid-cols-2 lg:gap-16 lg:py-16">
        <Reveal className="flex flex-col items-start gap-6">
          <p className="text-xs font-semibold tracking-[0.2em] text-accent-300 uppercase">
            China sourcing &amp; trade
          </p>
          <h1 className="font-display text-4xl leading-[1.08] font-semibold tracking-tight text-balance text-white sm:text-5xl lg:text-6xl">
            Know what your China purchase will{" "}
            <span className="text-accent-300">really cost.</span>
          </h1>
          <p className="max-w-xl text-pretty text-lg leading-relaxed text-brand-100">
            Get accurate landed-cost estimates and find verified suppliers with
            transparent pricing.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <AuthActionLink
                className={buttonVariants({ intent: "accent", size: "lg" })}
                href="/apply"
              >
                Get a Quote
                <ArrowRight aria-hidden className="size-4" />
              </AuthActionLink>
            <Button asChild intent="on-dark-outline" size="lg">
              <Link href="/#how-it-works">How It Works</Link>
            </Button>
          </div>
        </Reveal>

        <LogisticsScene />
      </div>
    </section>
  );
}