import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { googleDestination, googleRoleLanding, openGoogleSignIn } from "@/lib/google-auth";

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
    expect(googleDestination("customer", "/apply")).toBe("/apply");
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
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ user: { role: "customer" } }),
    });
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
      location: { assign: vi.fn(), href: "about:blank" },
      close: vi.fn(() => {
        popup.closed = true;
      }),
    };
    window.open = vi.fn(() => popup) as unknown as typeof window.open;
    return popup;
  }

  function callbackUrl(state: string): string {
    return `${window.location.origin}/auth/callback?code=auth-code&state=${state}`;
  }

  it("opens a popup with a PKCE code URL and routes the signed-in user", async () => {
    const popup = openPopup();

    const onSuccess = vi.fn();
    expect(openGoogleSignIn(onSuccess)).toBe(true);

    let authUrl = "";
    await vi.waitFor(() => {
      authUrl = (popup.location.assign as unknown as ReturnType<typeof vi.fn>).mock
        .calls[0][0] as string;
      expect(authUrl).toBeTruthy();
    });

    const url = new URL(authUrl);
    expect(url.origin + url.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(url.searchParams.get("client_id")).toBe("test-client-id");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("redirect_uri")).toBe(`${window.location.origin}/auth/callback`);
    expect(url.searchParams.get("code_challenge")).toBeTruthy();
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("nonce")).toBeTruthy();
    const state = url.searchParams.get("state")!;

    popup.location.href = callbackUrl(state);
    vi.advanceTimersByTime(400);

    await vi.waitFor(() => expect(onSuccess).toHaveBeenCalledWith("customer"));
    expect(popup.close).toHaveBeenCalled();

    const [, body] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(JSON.parse(body.body as string)).toMatchObject({
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

    await vi.waitFor(() => {
      expect(popup.location.assign).toHaveBeenCalled();
    });

    popup.location.href = callbackUrl("wrong-state");
    vi.advanceTimersByTime(400);

    expect(popup.close).toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("ignores a Google error callback (e.g. access_denied)", async () => {
    const popup = openPopup();

    const onSuccess = vi.fn();
    openGoogleSignIn(onSuccess);

    await vi.waitFor(() => {
      expect(popup.location.assign).toHaveBeenCalled();
    });

    popup.location.href = `${window.location.origin}/auth/callback?error=access_denied`;
    vi.advanceTimersByTime(400);

    expect(popup.close).toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("retries the exchange when the backend is cold-starting before routing", async () => {
    const popup = openPopup();
    globalThis.fetch = vi
      .fn()
      .mockRejectedValueOnce(new Error("backend is waking up"))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ user: { role: "customer" } }),
      });

    const onSuccess = vi.fn();
    expect(openGoogleSignIn(onSuccess)).toBe(true);

    await vi.waitFor(() => {
      const calls = (popup.location.assign as unknown as ReturnType<typeof vi.fn>).mock.calls;
      expect(calls.length).toBeGreaterThan(0);
    });
    const url = new URL(
      (popup.location.assign as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0] as string,
    );
    popup.location.href = callbackUrl(url.searchParams.get("state")!);

    await vi.advanceTimersByTimeAsync(6000);

    await vi.waitFor(() => expect(onSuccess).toHaveBeenCalledWith("customer"));
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
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
