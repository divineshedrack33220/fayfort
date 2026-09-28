"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

const CONSOLES: Record<string, string> = {
  admin: "/admin",
  customer: "/overview",
};

function isStandaloneApp(): boolean {
  if (typeof window === "undefined") return false;
  if (window.matchMedia("(display-mode: standalone)").matches) return true;
  if (window.matchMedia("(display-mode: minimal-ui)").matches) return true;
  if (window.matchMedia("(display-mode: fullscreen)").matches) return true;
  const nav = navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true;
}

/**
 * When the site is installed and reopened as an app, a signed-in user should
 * launch straight into their console instead of the marketing landing page.
 * The session cookie is HttpOnly (invisible to document.cookie), so we probe
 * /api/backend/me — the browser attaches the cookie to that same-origin fetch.
 * Only runs in standalone display mode (installed PWA), so normal browser tab
 * browsing of the marketing site is unaffected and pages stay static.
 */
export function PwaLaunchRedirect() {
  const router = useRouter();

  React.useEffect(() => {
    if (!isStandaloneApp()) return;

    let active = true;
    fetch("/api/backend/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((body) => {
        if (!active || !body) return;
        const role = (body as { user?: { role?: string } }).user?.role;
        if (role) router.replace(CONSOLES[role] ?? "/overview");
      })
      .catch(() => {
        // Offline or backend unreachable: stay put.
      });
    return () => {
      active = false;
    };
  }, [router]);

  return null;
}