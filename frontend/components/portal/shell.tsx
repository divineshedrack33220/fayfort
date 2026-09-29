import Link from "next/link";
import {
  Bell,
  FilePlus2,
  FileText,
  Inbox,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  Settings,
  UserRound,
} from "lucide-react";
import { SiteLogo } from "@/components/marketing/site-logo";
import { Notifications } from "@/components/portal/notifications";
import { PortalBottomNav } from "@/components/portal/bottom-nav";
import { SidebarChatBadge } from "@/components/portal/sidebar-chat-badge";
import { SidebarNotificationBadge } from "@/components/portal/sidebar-notification-badge";
import { NotificationTabBadge } from "@/components/portal/nav-badge";
import { LogoutButton } from "@/components/auth/logout-button";
import type { MockSession } from "@/lib/auth";
import { getPortalRequests } from "@/lib/data/portal";
import { cn } from "@/lib/utils";

/**
 * App shell for gated customer pages.
 *
 * Phones get a slim app bar and a fixed bottom tab bar (`PortalBottomNav`);
 * `lg` and up get the dark sidebar. The two never appear together, and the
 * bottom bar's height is reserved on the document so it can never cover the
 * last control on a page.
 */
export async function PortalShell({
  active,
  session,
  children,
}: {
  active: string;
  session: MockSession;
  children: React.ReactNode;
}) {
  const requests = await getPortalRequests();
  const hasRequests = requests.length > 0;

  const NAV = [
    ...(hasRequests
      ? [{ href: "/overview", label: "Overview", icon: LayoutDashboard }]
      : []),
    { href: "/apply", label: "File a Request", icon: FilePlus2 },
    { href: "/dashboard", label: "My Requests", icon: Inbox },
    { href: "/quotes", label: "Quotes", icon: FileText },
    { href: "/chat", label: "Chat", icon: MessageSquare },
    { href: "/notifications", label: "Notifications", icon: Bell },
    { href: "/profile", label: "Profile", icon: UserRound },
    { href: "/settings", label: "Settings", icon: Settings },
  ] as const;

  // Chat is a full-height view: it pins the composer and lets the message list
  // be the only scroller. `flex-1` alone cannot do that — a flex container sized
  // by `min-h-dvh` still grows to fit its content — so the root needs a definite
  // height for this route only, and every page in between needs `min-h-0`.
  const fullHeight = active === "/chat";

  const userName = session.name ?? "David Green";
  const initials = userName
    .split(" ")
    .map((part) => part.charAt(0))
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div
      className={cn(
        "flex min-h-dvh flex-col bg-sand-100/70",
        fullHeight && "h-[var(--app-vh,100dvh)] overflow-hidden",
      )}
    >
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-white/10 bg-brand-900 lg:flex">
        <Link
          href="/"
          aria-label="Fayfort Sourcing — home"
          className="px-6 pt-6 pb-5"
        >
          <SiteLogo onDark />
        </Link>

        <nav
          aria-label="Portal sections"
          className="flex flex-1 flex-col gap-1 px-3"
        >
          {NAV.map((item) => {
            const Icon = item.icon;
            const isActive = active === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-white/10 text-white shadow-[inset_3px_0_0_0_var(--color-accent-500)]"
                    : "text-brand-200 hover:bg-white/5 hover:text-white",
                )}
              >
                <Icon aria-hidden className="size-4 shrink-0" />
                {item.label}
                {item.href === "/chat" ? <SidebarChatBadge /> : null}
                {item.href === "/notifications" ? <SidebarNotificationBadge /> : null}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-white/10 p-4">
          <div className="flex items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent-600 font-display text-sm font-semibold text-white">
              {initials}
            </span>
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-sm font-semibold text-white">
                {userName}
              </span>
              <span className="text-xs text-brand-200">Customer</span>
            </div>
          </div>
          <LogoutButton className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-brand-200 transition-colors hover:bg-white/5 hover:text-white">
            <LogOut aria-hidden className="size-4" />
          </LogoutButton>
        </div>
      </aside>

      {/* Mobile app bar — the bottom tabs carry navigation, so this stays
          slim, Instagram-style: just the mark and the account controls. */}
      <header className="sticky top-0 z-30 shrink-0 border-b border-white/10 bg-brand-900 lg:hidden">
        <div className="flex items-center justify-between gap-3 px-3 py-1.5">
          <Link href="/" aria-label="Fayfort Sourcing — home">
            <SiteLogo onDark />
          </Link>
          <span className="flex shrink-0 items-center gap-1">
            <Link
              href="/notifications"
              aria-label="Your notifications"
              className="relative flex size-8 shrink-0 items-center justify-center rounded-lg text-brand-200 transition-colors hover:bg-white/5 hover:text-white"
            >
              <Bell aria-hidden className="size-[18px]" />
              <NotificationTabBadge />
            </Link>
          </span>
        </div>
      </header>

      {/* `flex-1` (not `min-h-dvh`) so the app bar and the bottom bar's reserved
          gutter are both accounted for. On full-height routes the root above is
          `h-dvh`, so `min-h-0` lets this column shrink to what is left and hand
          that space to the page instead of letting the document scroll. */}
      <main
        className={cn(
          "flex flex-1 flex-col lg:pb-0 lg:pl-64",
          active !== "/chat" && "portal-bottom-clear",
          fullHeight && "min-h-0",
        )}
      >
        <div className="sticky top-0 z-20 hidden items-center justify-between gap-4 border-b border-sand-200 bg-white/85 px-6 py-2.5 backdrop-blur lg:flex">
          <p className="font-display text-sm font-semibold text-brand-900">
            {NAV.find((item) => item.href === active)?.label ?? "Portal"}
          </p>
          <Notifications />
        </div>
        {children}
      </main>

      {active !== "/chat" ? (
        <PortalBottomNav active={active} hasRequests={hasRequests} />
      ) : null}
    </div>
  );
}
