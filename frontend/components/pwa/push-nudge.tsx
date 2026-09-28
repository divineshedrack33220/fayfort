"use client";

import * as React from "react";
import { BellRing, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useServiceWorker } from "@/components/pwa/service-worker-provider";
import { savePushSubscription, subscribePush } from "@/lib/push";
import { cn } from "@/lib/utils";

type State = "loading" | "off" | "blocked" | "on" | "done";

/**
 * A slim, dismissible banner that prompts for notification permission where
 * calls live (the chat rooms). Web Push is what makes an incoming call ring a
 * closed or backgrounded browser, so this nudge appears until the device is
 * subscribed or the user dismisses it for the tab.
 */
export function PushNudge({ className }: { className?: string }) {
  const { supported } = useServiceWorker();
  const [state, setState] = React.useState<State>("loading");
  const [dismissed, setDismissed] = React.useState(false);
  const [publicKey, setPublicKey] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  React.useEffect(() => {
    if (!supported) return;
    let disposed = false;
    const load = async () => {
      if (typeof Notification === "undefined" || !("PushManager" in window)) {
        if (!disposed) setState("done");
        return;
      }
      if (Notification.permission === "denied") {
        if (!disposed) setState("blocked");
        return;
      }
      try {
        const keyResponse = await fetch("/api/backend/push/public-key", { cache: "no-store" });
        const keyPayload = (await keyResponse.json().catch(() => null)) as {
          publicKey?: string;
        } | null;
        if (disposed) return;
        setPublicKey(keyPayload?.publicKey ?? null);
        const registration = await navigator.serviceWorker.ready;
        const existing = await registration.pushManager.getSubscription();
        if (disposed) return;
        setState(existing ? "on" : "off");
      } catch {
        // No service worker or offline: calls still work in-app, just not as
        // OS notifications.
        if (!disposed) setState("done");
      }
    };
    const timer = window.setTimeout(() => void load(), 0);
    return () => {
      disposed = true;
      window.clearTimeout(timer);
    };
  }, [supported]);

  const enable = React.useCallback(async () => {
    setPending(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "blocked" : "off");
        return;
      }
      if (!publicKey) {
        setState("done");
        return;
      }
      const sub = await subscribePush(publicKey);
      if (!sub) {
        setState("done");
        return;
      }
      const result = await savePushSubscription(sub);
      setState(result.ok ? "done" : "off");
    } catch {
      setState("off");
    } finally {
      setPending(false);
    }
  }, [publicKey]);

  if (!supported || dismissed || state === "loading" || state === "on" || state === "done") {
    return null;
  }

  return (
    <div
      role="status"
      data-testid="push-nudge"
      className={cn(
        "border-accent-200 bg-accent-50/70 flex items-center gap-3 rounded-xl border px-3 py-2 sm:py-2.5",
        className,
      )}
    >
      <span className="bg-accent-100 text-accent-700 flex size-8 shrink-0 items-center justify-center rounded-lg">
        <BellRing aria-hidden className="size-4" />
      </span>
      <p className="text-sand-700 min-w-0 flex-1 text-xs leading-relaxed">
        {state === "blocked"
          ? "Notifications are blocked in your browser — calls may be missed on this device. Allow them in your browser settings."
          : "Allow notifications so calls ring here and missed calls show up."}
      </p>
      {state !== "blocked" ? (
        <Button size="sm" intent="primary" loading={pending} onClick={() => void enable()}>
          Allow notifications
        </Button>
      ) : null}
      <button
        type="button"
        aria-label="Dismiss"
        onClick={() => setDismissed(true)}
        className="text-sand-400 hover:text-sand-700"
      >
        <X aria-hidden className="size-4" />
      </button>
    </div>
  );
}
