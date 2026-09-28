import type { Metadata } from "next";
import { AuthCallbackBridge } from "@/components/auth/auth-callback-bridge";

export const metadata: Metadata = {
  title: "Signing you in",
  robots: { index: false, follow: false },
};

/**
 * Interstitial for the Google popup sign-in flow. Google redirects here with
 * a short-lived code + state; {@link AuthCallbackBridge} forwards them to the
 * opener over postMessage and closes the popup. This page only exists so the
 * popup has a same-origin, non-404 destination.
 */
export default function AuthCallbackPage() {
  return (
    <main className="bg-brand-950 flex min-h-screen items-center justify-center px-6">
      <p className="text-brand-200 text-sm">
        Signing you in to Fayfort… you can close this window.
      </p>
      <AuthCallbackBridge />
    </main>
  );
}
