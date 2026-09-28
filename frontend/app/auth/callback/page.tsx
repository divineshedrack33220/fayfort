import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Signing you in",
  robots: { index: false, follow: false },
};

/**
 * Interstitial for the Google popup sign-in flow. The id_token is delivered
 * in the URL fragment and read by the opener window (lib/google-auth.ts)
 * before this page ever paints; this page only exists so the popup has a
 * same-origin, non-404 destination.
 */
export default function AuthCallbackPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-brand-950 px-6">
      <p className="text-sm text-brand-200">
        Signing you in to Fayfort… you can close this window.
      </p>
    </main>
  );
}