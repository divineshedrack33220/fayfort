/**
 * Shared helpers for the browser push/subscription flow.
 *
 * Kept out of React components so both the full opt-in toggle and the slimmer
 * call nudge can reuse the same subscription mechanics.
 */
export function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(normalized);
  const output = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}

/**
 * Subscribes the current service worker for push using the server's VAPID
 * public key, reusing an existing subscription when one is already present.
 * Returns the push subscription, or null when registration is unavailable.
 */
export async function subscribePush(
  applicationServerKey: string,
): Promise<PushSubscription | null> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return null;
  const registration = await navigator.serviceWorker.ready;
  const existing = await registration.pushManager.getSubscription();
  if (existing) return existing;
  return registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(applicationServerKey),
  });
}

/** Persists a subscription with the backend so push reaches this device. */
export async function savePushSubscription(sub: PushSubscription, path = "/push/subscribe") {
  const response = await fetch(`/api/backend${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(sub.toJSON()),
  });
  return { ok: response.ok, status: response.status };
}
