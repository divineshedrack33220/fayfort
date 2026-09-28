/**
 * Local Notification fallbacks for the call surface.
 *
 * These cover the gap a server-side push cannot: the invitee is *live* on the
 * thread (so the hub deliberately does not push a duplicate ring), but the tab
 * is backgrounded and the in-app ring card is invisible. When the browser has
 * notifications permission, a hidden tab raises its own OS alert instead.
 */
import type { CallMode } from "@/lib/chat-socket";

function browserCanNotify(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof Notification !== "undefined" &&
    Notification.permission === "granted"
  );
}

function callLabel(mode: CallMode): string {
  return mode === "audio" ? "Audio call" : "Video call";
}

export function notifyIncomingCall(peer: string, mode: CallMode): void {
  if (!document.hidden || !browserCanNotify()) return;
  new Notification(`Incoming call from ${peer}`, {
    body: `${callLabel(mode)} — open Fayfort to pick up.`,
    icon: "/icon-192.png",
    badge: "/badge-96.png",
    tag: `fayfort-call-${Date.now()}`,
    renotify: true,
    requireInteraction: true,
    vibrate: [300, 90, 300, 90, 700],
    // The platform's NotificationOptions type underspecifies the live
    // options; renotify/vibrate are standard and safe in browsers.
  } as NotificationOptions);
}

export function notifyMissedCall(peer: string, mode: CallMode): void {
  if (!document.hidden || !browserCanNotify()) return;
  new Notification("Missed call", {
    body: `You missed the ${callLabel(mode).toLowerCase()} with ${peer}.`,
    icon: "/icon-192.png",
    badge: "/badge-96.png",
    tag: `fayfort-missed-${Date.now()}`,
    requireInteraction: true,
    vibrate: [200, 60, 200],
  } as NotificationOptions);
}
