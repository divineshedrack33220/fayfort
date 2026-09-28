"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SESSION_COOKIE } from "@/lib/auth";
import {
  openGoogleSignIn,
  googleDestination,
  type GsiUnavailable,
} from "@/lib/google-auth";
import { SignInUnavailable } from "@/components/auth/sign-in-unavailable";

/**
 * Header "Get Started" call to action. For a signed-out visitor it goes
 * straight to the Google account chooser (one step to create or log in) and
 * lands them on the request builder afterwards; signed-in users just go to
 * `/apply` directly.
 */
export function GetStartedButton({ className }: { className?: string }) {
  const router = useRouter();
  const signedIn = React.useSyncExternalStore(
    () => () => {},
    () => document.cookie,
    () => "",
  ).includes(`${SESSION_COOKIE}=`);
  const [unavailable, setUnavailable] = React.useState<GsiUnavailable | null>(
    null,
  );

  const start = () => {
    if (signedIn) {
      router.push("/apply");
      return;
    }
    const started = openGoogleSignIn(
      (role) => router.replace(googleDestination(role, "/apply")),
      (info) => setUnavailable(info),
    );
    if (!started) router.push("/apply");
  };

  return (
    <>
      <Button
        type="button"
        intent="accent"
        size="sm"
        className={cn("whitespace-nowrap", className)}
        onClick={start}
      >
        Get Started
      </Button>
      {unavailable && (
        <SignInUnavailable info={unavailable} onDismiss={() => setUnavailable(null)} />
      )}
    </>
  );
}