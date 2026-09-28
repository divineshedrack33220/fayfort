import Link from "next/link";
import { SiteLogo } from "@/components/marketing/site-logo";
import { AuthActionLink } from "@/components/marketing/auth-action-link";

const businessName = "Fayfort International Trading";

const columns: Array<{
  title: string;
  links: Array<{
    href: string;
    label: string;
    authAware?: boolean;
  }>;
}> = [
  {
    title: "Fayfort",
    links: [
      { href: "/about", label: "About" },
      { href: "/how-it-works", label: "How It Works" },
      { href: "/contact", label: "Contact" },
    ],
  },
  {
    title: "Services",
    links: [
      { href: "/#sourcing", label: "Product Sourcing" },
      { href: "/about", label: "Supplier Verification" },
      { href: "/how-it-works", label: "Inspection" },
      { href: "/how-it-works", label: "Shipping" },
    ],
  },
  {
    title: "Resources",
    links: [
      { href: "/apply", label: "Get a Quote", authAware: true },
      { href: "/how-it-works", label: "Sourcing Guide" },
      { href: "/faq", label: "FAQs" },
    ],
  },
  {
    title: "Account",
    links: [
      { href: "/", label: "Sign In" },
      { href: "/dashboard", label: "My Requests", authAware: true },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-white/10 bg-brand-950">
      <div className="container-shell flex flex-col gap-12 py-14">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-6">
          <div className="flex flex-col gap-4 lg:col-span-2">
            <SiteLogo onDark />
            <p className="max-w-xs text-sm leading-relaxed text-brand-200">
              China-to-Africa sourcing with transparent landed costs. Know what
              your product will really cost — before you buy.
            </p>
          </div>
          {columns.map((column) => (
            <div key={column.title} className="flex flex-col gap-3">
              <p className="text-xs font-semibold tracking-widest text-brand-300 uppercase">
                {column.title}
              </p>
              <ul className="flex flex-col gap-2">
                {column.links.map((link) => (
                  <li key={link.label}>
                    {link.authAware ? (
                      <AuthActionLink
                        href={link.href}
                        className="text-sm text-brand-100 transition-colors hover:text-white"
                      >
                        {link.label}
                      </AuthActionLink>
                    ) : (
                      <Link
                        href={link.href}
                        className="text-sm text-brand-100 transition-colors hover:text-white"
                      >
                        {link.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="flex flex-col items-center justify-between gap-3 border-t border-white/10 pt-6 text-xs text-brand-300/80 sm:flex-row">
          <p>
            © {new Date().getFullYear()} {businessName}. All rights reserved.
          </p>
          <div className="flex items-center gap-6">
            <Link href="/terms" className="transition-colors hover:text-white">
              Terms
            </Link>
            <Link href="/privacy" className="transition-colors hover:text-white">
              Privacy
            </Link>
            <Link href="/admin/login" className="transition-colors hover:text-white">
              Staff
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}