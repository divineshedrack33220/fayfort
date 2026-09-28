import Link from "next/link";
import { SearchX } from "lucide-react";
import { SiteLogo } from "@/components/marketing/site-logo";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col bg-brand-950 text-brand-100">
      <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6 text-center">
        <span
          aria-hidden
          className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent-500/60 to-transparent"
        />
        <SiteLogo onDark />
        <div className="flex flex-col items-center gap-3">
          <span className="flex size-14 items-center justify-center rounded-full bg-white/5 ring-1 ring-white/10">
            <SearchX aria-hidden className="size-6 text-accent-300" />
          </span>
          <p className="font-mono text-xs tracking-widest text-accent-300 uppercase">
            Error 404
          </p>
          <h1 className="font-display max-w-md text-3xl font-semibold tracking-tight text-balance text-white sm:text-4xl">
            This page went out of stock
          </h1>
          <p className="max-w-sm text-sm leading-relaxed text-brand-200">
            The link is broken, or the page has moved. Let’s get you back to a
            working section of the site.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button asChild intent="accent">
            <Link href="/">Back to home</Link>
          </Button>
          <Button asChild intent="light-outline">
            <Link href="/apply">File a sourcing request</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}