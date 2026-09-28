"use client";

import { useEffect } from "react";
import { RefreshCw, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Last-resort boundary. It replaces the root layout, so it owns the document
 * shell — `app/error.tsx` renders inside the layout and must not.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body className="bg-brand-950 text-brand-100">
        <main className="flex min-h-dvh flex-col items-center justify-center gap-5 px-6 text-center">
          <span className="flex size-14 items-center justify-center rounded-full bg-white/5 ring-1 ring-white/10">
            <TriangleAlert aria-hidden className="size-6 text-accent-300" />
          </span>
          <div className="flex flex-col items-center gap-2">
            <h1 className="font-display text-3xl font-semibold text-white">
              Something went wrong
            </h1>
            <p className="max-w-sm text-sm leading-relaxed text-brand-200">
              An unexpected error came up. Try again — it usually resolves on a retry.
            </p>
            {error.digest ? (
              <p className="font-mono text-xs text-brand-300">Reference: {error.digest}</p>
            ) : null}
          </div>
          <Button intent="accent" onClick={reset}>
            <RefreshCw aria-hidden className="size-4" />
            Try again
          </Button>
        </main>
      </body>
    </html>
  );
}
