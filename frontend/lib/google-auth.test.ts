import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { googleDestination, googleRoleLanding, openGoogleSignIn } from "@/lib/google-auth";

function postAuthMessage(data: Record<string, string>): void {
  window.dispatchEvent(new MessageEvent("message", { data, origin: window.location.origin }));
}

describe("googleDestination", () => {
  it("always routes admins to the console", () => {
    window.history.replaceState(null, "", "/dashboard?next=/apply");
    expect(googleDestination("admin", "/apply")).toBe("/admin");
  });

  it("resumes a safe ?next= deep link", () => {
    window.history.replaceState(null, "", "/?next=/apply");
    expect(googleDestination("customer", "/dashboard")).toBe("/apply");
  });

  it("rejects external next targets", () => {
    window.history.replaceState(null, "", "/?next=//evil.example");
    expect(googleDestination("customer", "/dashboard")).toBe("/dashboard");
  });

  it("falls back when there is no next param", () => {
    window.history.replaceState(null, "", "/about");
    expect(googleDestination("customer", "/dashboard")).toBe("/dashboard");
  });
});

describe("googleRoleLanding", () => {
  it("routes admins to the console", () => {
    expect(googleRoleLanding("admin", "/dashboard")).toBe("/admin");
  });

  it("uses the explicit destination, ignoring a leftover ?next=", () => {
    window.history.replaceState(null, "", "/about?next=/apply");
    expect(googleRoleLanding("customer", "/dashboard")).toBe("/dashboard");
  });
});

