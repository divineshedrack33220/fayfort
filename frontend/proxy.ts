import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth";

/** Base URL of the Go service. Small enough to keep inline so the middleware
 * bundle stays dependency-free (lib/backend.ts is server-only). */
const BACKEND_URL = process.env.BACKEND_URL || "http://127.0.0.1:8080";

/**
 * Optimistic gate: protected routes require a real session, and the staff
 * console additionally validates the session's role against the backend.
 * This is the coarse, fast check — pages re-check server-side with
 * getSession() before rendering. If the backend is unreachable the gate
 * falls back to cookie-presence so a backend hiccup never hard-locks users
 * into a redirect loop.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const next = pathname + request.nextUrl.search;
  const raw = request.cookies.get(SESSION_COOKIE)?.value;

  let role: "admin" | "customer" | null = null;
  if (raw) {
    try {
      const res = await fetch(`${BACKEND_URL}/api/me`, {
        headers: { cookie: `${SESSION_COOKIE}=${raw}` },
        cache: "no-store",
      });
      if (res.ok) {
        const body = (await res.json()) as { user?: { role?: string } };
        if (body.user?.role === "admin") role = "admin";
        else if (body.user?.role) role = "customer";
      }
    } catch {
      role = raw ? "customer" : null; // backend down — presence fallback
    }
  }

  // Staff console: public login screen, everything else admin-only.
  if (pathname.startsWith("/admin")) {
    if (pathname === "/admin/login" || pathname === "/admin/login/") {
      return NextResponse.next();
    }
    if (role !== "admin") {
      const url = request.nextUrl.clone();
      url.pathname = "/admin/login";
      url.search = "";
      url.searchParams.set("next", next);
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  // Customer portal. Signed-out visitors are sent to the landing page with
  // their destination in `next` so the Google sign-in continues where they
  // intended to go.
  if (role) {
    return NextResponse.next();
  }
  const url = request.nextUrl.clone();
  url.pathname = "/";
  url.searchParams.set("next", next);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    "/overview/:path*",
    "/calculator/:path*",
    "/dashboard/:path*",
    "/chat/:path*",
    "/profile/:path*",
    "/settings/:path*",
    "/notifications/:path*",
    "/admin/:path*",
  ],
};