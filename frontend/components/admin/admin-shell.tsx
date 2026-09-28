"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { AdminBell } from "@/components/admin/notifications-bell";
import { useAdminMessagesUnread } from "@/components/admin/use-admin-messages";
import { useAdminNotifications } from "@/components/admin/use-admin-notifications";
import { NAV_HINTS } from "@/components/admin/nav-hints";
import {
  NAV_TOOLTIP_ID,
  NavTooltip,
  type NavHintState,
} from "@/components/admin/nav-tooltip";
import {
  BarChart3,
  Bell,
  ClipboardList,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  Package,
  Settings,
  Ship,
  ShieldCheck,
  UsersRound,
  X,
  type LucideIcon,
} from "lucide-react";
import { LogoutButton } from "@/components/auth/logout-button";
import { SiteLogo } from "@/components/marketing/site-logo";
import { GlobalSearchModal } from "@/components/admin/global-search-modal";
import type { MockSession } from "@/lib/auth";
import { cn } from "@/lib/utils";

type NavItem = { href: string; label: string; icon: LucideIcon };

const DASHBOARD_NAV: NavItem = { href: "/admin", label: "Overview", icon: LayoutDashboard };

/** Sidebar grouped by the sourcing pipeline: work → people → workspace. */
const NAV_GROUPS: readonly { label: string; items: readonly NavItem[] }[] = [
  {
    label: "Sourcing",
    items: [
      { href: "/admin/requests", label: "Sourcing Requests", icon: ClipboardList },
      { href: "/admin/quotes", label: "Quotes", icon: FileText },
      { href: "/admin/orders", label: "Orders", icon: Package },
      { href: "/admin/inspections", label: "Inspections", icon: ShieldCheck },
      { href: "/admin/shipments", label: "Shipments", icon: Ship },
    ],
  },
  {
    label: "Relations",
    items: [
      { href: "/admin/customers", label: "Customers", icon: UsersRound },
      { href: "/admin/messages", label: "Messages", icon: MessageSquare },
    ],
  },
  {
    label: "Workspace",
    items: [
      { href: "/admin/analytics", label: "Analytics", icon: BarChart3 },
      { href: "/admin/notifications", label: "Notifications", icon: Bell },
      { href: "/admin/settings", label: "Settings", icon: Settings },
    ],
  },
];

const ALL_NAV = [DASHBOARD_NAV, ...NAV_GROUPS.flatMap((group) => group.items)];

/** Resolve the active nav item from the current path (exact for /admin). */
function activeHref(pathname: string): string {
  if (pathname === "/admin") return "/admin";
  const match = ALL_NAV.filter((item) => item.href !== "/admin" && pathname.startsWith(item.href));
  const [best] = match.sort((a, b) => b.href.length - a.href.length);
  return best?.href ?? "/admin";
}

function NavLink({
  href,
  label,
  icon: Icon,
  isActive,
  onDark,
  onClick,
  badge,
  hint,
  describedBy,
  onShowHint,
  onHideHint,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
  isActive: boolean;
  onDark?: boolean;
  onClick?: () => void;
  badge?: number;
  hint?: string;
  describedBy?: string;
  onShowHint?: (hint: NavHintState) => void;
  onHideHint?: () => void;
}) {
  const linkRef = useRef<HTMLAnchorElement | null>(null);

  const reveal = () => {
    if (!hint || !onShowHint || !linkRef.current) return;
    onShowHint({ href, label, text: hint, rect: linkRef.current.getBoundingClientRect() });
  };

  return (
    <Link
      ref={linkRef}
      href={href}
      aria-current={isActive ? "page" : undefined}
      aria-describedby={describedBy}
      onClick={onClick}
      onPointerEnter={(event) => {
        // Mouse only: touch taps fire pointerenter too and would stick a
        // tooltip open over the drawer.
        if (event.pointerType === "mouse") reveal();
      }}
      onPointerLeave={onHideHint}
      onFocus={reveal}
      onBlur={onHideHint}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        onDark
          ? isActive
            ? "bg-white/10 text-white"
            : "text-sand-400 hover:bg-white/5 hover:text-white"
          : isActive
            ? "bg-sand-100 text-sand-900"
            : "text-sand-500 hover:bg-sand-100 hover:text-sand-900",
      )}
    >
      <Icon aria-hidden className="size-4 shrink-0" />
      {label}
      {badge ? (
        <span
          aria-label={`${badge} unread`}
          className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-accent-600 px-1.5 text-[10px] font-bold tabular-nums text-white"
        >
          {badge}
        </span>
      ) : null}
    </Link>
  );
}

