"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";

const UPDATE_CHECK_MS = 60_000;

type ServiceWorkerContextValue = {
  /** True when the browser can run a service worker (i.e. a secure context). */
  supported: boolean;
  registration: ServiceWorkerRegistration | null;
  /** A newer build is installed and waiting to take over. */
  updateAvailable: boolean;
  /** Activate the waiting worker and reload. */
  applyUpdate: () => void;
};

const ServiceWorkerContext = React.createContext<ServiceWorkerContextValue>({
  supported: false,
  registration: null,
  updateAvailable: false,
  applyUpdate: () => {},
});

/** Access the Fayfort service worker registration and update state. */
export function useServiceWorker() {
  return React.useContext(ServiceWorkerContext);
}

/**
 * Registers the service worker that powers offline support and web push, and
 * surfaces a non-blocking prompt when a new build is waiting to activate.
 *
 * Registration is skipped for browsers without service worker support; the rest
 * of the app never depends on it.
 */
export function ServiceWorkerProvider({ children }: { children: React.ReactNode }) {
  const [supported, setSupported] = React.useState(false);
  const [registration, setRegistration] = React.useState<ServiceWorkerRegistration | null>(
    null,
  );
  const [updateAvailable, setUpdateAvailable] = React.useState(false);

  React.useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    const timer = window.setTimeout(() => setSupported(true), 0);
    let disposed = false;
    let poller = 0;

    const watchForUpdates = (reg: ServiceWorkerRegistration) => {
      if (reg.waiting && navigator.serviceWorker.controller) {
        setUpdateAvailable(true);
      }
      reg.addEventListener("updatefound", () => {
        const installing = reg.installing;
        if (!installing) return;
        installing.addEventListener("statechange", () => {
          // An already-controlled page means this is an update, not the very
          // first install (which needs no reload).
          if (installing.state === "installed" && navigator.serviceWorker.controller) {
            setUpdateAvailable(true);
          }
        });
      });
      window.clearInterval(poller);
      poller = window.setInterval(() => {
        void reg.update().catch(() => undefined);
      }, UPDATE_CHECK_MS);
    };

    void navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .then((reg) => {
        if (disposed) return;
        setRegistration(reg);
        watchForUpdates(reg);
      })
      .catch(() => {
        /* registration failed (private mode, blocked SW) — the app still works */
      });

    return () => {
      disposed = true;
      window.clearTimeout(timer);
      window.clearInterval(poller);
    };
  }, []);

  const applyUpdate = React.useCallback(() => {
    const waiting = registration?.waiting;
    if (!waiting) {
      window.location.reload();
      return;
    }
    const reload = () => window.location.reload();
    waiting.addEventListener("statechange", () => {
      if (waiting.state === "activated") reload();
    });
    waiting.postMessage({ type: "SKIP_WAITING" });
  }, [registration]);

  const value = React.useMemo<ServiceWorkerContextValue>(
    () => ({ supported, registration, updateAvailable, applyUpdate }),
    [supported, registration, updateAvailable, applyUpdate],
  );

  return (
    <ServiceWorkerContext.Provider value={value}>
      {children}
      {updateAvailable ? (
        <div
          role="status"
          data-testid="sw-update-prompt"
          className="fixed inset-x-3 bottom-3 z-50 mx-auto flex max-w-sm items-center gap-3 rounded-xl border border-sand-200 bg-white/95 p-3 shadow-lg backdrop-blur sm:inset-x-auto sm:right-4 sm:bottom-4"
        >
          <p className="flex-1 text-sm text-sand-700">
            A new version of Fayfort is ready.
          </p>
          <Button size="sm" intent="primary" onClick={applyUpdate}>
            Reload
          </Button>
        </div>
      ) : null}
    </ServiceWorkerContext.Provider>
  );
}
