import Link from "next/link";
import { Bell, FileText, Home, Inbox, MessageSquare, Plus } from "lucide-react";
import { ChatTabBadge, NotificationTabBadge } from "@/components/portal/nav-badge";
import { cn } from "@/lib/utils";

/**
 * Primary mobile navigation for the customer portal: a fixed bottom tab bar,
 * the way a phone app is expected to move between sections. The desktop
 * sidebar in `PortalShell` covers the same destinations from `lg` up, so
 * exactly one of the two is ever usable.
 *
 * Always five destinations: the leading slot swaps Home for "New request"
 * while the customer has nothing in flight, because `/overview` redirects to
 * `/apply` in that state and a tab that bounces reads as broken.
 *
 * Rendered on the server — only the unread bubbles are client components.
 */
export function PortalBottomNav({
  active,
  hasRequests,
}: {
  active: string;
  hasRequests: boolean;
}) {
  const items = [
    hasRequests
      ? { href: "/overview", label: "Home", icon: Home }
      : { href: "/apply", label: "New", icon: Plus },
    { href: "/dashboard", label: "Requests", icon: Inbox },
    { href: "/quotes", label: "Quotes", icon: FileText },
    { href: "/chat", label: "Chat", icon: MessageSquare },
    { href: "/notifications", label: "Alerts", icon: Bell },
  ];

  return (
    <nav
      aria-label="Primary"
      data-testid="portal-bottom-nav"
      className="portal-bottom-bar fixed inset-x-0 bottom-0 z-40 lg:hidden"
    >
      <ul className="mx-auto grid w-full max-w-lg grid-cols-5">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = active === item.href;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className="group flex min-h-12 flex-col items-center justify-center gap-0.5 px-1 pt-1 pb-0.5 outline-none focus-visible:bg-sand-100"
              >
                <span
                  className={cn(
                    "relative flex size-8 items-center justify-center rounded-xl transition-colors duration-200",
                    isActive
                      ? "bg-brand-900 text-white shadow-sm"
                      : "text-sand-500 group-hover:bg-sand-100 group-hover:text-brand-700",
                  )}
                >
                  <Icon aria-hidden className="size-[18px]" strokeWidth={isActive ? 2.25 : 2} />
                  {item.href === "/chat" ? <ChatTabBadge /> : null}
                  {item.href === "/notifications" ? <NotificationTabBadge /> : null}
                </span>
                <span
                  className={cn(
                    "text-[10px] leading-none font-semibold tracking-wide transition-colors duration-200",
                    isActive ? "text-brand-900" : "text-sand-500",
                  )}
                >
                  {item.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
