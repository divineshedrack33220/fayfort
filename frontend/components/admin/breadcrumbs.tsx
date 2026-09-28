import Link from "next/link";
import { ChevronRight } from "lucide-react";

export interface Crumb {
  label: string;
  href?: string;
}

export function Breadcrumbs({ crumbs }: { crumbs: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1 text-sm">
      {crumbs.map((crumb, index) => {
        const isLast = index === crumbs.length - 1;
        return (
          <span key={crumb.label} className="flex items-center gap-1">
            {index > 0 ? (
              <ChevronRight aria-hidden className="size-3.5 text-sand-400" />
            ) : null}
            {crumb.href && !isLast ? (
              <Link
                href={crumb.href}
                className="rounded px-1 py-0.5 font-medium text-sand-500 hover:bg-sand-100 hover:text-sand-900"
              >
                {crumb.label}
              </Link>
            ) : (
              <span className="px-1 py-0.5 font-semibold text-sand-900">{crumb.label}</span>
            )}
          </span>
        );
      })}
    </nav>
  );
}