"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Eyebrow } from "@/components/marketing/section";
import { cn } from "@/lib/utils";

/**
 * Photos for the About carousel. Drop replacements into `public/about/` and
 * edit this list — the slot keeps whatever aspect ratio you give it, so
 * cropping a different image needs no code change.
 */
export const aboutImages = [
  {
    src: "/about/about-photo-1.jpg",
    alt: "Fayfort's founder on stage at the Global Digital Trade Expo",
  },
  {
    src: "/about/about-photo-2.jpg",
    alt: "Seasonal memories shared with the Fayfort team",
  },
  {
    src: "/about/about-photo-3.jpg",
    alt: "Fayfay, founder of Fayfort International Trading",
  },
  {
    src: "/about/about-photo-4.jpg",
    alt: "Expanding into a new office in Guangzhou",
  },
  {
    src: "/about/about-photo-5.jpg",
    alt: "Fayfort — vitamin F for your business",
  },
] as const;

/** How long each photo holds the slot before the next one appears. */
const ROTATE_MS = 8000;

function subscribeReducedMotion(onChange: () => void) {
  const query = window.matchMedia("(prefers-reduced-motion: reduce)");
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function getReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Live view of the OS-level reduced-motion preference, safe during SSR. */
function useReducedMotion() {
  return useSyncExternalStore(subscribeReducedMotion, getReducedMotion, () => false);
}

/**
 * The About carousel: one slot, images rolling through it like dice, with dots
 * for direct control. It advances on a timer, holds still while the visitor is
 * pointing at it or has keyboard focus inside, and stays put entirely for
 * people who ask for reduced motion — a slideshow they did not ask for is the
 * fastest way to make a page feel busy.
 */
function AboutGallery() {
  const [index, setIndex] = useState(0);
  const [hover, setHover] = useState(false);
  const [focus, setFocus] = useState(false);
  const [pinned, setPinned] = useState<number | null>(null);
  const reduced = useReducedMotion();

  const count = aboutImages.length;
  const paused = reduced || hover || focus || pinned !== null;
  const go = useCallback(
    (next: number) => setIndex(((next % count) + count) % count),
    [count],
  );

  useEffect(() => {
    if (paused || count < 2) return;
    const timer = window.setInterval(() => setIndex((current) => (current + 1) % count), ROTATE_MS);
    return () => window.clearInterval(timer);
  }, [paused, count]);

  // A dot the visitor picks stays put for a beat so the click is readable
  // before the rotation carries on.
  useEffect(() => {
    if (pinned === null) return;
    const timer = window.setTimeout(() => setPinned(null), ROTATE_MS);
    return () => window.clearTimeout(timer);
  }, [pinned]);

  const active = aboutImages[index];

  return (
    <div
      className="relative lg:h-full"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocusCapture={() => setFocus(true)}
      onBlurCapture={() => setFocus(false)}
    >
      <div className="border-sand-200 relative mx-auto aspect-[3/4] overflow-hidden rounded-2xl border bg-brand-900 shadow-card lg:h-[28rem]">
        {aboutImages.map((image, position) => (
          <Image
            key={image.src}
            src={image.src}
            alt={image.alt}
            fill
            priority={position === 0}
            sizes="(max-width: 1024px) 100vw, 45vw"
            className={cn(
              "object-cover transition-opacity duration-700 ease-out",
              position === index ? "opacity-100" : "opacity-0",
            )}
          />
        ))}

        {/* Single live message so assistive tech is told once, not once per photo. */}
        <p aria-live="polite" className="sr-only">
          {active.alt}
        </p>

        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-center gap-2 bg-gradient-to-t from-black/45 to-transparent p-4">
          {aboutImages.map((image, position) => (
            <button
              key={image.src}
              type="button"
              onClick={() => {
                setPinned(position);
                go(position);
              }}
              aria-label={`Show photo ${position + 1} of ${count}: ${image.alt}`}
              aria-current={position === index}
              className={cn(
                "h-2 rounded-full transition-all duration-300",
                position === index
                  ? "w-6 bg-white"
                  : "w-2 bg-white/50 hover:bg-white/80 focus-visible:bg-white/80",
              )}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/** Landing-page About band: the gallery on the left, the story on the right. */
export function About() {
  return (
    <section id="about" className="bg-sand-100/70">
      <div className="container-shell grid grid-cols-1 items-center gap-10 py-16 lg:grid-cols-2 lg:gap-16 lg:py-24">
        <AboutGallery />

        <div className="flex flex-col gap-4">
          <Eyebrow>About us</Eyebrow>
          <h2 className="font-display text-3xl font-semibold tracking-tight text-balance text-brand-900 sm:text-4xl">
            Connecting markets. Creating opportunities.
          </h2>
          <p className="text-pretty text-base leading-relaxed text-sand-600">
            Fayfort International Trading was founded by Fayfay, an
            entrepreneur whose years living, studying and doing business in
            China built a practice on firsthand experience. It connects
            individuals, entrepreneurs, brands and businesses with products,
            suppliers and opportunities across international markets.
          </p>
          <p className="text-pretty text-base leading-relaxed text-sand-600">
            Our focus is simple — to make international trade more accessible,
            transparent and practical. From product sourcing to China-to-Africa
            trade support, we help you take the next step into the global
            economy.
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <Button asChild intent="primary" size="md">
              <Link href="/about">
                Read more
                <ArrowRight aria-hidden className="size-4" />
              </Link>
            </Button>
            <Button asChild intent="outline" size="md">
              <Link href="/how-it-works">How it works</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
