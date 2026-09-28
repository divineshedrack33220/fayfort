"use client";

import { useEffect } from "react";

const MESSAGE_SOURCE = "fayfort-google-auth";

/**
 * Runs inside the Google sign-in popup when it returns to /auth/callback. The
 * popup URL is same-origin, so it reads the one-time code + state, hands them
 * to the opener over postMessage, then closes itself. The opener (not this
 * window) performs the code exchange and lands the visitor on their dashboard.
 */
export function AuthCallbackBridge() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    try {
      window.opener?.postMessage(
        {
          source: MESSAGE_SOURCE,
          code: params.get("code") ?? "",
          state: params.get("state") ?? "",
          error: params.get("error") ?? "",
        },
        window.location.origin,
      );
    } catch {
      // No accessible opener (e.g. it was already closed) — nothing to notify.
    }
    window.close();
  }, []);
  return null;
}
