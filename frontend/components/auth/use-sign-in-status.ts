"use client";

import * as React from "react";

/**
 * Whether the current visitor holds a Fayfort session. The Go session cookie
 * is HttpOnly — invisible to document.cookie — so presence is probed with
 * /api/backend/me, which the browser automatically attaches the cookie to.
 * Returns false while the probe is in flight to keep the header static on
 * prerendered marketing pages.
 */
export function useSignInStatus(): boolean {
  const [signedIn, setSignedIn] = React.useState(false);
  React.useEffect(() => {
    let active = true;
    fetch("/api/backend/me", { cache: "no-store" })
      .then((res) => {
        if (active) setSignedIn(res.ok);
      })
      .catch(() => {
        if (active) setSignedIn(false);
      });
    return () => {
      active = false;
    };
  }, []);
  return signedIn;
}