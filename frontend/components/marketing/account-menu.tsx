"use client";

import * as React from "react";
import { SESSION_COOKIE } from "@/lib/auth";
import { LogoutButton } from "@/components/auth/logout-button";
import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";
import { cn } from "@/lib/utils";

/**
 * Read document.cookie as an external store so we render without effect
 * cascades and stay compliant with React's rules of hooks lint.
 */
function useSessionCookie(): string {
  return React.useSyncExternalStore(
    () => () => {}, // no external subscription; cookies are read on render
    () => document.cookie,
    () => "", // server snapshot — never touches the client document
  );
}

/**
 * Header account chip. Since the Go backend session cookie is an opaque
 * token, signed-in state is presence-based here (the server re-validates on
 * every protected render). Marketing pages stay statically prerenderable —
 * no server cookies call.
 */
export function AccountMenu({ className }: { className?: string }) {
  const cookie = useSessionCookie();
  const signedIn = cookie.includes(`${SESSION_COOKIE}=`);

  if (!signedIn) {
    return <GoogleSignInButton className={className} />;
  }

  return (
    <div className={cn("inline-flex items-center gap-2", className)}>
      <span className="hidden max-w-40 truncate rounded-md bg-white/10 px-3 py-2 text-sm font-medium text-white sm:inline-block">
        Account
      </span>
      <LogoutButton
        label="Sign out"
        className="rounded-md border border-white/25 bg-white/5 px-3 py-2 text-sm font-medium whitespace-nowrap text-brand-100 shadow-sm transition-colors hover:bg-white/10 hover:text-white focus-visible:bg-white/10 focus-visible:outline-none"
      />
    </div>
  );
}