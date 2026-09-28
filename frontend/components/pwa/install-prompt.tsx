"use client";

import * as React from "react";
import { Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const DISMISS_KEY = "fayfort:install-dismissed-at";
const DISMISS_FOR_MS = 7 * 24 * 60 * 60 * 1000;

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  window.matchMedia("(display-mode: window-controls-overlay)").matches ||
  // iOS Safari reports an installed PWA through the navigator instead.
  (window.navigator as { standalone?: boolean }).standalone === true;

const isIOS = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

/**
 * Offers to install Fayfort as an app. Chromium fires `beforeinstallprompt`
 * which lets us show a real install button; iOS has no such event, so it gets
 * the "Share → Add to Home Screen" instructions instead.
 *
 * The prompt is intentionally a single dismissible card: a dismissal is
 * remembered for a week so it never nags.
 */
export function InstallPrompt() {
  const [deferred, setDeferred] = React.useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = React.useState(false);
  const [dismissed, setDismissed] = React.useState(true);
  const [iosHint, setIosHint] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    const settle = () => {
      const stored = Number(window.localStorage.getItem(DISMISS_KEY) || 0);
      const stale = stored === 0 || Date.now() - stored > DISMISS_FOR_MS;
      setDismissed(!stale);
      if (isStandalone()) setInstalled(true);
      if (isIOS()) setIosHint(true);
    };
    const timer = window.setTimeout(settle, 0);

    const onPrompt = (event: Event) => {
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
      window.localStorage.removeItem(DISMISS_KEY);
    };

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const dismiss = React.useCallback(() => {
    window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setDismissed(true);
  }, []);

  const install = React.useCallback(async () => {
    if (!deferred) return;
    setBusy(true);
    try {
      await deferred.prompt();
      const { outcome } = await deferred.userChoice;
      if (outcome === "accepted") {
        setInstalled(true);
        window.localStorage.removeItem(DISMISS_KEY);
      } else {
        dismiss();
      }
    } finally {
      setBusy(false);
      setDeferred(null);
    }
  }, [deferred, dismiss]);

  if (installed || dismissed) return null;
  if (!deferred && !iosHint) return null;

  return (
    <aside
      data-testid="pwa-install-prompt"
      aria-label="Install Fayfort"
      className="fixed inset-x-3 bottom-3 z-40 mx-auto flex max-w-sm items-start gap-3 rounded-xl border border-sand-200 bg-white/95 p-3 shadow-lg backdrop-blur sm:inset-x-auto sm:right-4 sm:bottom-4"
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-100 text-brand-700">
        <Download aria-hidden className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-sand-900">Install Fayfort</p>
        {deferred ? (
          <p className="mt-0.5 text-xs text-sand-600">
            Add the app to your device for faster access and notifications.
          </p>
        ) : (
          <p className="mt-0.5 text-xs text-sand-600">
            Tap the Share button, then &ldquo;Add to Home Screen&rdquo;.
          </p>
        )}
        {deferred ? (
          <div className="mt-2 flex items-center gap-2">
            <Button size="sm" intent="primary" loading={busy} onClick={() => void install()}>
              Install
            </Button>
            <Button size="sm" intent="ghost" onClick={dismiss}>
              Not now
            </Button>
          </div>
        ) : null}
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss install prompt"
        className="rounded-md p-1 text-sand-400 transition-colors hover:bg-sand-100 hover:text-sand-600"
      >
        <X aria-hidden className="size-4" />
      </button>
    </aside>
  );
}
