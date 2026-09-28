"use client";

import * as React from "react";
import { BellRing, BellOff, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useServiceWorker } from "@/components/pwa/service-worker-provider";

type PushState =
  | "loading"
  | "unsupported"
  | "blocked"
  | "off"
  | "on"
  | "error";

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(normalized);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}

const postJSON = async (path: string, body?: unknown) => {
  const response = await fetch(`/api/backend${path}`, {
    method: "POST",
    ...(body === undefined ? {} : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
  });
  const payload = await response.json().catch(() => null);
  return { ok: response.ok, status: response.status, payload };
};

/**
 * Opt-in control for real Web Push. Enabling asks for browser permission,
 * creates a push subscription with the server's VAPID key, and registers the
 * device so notifications reach it even when the app is closed.
 */
export function PushNotificationToggle({ className }: { className?: string }) {
  const { supported } = useServiceWorker();
  const [state, setState] = React.useState<PushState>("loading");
  const [pending, setPending] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);
  const [publicKey, setPublicKey] = React.useState<string | null>(null);

  const sync = React.useCallback(async (sub: PushSubscription | null) => {
    if (!sub) {
      setState("off");
      return;
    }
    // Re-register on load: it repairs devices whose subscription was lost when
    // the server database was reset, and refreshes the stored keys.
    const result = await postJSON("/push/subscribe", sub.toJSON());
    setState(result.ok ? "on" : "off");
  }, []);

  React.useEffect(() => {
    if (!supported) return;
    let disposed = false;

    const load = async () => {
      if (typeof Notification === "undefined" || !("PushManager" in window)) {
        if (!disposed) setState("unsupported");
        return;
      }
      if (Notification.permission === "denied") {
        if (!disposed) setState("blocked");
        return;
      }
      const keyResponse = await fetch("/api/backend/push/public-key", { cache: "no-store" });
      const keyPayload = (await keyResponse.json().catch(() => null)) as {
        publicKey?: string;
        enabled?: boolean;
      } | null;
      if (!disposed) setPublicKey(keyPayload?.publicKey ?? null);

      const registration = await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();
      if (disposed) return;
      if (existing && Notification.permission === "granted") {
        await sync(existing);
        return;
      }
      setState("off");
    };

    const timer = window.setTimeout(() => void load(), 0);
    return () => {
      disposed = true;
      window.clearTimeout(timer);
    };
  }, [supported, sync]);

  const enable = React.useCallback(async () => {
    setPending(true);
    setMessage(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "blocked" : "off");
        if (permission === "denied") {
          setMessage("Notifications are blocked in your browser settings.");
        }
        return;
      }
      if (!publicKey) {
        setState("error");
        setMessage("Push is not configured on this server yet.");
        return;
      }
      const registration = await navigator.serviceWorker.ready;
      const sub =
        (await registration.pushManager.getSubscription()) ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        }));
      const result = await postJSON("/push/subscribe", sub.toJSON());
      setState(result.ok ? "on" : "error");
      if (!result.ok) setMessage("Could not save this device for push notifications.");
    } catch {
      setState("error");
      setMessage("Could not enable push notifications on this device.");
    } finally {
      setPending(false);
    }
  }, [publicKey]);

  const disable = React.useCallback(async () => {
    setPending(true);
    setMessage(null);
    try {
      const registration = await navigator.serviceWorker.ready;
      const sub = await registration.pushManager.getSubscription();
      if (sub) {
        await postJSON("/push/unsubscribe", sub.toJSON());
        await sub.unsubscribe();
      }
      setState("off");
    } catch {
      setState("error");
      setMessage("Could not turn push notifications off.");
    } finally {
      setPending(false);
    }
  }, []);

  const sendTest = React.useCallback(async () => {
    setPending(true);
    setMessage(null);
    try {
      const result = await postJSON("/push/test");
      if (result.ok) {
        const data = result.payload as { sent?: number } | null;
        setMessage(
          data?.sent
            ? "Sent. Check your device notifications with the app closed."
            : "Sent, but no device confirmed delivery.",
        );
      } else {
        setMessage(
          result.status === 400
            ? "This device is not registered for push yet."
            : "Could not send a test notification.",
        );
      }
    } finally {
      setPending(false);
    }
  }, []);

  if (!supported || state === "unsupported" || state === "loading") return null;

  return (
    <div
      data-testid="push-notification-toggle"
      className={className ?? "rounded-xl border border-sand-200 bg-white p-4"}
    >
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-100 text-brand-700">
          {state === "on" ? (
            <BellRing aria-hidden className="size-4" />
          ) : (
            <BellOff aria-hidden className="size-4" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-sand-900">
            Push notifications
          </p>
          <p className="mt-0.5 text-xs text-sand-600">
            {state === "on"
              ? "This device is registered. Alerts arrive even when Fayfort is closed."
              : state === "blocked"
                ? "Notifications are blocked. Allow them in your browser settings to enable alerts."
                : "Get alerted on this device even when Fayfort is closed."}
          </p>
        </div>
      </div>

      {message ? (
        <p
          role="status"
          data-testid="push-toggle-message"
          className="mt-3 text-xs text-sand-600"
        >
          {message}
        </p>
      ) : null}

      {state !== "blocked" ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {state === "on" ? (
            <>
              <Button size="sm" intent="outline" loading={pending} onClick={() => void sendTest()}>
                <Send aria-hidden className="size-3.5" />
                Send test
              </Button>
              <Button size="sm" intent="ghost" loading={pending} onClick={() => void disable()}>
                Turn off
              </Button>
            </>
          ) : (
            <Button size="sm" intent="primary" loading={pending} onClick={() => void enable()}>
              <BellRing aria-hidden className="size-3.5" />
              Enable on this device
            </Button>
          )}
        </div>
      ) : null}
    </div>
  );
}
