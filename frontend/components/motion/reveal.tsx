"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/**
 * Reveals children with a subtle fade-up once they scroll into view.
 * Respects prefers-reduced-motion (animation is disabled in CSS) and always
 * ends visible, so content is never stranded.
 */
export function Reveal({
  children,
  className,
  delay = 0,
  motion = "fade-up",
  as = "div",
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  motion?: "fade-up" | "fade-in" | "slide-in";
  as?: "div" | "li" | "section";
}) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const reveal = () => element.classList.add("motion-visible");

    if (!("IntersectionObserver" in window)) {
      reveal();
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return;
        reveal();
        observer.disconnect();
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" },
    );

    observer.observe(element);

    const timeout = window.setTimeout(() => {
      if (!element.classList.contains("motion-visible")) reveal();
    }, 1200);

    return () => {
      observer.disconnect();
      window.clearTimeout(timeout);
    };
  }, []);

  const Tag = as;

  return (
    <Tag
      ref={ref as never}
      data-motion={motion}
      className={cn("motion-reveal", className)}
      style={delay ? { animationDelay: `${delay}ms` } : undefined}
    >
      {children}
    </Tag>
  );
}