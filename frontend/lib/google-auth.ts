/**
 * Explains why Google sign-in could not complete, so the UI can guide the
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
const POPUP_TIMEOUT_MS = 120_000;
const MESSAGE_SOURCE = "fayfort-google-auth";

function randomUrlSafe(count: number): string {
  const bytes = new Uint8Array(count);
  if (typeof crypto !== "undefined" && "getRandomValues" in crypto) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  let binary = "";
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function pkceChallenge(verifier: string): Promise<string> {
  const subtle = typeof crypto !== "undefined" ? crypto.subtle : undefined;
  if (!subtle) return "";
  const digest = await subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  let binary = "";
  new Uint8Array(digest).forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Opens the Google account chooser in a popup using the OAuth authorization
 * code flow with PKCE. The browser only ever sees a short, single-use code in
 * the popup URL (never an id_token — Chrome warns on URLs carrying long
 * tokens); the code is exchanged for a Fayfort session through the backend
 * proxy, then `onSuccess(role)` is called.
 *
 * Returned true when a flow was launched, or false when no OAuth client id is
 * configured. If the popup can't be opened, `onUnavailable` is called so the
 * UI can guide the visitor. `onStatus(working)` reports whether a sign-in is
 * in flight so the button can show progress instead of silently waiting.
 */
export function openGoogleSignIn(
  onSuccess: (role: string) => void,
  onUnavailable?: (info: GsiUnavailable) => void,
  onStatus?: (working: boolean) => void,
): boolean {
  const id = clientIdOf();
  if (!id) return false;

  exchangeHook = onSuccess;
  unavailableHook = onUnavailable ?? null;

  // Open a blank popup synchronously inside the user gesture so popup
  // blockers accept it, then navigate it to Google once the URL is built.
  const popup = window.open("", POPUP_NAME, "popup=yes,width=460,height=640");
  if (!popup) {
    onStatus?.(false);
    unavailableHook?.({
      reason: "popup-blocked",
      origin: window.location.origin,
    });
    return true;
  }
  onStatus?.(true);

  const origin = window.location.origin;
  const nonce = randomUrlSafe(16);
  const state = randomUrlSafe(16);
  const verifier = randomUrlSafe(32);

  // The free-tier backend sleeps after idle; start waking it now so the code
  // exchange (below) doesn't hit a cold start right after the user finishes
  // picking a Google account.
  void fetch("/api/backend/health").catch(() => {});

  // The popup's /auth/callback page is same-origin and hands the code back
  // over postMessage. No cross-origin URL polling — that triggered COOP
  // "window.closed" warnings while the popup sat on Google's pages.
  const onAuthMessage = (event: MessageEvent) => {
    if (event.origin !== origin) return;
    const data = event.data as {
      source?: string;
      code?: string;
      state?: string;
      error?: string;
    } | null;
    if (!data || data.source !== MESSAGE_SOURCE) return;
    window.removeEventListener("message", onAuthMessage);
    if (data.error) {
      // e.g. access_denied — the visitor cancelled the chooser.
      onStatus?.(false);
      popup.close();
      return;
    }
    if (!data.code || data.state !== state) {
      // Stale or forged callback — never exchange it.
      onStatus?.(false);
      popup.close();
      return;
    }
    window.clearTimeout(timerId);
    popup.close();
    void completeGoogleSignIn(
      { code: data.code, codeVerifier: verifier, nonce, redirectUri: `${origin}${CALLBACK_PATH}` },
      origin,
      onStatus,
    );
  };
  window.addEventListener("message", onAuthMessage);
  const timerId = window.setTimeout(() => {
    window.removeEventListener("message", onAuthMessage);
    if (!popup.closed) popup.close();
    onStatus?.(false);
    unavailableHook?.({
      reason: "unable-to-retrieve-token",
      origin,
    });
  }, POPUP_TIMEOUT_MS);

  void (async () => {
    const codeChallenge = await pkceChallenge(verifier);
    if (!codeChallenge) {
      window.removeEventListener("message", onAuthMessage);
      window.clearTimeout(timerId);
      popup.close();
      onStatus?.(false);
      unavailableHook?.({
        reason: "crypto-unavailable",
        origin,
      });
      return;
    }
    const params = new URLSearchParams({
      client_id: id,
      response_type: "code",
      scope: "openid email profile",
      redirect_uri: `${origin}${CALLBACK_PATH}`,
      prompt: "select_account",
      nonce,
      state,
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
    });
    popup.location.assign(`${AUTH_ENDPOINT}?${params.toString()}`);
  })();

  return true;
}

interface GoogleCodeExchangePayload {
  code: string;
  codeVerifier: string;
  nonce: string;
  redirectUri: string;
}

/**
 * The signed-in viewer's role, or null when no backend session exists. Used to
 * recover when the exchange's response was lost after the session was already
 * created — the browser retries the /api/me fetch with the (HttpOnly) session
 * cookie automatically.
 */
async function signedInRole(): Promise<string | null> {
  try {
    const res = await fetch("/api/backend/me", { cache: "no-store" });
    if (!res.ok) return null;
    const body = (await res.json()) as { user?: { role?: string } } | null;
    return body?.user?.role ?? null;
  } catch {
    return null;
  }
}

/**
 * Exchanges the authorization code for a Fayfort session. The backend runs on
 * Render's free tier, which sleeps after idle and can take roughly a minute to
 * wake — so 5xx / network failures on this first call are retried with
 * backoff (alongside the warm-up ping in {@link openGoogleSignIn}) instead of
 * silently leaving the visitor on the landing page. Hard errors are not
 * retried, but a session that was actually created despite the error is still
 * recovered by checking /api/me, and genuine terminal failures surface through
 * `onUnavailable` instead of dying silently.
 */
async function completeGoogleSignIn(
  payload: GoogleCodeExchangePayload,
  origin: string,
  onStatus?: (working: boolean) => void,
): Promise<void> {
  const maxAttempts = 5;
  const transientStatuses = new Set([502, 503, 504]);
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const res = await fetch("/api/backend/oauth/google/code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const body = (await res.json()) as { user?: { role?: string } } | null;
        if (body?.user?.role) exchangeHook?.(body.user.role);
        onStatus?.(false);
        return;
      }
      if (!transientStatuses.has(res.status)) {
        // A hard error (4xx) won't be fixed by retrying — but the single-use
        // code may have been consumed in a way that still created a session
        // (e.g. the backend re-exchanged it after the response was lost).
        // Recover by asking the backend who we are before telling the visitor
        // to start over.
        const role = await signedInRole();
        if (role) {
          exchangeHook?.(role);
          onStatus?.(false);
          return;
        }
        unavailableHook?.({ reason: "unable-to-sign-in", origin });
        onStatus?.(false);
        return;
      }
    } catch {
      // Network failure — the backend may still be waking up.
    }
    if (attempt < maxAttempts - 1) {
      await new Promise((resolve) => setTimeout(resolve, 5000 * (attempt + 1)));
    }
  }
  // The whole retry budget was spent; last chance is a session that got
  // created anyway (every response lost while the backend was warming up).
  const role = await signedInRole();
  if (role) {
    exchangeHook?.(role);
    onStatus?.(false);
    return;
  }
  unavailableHook?.({ reason: "unable-to-sign-in", origin });
  onStatus?.(false);
}

/**
 * The signed-in landing for the account's role after Google auth. Admins
 * always go to the console; customers resume a safe `?next=` deep link from
 * the current URL, otherwise `fallback`.
 */
export function googleDestination(role: string, fallback: string): string {
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