/** Collapsible sidebar groups shared by the desktop sidebar and the mobile drawer. */
function SideGroupList({
  active,
  onNavigate,
  notificationsBadge = 0,
  messagesBadge = 0,
  hint,
  onShowHint,
  onHideHint,
}: {
  active: string;
  onNavigate?: () => void;
  notificationsBadge?: number;
  messagesBadge?: number;
  hint: NavHintState | null;
  onShowHint: (hint: NavHintState) => void;
  onHideHint: () => void;
}) {
  return (
    <>
      <NavLink
        href={DASHBOARD_NAV.href}
        label={DASHBOARD_NAV.label}
        icon={DASHBOARD_NAV.icon}
        isActive={active === DASHBOARD_NAV.href}
        onDark
        onClick={onNavigate}
        hint={NAV_HINTS[DASHBOARD_NAV.href]}
        describedBy={hint?.href === DASHBOARD_NAV.href ? NAV_TOOLTIP_ID : undefined}
        onShowHint={onShowHint}
        onHideHint={onHideHint}
      />
      <div className="my-2 h-px bg-white/10" aria-hidden />
      {NAV_GROUPS.map((group) => (
        <div key={group.label} className="flex flex-col gap-1">
          <p className="px-3 pt-3 pb-1 text-[11px] font-semibold tracking-wide text-sand-400 uppercase">
            {group.label}
          </p>
          {group.items.map((item) => (
            <NavLink
              key={item.href}
              href={item.href}
              label={item.label}
              icon={item.icon}
              isActive={active === item.href}
              onDark
              onClick={onNavigate}
              hint={NAV_HINTS[item.href]}
              describedBy={hint?.href === item.href ? NAV_TOOLTIP_ID : undefined}
              onShowHint={onShowHint}
              onHideHint={onHideHint}
              badge={
                item.href === "/admin/notifications"
                  ? notificationsBadge
                  : item.href === "/admin/messages"
                    ? messagesBadge
                    : undefined
              }
            />
          ))}
        </div>
      ))}
    </>
  );
}

