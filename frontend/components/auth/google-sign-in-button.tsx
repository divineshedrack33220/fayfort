"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { openGoogleSignIn, googleDestination, type GsiUnavailable } from "@/lib/google-auth";
import { SignInUnavailable } from "@/components/auth/sign-in-unavailable";

/**
 * Plain "Sign In" action for the marketing header. Clicking it opens the
 * Google account chooser, which either signs the person in or creates a
 * Fayfort account in one step — no signup forms anywhere. After auth the
 * account is hard-navigated to the destination for its role (admins to the
 * console, customers to their `/dashboard` or a safe `?next=` deep link) so
 * the landing is always server-rendered with the fresh session. If no OAuth
 * client id is configured the button falls back to a link to the landing
 * page.
 */
export function GoogleSignInButton({ className }: { className?: string }) {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";
  const [unavailable, setUnavailable] = React.useState<GsiUnavailable | null>(null);
  const [busy, setBusy] = React.useState(false);

  const handleClick = () => {
    openGoogleSignIn(
      (role) => window.location.assign(googleDestination(role, "/dashboard")),
      (info) => setUnavailable(info),
      (working) => setBusy(working),
    );
  };

  return (
    <>
      {!clientId ? (
        <Link href="/" className={cn(signInClasses, className)}>
          Sign In
        </Link>
      ) : (
        <button
          type="button"
          onClick={handleClick}
          disabled={busy}
          aria-busy={busy}
          className={cn(signInClasses, "disabled:opacity-60", className)}
        >
          {busy ? "Signing you in…" : "Sign In"}
        </button>
      )}
      {unavailable && (
        <SignInUnavailable info={unavailable} onDismiss={() => setUnavailable(null)} />
      )}
    </>
  );
}

const signInClasses =
  "rounded-md border border-white/25 bg-white/5 px-3 py-2 text-sm font-medium whitespace-nowrap text-white shadow-sm transition-colors hover:bg-white/10 focus-visible:bg-white/10 focus-visible:outline-none";
