"use client";

import * as React from "react";
import Link from "next/link";
import { openGoogleSignIn, googleRoleLanding, type GsiUnavailable } from "@/lib/google-auth";
import { SignInUnavailable } from "@/components/auth/sign-in-unavailable";
import { useSignInStatus } from "@/components/auth/use-sign-in-status";

/**
 * A link to a customer page that behaves like the header Sign In / Get Started
 * actions. Visitors who are already signed in just follow the link; anyone
 * else is sent straight to the Google account chooser (create-or-login in one
 * step) and lands on `href` afterwards. Used for every "Get a Quote" / "My
 * Requests" call to action so no button on the site silently dead-ends.
 */
export function AuthActionLink({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: React.ReactNode;
}) {
  const signedIn = useSignInStatus();
  const [unavailable, setUnavailable] = React.useState<GsiUnavailable | null>(null);

  const handleClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (signedIn) return;
    const started = openGoogleSignIn(
      (role) => window.location.assign(googleRoleLanding(role, href)),
      (info) => setUnavailable(info),
    );
    if (started) event.preventDefault();
  };

  return (
    <>
      <Link href={href} onClick={handleClick} className={className}>
        {children}
      </Link>
      {unavailable && (
        <SignInUnavailable info={unavailable} onDismiss={() => setUnavailable(null)} />
      )}
    </>
  );
}