/** Staff console: navy ops sidebar, searchable top bar, profile footer. */
export function AdminShell({
  session,
  children,
}: {
  session: MockSession;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const active = activeHref(pathname);
  // Messages is a full-height view: the inbox card must fill exactly what the
  // top bar leaves, so the thread scrolls inside the card and the composer never
  // falls below the fold. `min-h-dvh` alone would let the card grow with the
  // thread and push the whole document into a scroll.
  const fullHeight = activeHref(pathname) === "/admin/messages";
  const [mobileOpen, setMobileOpen] = useState(false);
  const { unread: notificationUnread } = useAdminNotifications();
  const { unread: messagesUnread } = useAdminMessagesUnread();

  // Sidebar hover tooltips: a short delay keeps them from flickering while the
  // pointer travels down the list, and Escape dismisses the visible one.
  const [hint, setHint] = useState<NavHintState | null>(null);
  const hintTimer = useRef<number | null>(null);
  const showHint = useCallback((next: NavHintState) => {
    if (hintTimer.current) window.clearTimeout(hintTimer.current);
    hintTimer.current = window.setTimeout(() => setHint(next), 180);
  }, []);
  const hideHint = useCallback(() => {
    if (hintTimer.current) window.clearTimeout(hintTimer.current);
    setHint(null);
  }, []);
  useEffect(
    () => () => {
      if (hintTimer.current) window.clearTimeout(hintTimer.current);
    },
    [],
  );
  useEffect(() => {
    if (!hint) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") hideHint();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [hint, hideHint]);

  const navRef = useRef<HTMLElement | null>(null);
  const [navScroll, setNavScroll] = useState({ canScroll: false, thumbHeight: 0, thumbTop: 0 });

  useEffect(() => {
    const el = navRef.current;
    if (!el) return;
    const measure = () => {
      const canScroll = el.scrollHeight > el.clientHeight + 2;
      const thumbHeight = canScroll ? Math.max(20, (el.clientHeight / el.scrollHeight) * 100) : 0;
      setNavScroll({
        canScroll,
        thumbHeight,
        thumbTop: canScroll
          ? (el.scrollTop / Math.max(el.scrollHeight - el.clientHeight, 1)) * (100 - thumbHeight)
          : 0,
      });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    el.addEventListener("scroll", measure, { passive: true });
    return () => {
      observer.disconnect();
      el.removeEventListener("scroll", measure);
    };
  }, []);

  useEffect(() => {
    if (!mobileOpen) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = original;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [mobileOpen]);
  const name = session.name ?? "Ada Okafor";
  const initials = name
    .split(" ")
    .map((part) => part.charAt(0))
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const sectionLabel = ALL_NAV.find((item) => item.href === active)?.label ?? "Overview";

  return (
    <div
      className={cn(
        "min-h-dvh bg-sand-100/70",
        // The root owns the viewport height on this route: the app bar above
        // `main` is in flow, so a definite height here (not on `main`) is what
        // keeps the card inside the screen and the document still.
        fullHeight && "flex h-dvh flex-col overflow-hidden",
      )}
    >
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-brand-800 bg-brand-900 lg:flex">
        <div className="flex items-center justify-between px-6 pt-6 pb-5">
          <Link
            href="/"
            aria-label="FAYFORT — home"
            className="flex shrink-0 items-center"
          >
            <SiteLogo onDark />
          </Link>
        </div>

        <nav
          ref={navRef}
          className="relative flex flex-1 flex-col gap-1 overflow-y-auto px-3 pb-4"
        >
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-1 right-0.5 z-10 w-px bg-white/10"
          />
          <span
            aria-hidden
            className={cn(
              "pointer-events-none absolute right-0.5 z-10 w-px rounded-full bg-white/50 shadow-[0_0_4px_rgba(255,255,255,0.35)] transition-[opacity,top,height] duration-200",
              navScroll.canScroll ? "opacity-100" : "opacity-0",
            )}
            style={{
              top: `${navScroll.thumbTop}%`,
              height: `${navScroll.thumbHeight}%`,
            }}
          />
          <SideGroupList
            active={active}
            notificationsBadge={notificationUnread}
            messagesBadge={messagesUnread}
            hint={hint}
            onShowHint={showHint}
            onHideHint={hideHint}
          />
        </nav>

        <div className="border-t border-sand-800 p-4">
          <LogoutButton
            label="Sign out"
            destination="/admin/login"
            className="mt-3 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-sand-400 transition-colors hover:bg-white/5 hover:text-white"
          >
            <LogOut aria-hidden className="size-4" />
          </LogoutButton>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 border-b border-brand-800 bg-brand-900 lg:hidden">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <span className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-label="Open admin menu"
              aria-expanded={mobileOpen}
              className="flex size-8 items-center justify-center rounded-md text-sand-400 transition-colors hover:bg-white/5 hover:text-white"
            >
              <Menu aria-hidden className="size-4" />
            </button>
            <Link href="/" aria-label="FAYFORT — home" className="flex shrink-0 items-center">
              <SiteLogo onDark />
            </Link>
          </span>
          <span className="flex items-center gap-1.5">
            <AdminBell theme="dark" />
            <span
              aria-hidden
              className="flex size-8 items-center justify-center rounded-full bg-sand-700 font-display text-xs font-semibold text-white"
            >
              {initials}
            </span>
            <LogoutButton
              iconOnly
              ariaLabel="Sign out"
              destination="/admin/login"
              className="flex size-8 items-center justify-center rounded-md text-sand-400 transition-colors hover:bg-white/5 hover:text-white"
            >
              <LogOut aria-hidden className="size-4" />
            </LogoutButton>
          </span>
        </div>
      </header>

      {/* Mobile navigation drawer */}
      {mobileOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            aria-hidden
            className="absolute inset-0 animate-[fade-in_200ms_ease-out] bg-brand-950/60 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Admin menu"
            className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] animate-[drawer-in_220ms_ease-out] flex-col border-r border-brand-800 bg-brand-900 shadow-2xl"
          >
            <div className="flex items-center justify-between px-5 pt-5 pb-4">
              <Link
                href="/"
                aria-label="FAYFORT — home"
                className="flex shrink-0 items-center"
                onClick={() => setMobileOpen(false)}
              >
                <SiteLogo onDark />
              </Link>
              <button
                type="button"
                autoFocus
                onClick={() => setMobileOpen(false)}
                aria-label="Close admin menu"
                className="flex size-8 items-center justify-center rounded-md text-sand-400 transition-colors hover:bg-white/5 hover:text-white"
              >
                <X aria-hidden className="size-4" />
              </button>
            </div>
            <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 pb-6">
              <SideGroupList
                active={active}
                onNavigate={() => setMobileOpen(false)}
                notificationsBadge={notificationUnread}
                messagesBadge={messagesUnread}
                hint={hint}
                onShowHint={showHint}
                onHideHint={hideHint}
              />
            </nav>
          </div>
        </div>
      ) : null}

      <main
        className={cn(
          "flex min-h-dvh flex-col lg:pl-64",
          // `flex-1` (with the root pinned to `h-dvh`) is what hands the page a
          // definite leftover height; without it the flex chain below collapses
          // to its content, so an empty chat thread shrinks the card to the
          // header and composer instead of pinning the composer at the bottom.
          fullHeight && "min-h-0 flex-1",
        )}
      >
        {/* Desktop top bar */}
        <div className="sticky top-0 z-20 flex items-center justify-between gap-4 border-b border-sand-200 bg-white/90 px-6 py-2.5 backdrop-blur">
          <p className="flex items-center gap-3 font-display text-sm font-semibold text-brand-900">
            <span className="hidden h-4 w-px bg-sand-300 xl:block" aria-hidden />
            {sectionLabel}
          </p>
          <div className="flex items-center gap-2">
            <GlobalSearchModal />
            <AdminBell theme="light" />
            <span className="flex items-center gap-2 rounded-md border border-sand-200 bg-white px-2 py-1.5 shadow-sm">
              <span className="flex size-6 items-center justify-center rounded-full bg-sand-700 font-display text-[11px] font-semibold text-white">
                {initials}
              </span>
              <span className="hidden flex-col leading-tight sm:flex">
                <span className="text-xs font-semibold text-sand-900">{name}</span>
                <span className="text-[11px] text-sand-500">Administrator</span>
              </span>
            </span>
          </div>
        </div>
        {children}
      </main>
      <NavTooltip hint={hint} />
    </div>
  );
}