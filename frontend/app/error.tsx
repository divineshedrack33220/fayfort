"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ErrorState } from "@/components/ui/error-state";
import { Button } from "@/components/ui/button";

/**
 * Segment error boundary — renders inside the root layout, so the visitor
 * keeps the header and can navigate away rather than being stranded.
 */
export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const offline =
    error instanceof TypeError && /fetch|network|load/i.test(error.message || "");

  return (
    <div className="container-shell flex min-h-[60vh] items-center justify-center py-12">
      <div className="flex w-full max-w-md flex-col gap-3">
        <ErrorState
          title={offline ? "We couldn’t reach the service" : "This page couldn’t load"}
          description={
            offline
              ? "The connection to Fayfort’s backend dropped. Check your network and try again — your data is safe."
              : "Something broke while rendering this page. Retrying usually clears it."
          }
          onRetry={reset}
        />
        {error.digest ? (
          <p className="text-center font-mono text-xs text-sand-400">
            Reference: {error.digest}
          </p>
        ) : null}
        <div className="flex justify-center gap-2">
          <Button asChild intent="neutral-outline" size="sm">
            <Link href="/">Back to home</Link>
          </Button>
          <Button asChild intent="neutral-outline" size="sm">
            <Link href="/contact">Contact support</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
