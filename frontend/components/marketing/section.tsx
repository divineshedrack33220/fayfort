import * as React from "react";
import { cn } from "@/lib/utils";

export function Section({
  id,
  className,
  children,
}: {
  id?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className={cn("scroll-mt-20 py-16 sm:py-24", className)}>
      <div className="container-shell">{children}</div>
    </section>
  );
}

export function Eyebrow({
  children,
  onDark = false,
  className,
}: {
  children: React.ReactNode;
  onDark?: boolean;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "text-xs font-semibold tracking-[0.2em] uppercase",
        onDark ? "text-accent-300" : "text-accent-600",
        className,
      )}
    >
      {children}
    </p>
  );
}

export interface SectionHeadingProps {
  eyebrow?: string;
  title: string;
  description?: string;
  align?: "center" | "left";
  onDark?: boolean;
  children?: React.ReactNode;
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "center",
  onDark = false,
  children,
}: SectionHeadingProps) {
  return (
    <div
      className={cn(
        "flex max-w-2xl flex-col gap-3",
        align === "center" ? "mx-auto items-center text-center" : "items-start",
      )}
    >
      {eyebrow ? <Eyebrow onDark={onDark}>{eyebrow}</Eyebrow> : null}
      <h2
        className={cn(
          "font-display text-3xl font-semibold tracking-tight text-balance sm:text-4xl",
          onDark ? "text-white" : "text-brand-900",
        )}
      >
        {title}
      </h2>
      {description ? (
        <p
          className={cn(
            "text-pretty text-base leading-relaxed sm:text-lg",
            onDark ? "text-brand-100" : "text-sand-500",
          )}
        >
          {description}
        </p>
      ) : null}
      {children}
    </div>
  );
}