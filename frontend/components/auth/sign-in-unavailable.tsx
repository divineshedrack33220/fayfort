"use client";

import * as React from "react";
import { X } from "lucide-react";
import type { GsiUnavailable } from "@/lib/google-auth";

const GOOGLE_CONSOLE_URL = "https://console.cloud.google.com/apis/credentials";

/**
 * Bottom toast shown only when Google declines to display the account chooser
 * (usually the page origin is missing from the OAuth client's authorized
 * JavaScript origins). Gives the visitor a concrete next step instead of a
 * silently dead button.
 */
export function SignInUnavailable({
  info,
  onDismiss,
}: {
  info: GsiUnavailable;
  onDismiss: () => void;
}) {
  return (
    <div
      role="status"
      className="fixed inset-x-0 bottom-4 z-50 flex justify-center px-4"
    >
      <div className="flex max-w-xl items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3 shadow-lg">
        <p className="text-sm leading-relaxed text-amber-900">
          Google sign-in didn&apos;t open ({info.reason}). Add{" "}
          <code className="rounded bg-amber-100 px-1 py-0.5 font-mono text-xs">
            {info.origin}
          </code>{" "}
          to the OAuth client&apos;s{" "}
          <a
            href={GOOGLE_CONSOLE_URL}
            target="_blank"
            rel="noreferrer"
            className="font-semibold underline decoration-amber-500 hover:text-amber-950"
          >
            Authorized JavaScript origins
          </a>{" "}
          in Google Cloud, then try again.
        </p>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="mt-0.5 shrink-0 rounded p-1 text-amber-700 transition-colors hover:bg-amber-200"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}