describe("openGoogleSignIn", () => {
  const originalOpen = window.open;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID = "test-client-id";
    vi.useFakeTimers();
    globalThis.fetch = vi.fn((input: RequestInfo | URL) => {
      const href = String(input);
      if (href.includes("/oauth/google/code")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ user: { role: "customer" } }),
        });
      }
      // warm-up health ping
      return Promise.resolve({ ok: true, json: async () => ({ ok: true }) });
    }) as unknown as typeof fetch;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    window.open = originalOpen;
    globalThis.fetch = originalFetch;
    delete process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  });

  function openPopup() {
    const popup = {
      closed: false,
      location: { assign: vi.fn() },
      close: vi.fn(() => {
        popup.closed = true;
      }),
    };
    window.open = vi.fn(() => popup) as unknown as typeof window.open;
    return popup;
  }

  function exchangeCalls() {
    return (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.filter(
      (call: unknown[]) => String(call[0]).includes("/oauth/google/code"),
    );
  }

  async function assignedUrlOf(popup: { location: { assign: ReturnType<typeof vi.fn> } }) {
    let authUrl = "";
    await vi.waitFor(() => {
      const url = popup.location.assign.mock.calls[0]?.[0] as string | undefined;
      expect(url).toBeTruthy();
      authUrl = url ?? "";
    });
    return new URL(authUrl);
  }

  it("opens a popup with a PKCE code URL and routes the signed-in user", async () => {
    const popup = openPopup();

    const onSuccess = vi.fn();
    expect(openGoogleSignIn(onSuccess)).toBe(true);

    const url = await assignedUrlOf(popup);
    expect(url.origin + url.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(url.searchParams.get("client_id")).toBe("test-client-id");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("redirect_uri")).toBe(`${window.location.origin}/auth/callback`);
    expect(url.searchParams.get("code_challenge")).toBeTruthy();
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("nonce")).toBeTruthy();

    postAuthMessage({
      source: "fayfort-google-auth",
      code: "auth-code",
      state: url.searchParams.get("state")!,
    });

    await vi.waitFor(() => expect(onSuccess).toHaveBeenCalledWith("customer"));
    expect(popup.close).toHaveBeenCalled();

    const calls = exchangeCalls();
    expect(calls).toHaveLength(1);
    const [, init] = calls[0];
    expect(JSON.parse((init as RequestInit).body as string)).toMatchObject({
      code: "auth-code",
      codeVerifier: expect.stringMatching(/^[-_A-Za-z0-9]{20,}$/),
      nonce: url.searchParams.get("nonce"),
      redirectUri: `${window.location.origin}/auth/callback`,
    });
  });

  it("ignores a stale (mismatched state) callback", async () => {
    const popup = openPopup();

    const onSuccess = vi.fn();
    openGoogleSignIn(onSuccess);
    await assignedUrlOf(popup);

    postAuthMessage({
      source: "fayfort-google-auth",
      code: "auth-code",
      state: "wrong-state",
    });

    expect(popup.close).toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
    expect(exchangeCalls()).toHaveLength(0);
  });

  it("ignores a callback from a non-matching source", async () => {
    const popup = openPopup();

    const onSuccess = vi.fn();
    openGoogleSignIn(onSuccess);
    await assignedUrlOf(popup);

    postAuthMessage({ source: "someone-else", code: "auth-code", state: "x" });

    expect(popup.close).not.toHaveBeenCalled();
    expect(exchangeCalls()).toHaveLength(0);
  });

  it("ignores a Google error callback (e.g. access_denied)", async () => {
    const popup = openPopup();

    const onSuccess = vi.fn();
    openGoogleSignIn(onSuccess);
    await assignedUrlOf(popup);

    postAuthMessage({
      source: "fayfort-google-auth",
      error: "access_denied",
    });

    expect(popup.close).toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
    expect(exchangeCalls()).toHaveLength(0);
  });

  it("retries the exchange when the backend is cold-starting before routing", async () => {
    const popup = openPopup();

    let exchangeAttempt = 0;
    globalThis.fetch = vi.fn((input: RequestInfo | URL) => {
      const href = String(input);
      if (href.includes("/oauth/google/code")) {
        exchangeAttempt += 1;
        if (exchangeAttempt === 1) {
          return Promise.reject(new Error("backend is waking up"));
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({ user: { role: "customer" } }),
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({ ok: true }) });
    }) as unknown as typeof fetch;

    const onSuccess = vi.fn();
    expect(openGoogleSignIn(onSuccess)).toBe(true);
    const url = await assignedUrlOf(popup);

    postAuthMessage({
      source: "fayfort-google-auth",
      code: "auth-code",
      state: url.searchParams.get("state")!,
    });

    await vi.advanceTimersByTimeAsync(11000);

    await vi.waitFor(() => expect(onSuccess).toHaveBeenCalledWith("customer"));
    expect(exchangeCalls()).toHaveLength(2);
  });

  it("reports a busy status for the duration of a sign-in", async () => {
    const popup = openPopup();

    const onSuccess = vi.fn();
    const onStatus = vi.fn();
    openGoogleSignIn(onSuccess, undefined, onStatus);

    expect(onStatus).toHaveBeenLastCalledWith(true);

    await assignedUrlOf(popup);
    postAuthMessage({
      source: "fayfort-google-auth",
      code: "auth-code",
      state: new URL(
        popup.location.assign.mock.calls[0][0] as string,
      ).searchParams.get("state")!,
    });

    await vi.waitFor(() => expect(onSuccess).toHaveBeenCalledWith("customer"));
    expect(onStatus).toHaveBeenLastCalledWith(false);
  });

  it("recovers a session that was created despite a lost exchange response", async () => {
    const popup = openPopup();

    globalThis.fetch = vi.fn((input: RequestInfo | URL) => {
      const href = String(input);
      if (href.includes("/oauth/google/code")) {
        return Promise.resolve({
          ok: false,
          status: 401,
          json: async () => ({ error: "invalid Google sign-in" }),
        });
      }
      if (href.includes("/me")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ ok: true, user: { role: "customer" } }),
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({ ok: true }) });
    }) as unknown as typeof fetch;

    const onSuccess = vi.fn();
    openGoogleSignIn(onSuccess);
    const url = await assignedUrlOf(popup);

    postAuthMessage({
      source: "fayfort-google-auth",
      code: "auth-code",
      state: url.searchParams.get("state")!,
    });

    await vi.waitFor(() => expect(onSuccess).toHaveBeenCalledWith("customer"));
  });

  it("reports a terminal exchange failure instead of failing silently", async () => {
    const popup = openPopup();

    globalThis.fetch = vi.fn((input: RequestInfo | URL) => {
      const href = String(input);
      if (href.includes("/oauth/google/code")) {
        return Promise.resolve({
          ok: false,
          status: 401,
          json: async () => ({ error: "invalid Google sign-in" }),
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({ ok: true }) });
    }) as unknown as typeof fetch;

    const onUnavailable = vi.fn();
    openGoogleSignIn(() => {}, onUnavailable);
    const url = await assignedUrlOf(popup);

    postAuthMessage({
      source: "fayfort-google-auth",
      code: "auth-code",
      state: url.searchParams.get("state")!,
    });

    await vi.waitFor(() =>
      expect(onUnavailable).toHaveBeenCalledWith(
        expect.objectContaining({ reason: "unable-to-sign-in" }),
      ),
    );
  });

  it("surfaces a timeout as a recoverable error instead of a silent hang", async () => {
    openPopup();

    const onUnavailable = vi.fn();
    openGoogleSignIn(() => {}, onUnavailable);

    await vi.advanceTimersByTimeAsync(120_000);

    expect(onUnavailable).toHaveBeenCalledWith(
      expect.objectContaining({ reason: "unable-to-retrieve-token" }),
    );
  });

  it("reports a blocked popup through onUnavailable", async () => {
    window.open = vi.fn(() => null) as unknown as typeof window.open;

    const onUnavailable = vi.fn();
    const started = openGoogleSignIn(() => {}, onUnavailable);

    expect(started).toBe(true);
    expect(onUnavailable).toHaveBeenCalledWith(
      expect.objectContaining({ reason: "popup-blocked" }),
    );
  });
});
