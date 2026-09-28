"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { AccountMenu } from "@/components/marketing/account-menu";
import { cn } from "@/lib/utils";

export const siteNavLinks = [
  { href: "/", label: "Home" },
  { href: "/dashboard", label: "My Requests" },
  { href: "/about", label: "About us" },
  { href: "/how-it-works", label: "Help" },
] as const;

const PANEL_ID = "site-nav-mobile-panel";

function isActivePath(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Desktop link row plus the mobile disclosure that exposes the same links. */
export function SiteNav() {
  const pathname = usePathname() ?? "/";
  const [open, setOpen] = React.useState(false);
  const [lastPath, setLastPath] = React.useState(pathname);

  // Navigation to a new route collapses the mobile panel.
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setOpen(false);
  }

  React.useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const linkClass = (active: boolean) =>
    cn(
      "rounded-md px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors focus-visible:outline-none",
      active
        ? "bg-white/10 text-white"
        : "text-brand-100 hover:bg-white/5 hover:text-white focus-visible:bg-white/10",
    );

  return (
    <>
      <nav aria-label="Main" className="hidden items-center gap-1 lg:flex">
        {siteNavLinks.map((link) => {
          const active = isActivePath(pathname, link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              aria-current={active ? "page" : undefined}
              className={linkClass(active)}
            >
              {link.label}
            </Link>
          );
        })}
        <span aria-hidden className="mx-1 h-5 w-px bg-white/10" />
        <AccountMenu />
      </nav>

      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-controls={PANEL_ID}
        aria-label={open ? "Close menu" : "Open menu"}
        className="flex size-10 items-center justify-center rounded-md border border-white/25 bg-white/5 text-white transition-colors hover:bg-white/10 focus-visible:outline-none lg:hidden"
      >
        {open ? <X aria-hidden className="size-5" /> : <Menu aria-hidden className="size-5" />}
      </button>

      <div
        id={PANEL_ID}
        hidden={!open}
        className="absolute inset-x-0 top-16 z-40 border-b border-white/10 bg-brand-900/98 backdrop-blur lg:hidden"
      >
        <nav aria-label="Mobile" className="container-shell flex flex-col gap-1 py-3">
          {siteNavLinks.map((link) => {
            const active = isActivePath(pathname, link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={cn(linkClass(active), "px-4 py-2.5")}
              >
                {link.label}
              </Link>
            );
          })}
          <div className="mt-2 border-t border-white/10 px-4 pt-3 pb-1">
            <AccountMenu className="w-full" />
          </div>
        </nav>
      </div>
    </>
  );
}
