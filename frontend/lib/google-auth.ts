/**
 * Explains why the Google chooser could not open, so the UI can guide the
 * visitor instead of failing silently.
 */
export interface GsiUnavailable {
  /** Something short and human-readable, e.g. "popup-blocked". */
  reason: string;
  /** The page origin that must be authorized in the Google Cloud console. */
  origin: string;
}

let clientId: string | null = null;

function clientIdOf(): string {
  if (clientId === null) {
    clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";
  }
  return clientId;
}

let exchangeHook: ((role: string) => void) | null = null;
let unavailableHook: ((info: GsiUnavailable) => void) | null = null;

const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const CALLBACK_PATH = "/auth/callback";
const POPUP_NAME = "fayfort_google_auth";

interface GsiCredentialResponse {
  credential: string;
  clientId: string;
}

function exchangeCredential(response: GsiCredentialResponse): void {
  void fetch("/api/backend/oauth/google", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken: response.credential }),
  })
    .then((res) => (res.ok ? res.json() : null))
    .then((body) => {
      const user = (body as { user?: { role?: string } } | null)?.user;
      if (user?.role) exchangeHook?.(user.role);
    })
    .catch(() => {
      // Session exchange failed; stay on the page.
    });
}

function randomNonce(): string {
  const bytes = new Uint8Array(16);
  if (typeof crypto !== "undefined" && "getRandomValues" in crypto) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function decodeIdTokenPayload(idToken: string): Record<string, unknown> | null {
  try {
    const payload = idToken.split(".")[1] ?? "";
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const binary = atob(normalized);
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Opens the Google account chooser in a popup. The selected account either
 * logs an existing Fayfort user in or creates a new customer account in the
 * same step (no signup form anywhere). Once Google returns an id_token in the
 * popup's URL fragment, it is exchanged for a Fayfort session via the backend
 * proxy and `onSuccess(role)` is called.
 *
 * Returned true when a flow was launched, or false when no OAuth client id is
 * configured. If the popup can't be opened, `onUnavailable` is called so the
 * UI can guide the visitor.
 */
export function openGoogleSignIn(
  onSuccess: (role: string) => void,
  onUnavailable?: (info: GsiUnavailable) => void,
): boolean {
  const id = clientIdOf();
  if (!id) return false;

  exchangeHook = onSuccess;
  unavailableHook = onUnavailable ?? null;

  // Open a blank popup synchronously inside the user gesture so popup
  // blockers accept it, then navigate it to Google once the URL is built.
  const popup = window.open("", POPUP_NAME, "popup=yes,width=460,height=640");
  if (!popup) {
    unavailableHook?.({
      reason: "popup-blocked",
      origin: window.location.origin,
    });
    return true;
  }

  const origin = window.location.origin;
  const nonce = randomNonce();
  const params = new URLSearchParams({
    client_id: id,
    response_type: "id_token",
    scope: "openid email profile",
    redirect_uri: `${origin}${CALLBACK_PATH}`,
    prompt: "select_account",
    nonce,
  });
  popup.location.assign(`${AUTH_ENDPOINT}?${params.toString()}`);

  const started = Date.now();
  const timer = window.setInterval(() => {
    if (popup.closed) {
      window.clearInterval(timer);
      return;
    }
    if (Date.now() - started > 120_000) {
      window.clearInterval(timer);
      popup.close();
      return;
    }

    let hash = "";
    try {
      hash = popup.location.hash;
    } catch {
      return; // still on accounts.google.com (cross-origin) — keep polling
    }
    if (!hash) return;

    window.clearInterval(timer);
    const fragment = new URLSearchParams(hash.slice(1));
    if (fragment.get("error") === "access_denied") {
      popup.close();
      return;
    }
    const idToken = fragment.get("id_token");
    if (idToken) {
      const payload = decodeIdTokenPayload(idToken);
      if (payload?.nonce !== nonce) {
        // Stale fragment from a previous sign-in — ignore it.
        popup.close();
        return;
      }
      popup.close();
      exchangeCredential({ credential: idToken, clientId: id });
    } else {
      unavailableHook?.({
        reason: "unable-to-retrieve-token",
        origin,
      });
      popup.close();
    }
  }, 200);

  return true;
}

/**
 * The signed-in landing for the account's role after Google auth. Admins
 * always go to the console; customers resume a safe `?next=` deep link from
 * the current URL, otherwise `fallback`.
 */
export function googleDestination(
  role: string,
  fallback: string,
): string {
  if (role === "admin") return "/admin";
  if (typeof window !== "undefined") {
    const raw = new URLSearchParams(window.location.search).get("next");
    if (raw && raw.startsWith("/") && !raw.startsWith("//")) return raw;
  }
  return fallback;
}

/**
 * Like {@link googleDestination} but ignores any `?next=` on the URL. Used by
 * call-to-action links that carry an explicit destination (e.g. a footer "My
 * Requests" link) so a leftover deep-link param can't send a freshly signed
 * in user to the wrong page.
 */
export function googleRoleLanding(role: string, destination: string): string {
  if (role === "admin") return "/admin";
  return destination;
}