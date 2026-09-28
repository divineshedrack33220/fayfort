import Link from "next/link";
import { SiteLogo } from "@/components/marketing/site-logo";
import { SiteNav } from "@/components/marketing/site-nav";
import { GetStartedButton } from "@/components/marketing/get-started-button";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-brand-900/95 backdrop-blur">
      <div className="container-shell relative flex h-16 items-center justify-between gap-4">
        <Link href="/" aria-label="Fayfort Sourcing — home">
          <SiteLogo onDark />
        </Link>
        <div className="flex items-center gap-1 sm:gap-2">
          <SiteNav />
          <span aria-hidden className="hidden h-5 w-px bg-white/10 lg:block" />
          <GetStartedButton />
        </div>
      </div>
    </header>
  );
}