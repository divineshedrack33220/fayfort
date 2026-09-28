import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  googleDestination,
  googleRoleLanding,
  openGoogleSignIn,
} from "@/lib/google-auth";

function base64url(value: string): string {
  return btoa(value).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fakeIdToken(nonce: string): string {
  const header = base64url(JSON.stringify({ alg: "none", typ: "JWT" }));
  const payload = base64url(JSON.stringify({ nonce }));
  return `${header}.${payload}.sig`;
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
    window.history.replaceState(
      null,
      "",
      "/about?next=/apply",
    );
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

  it("opens a popup with an id_token auth URL and routes the signed-in user", async () => {
    const popup = {
      closed: false,
      location: { assign: vi.fn(), hash: "" },
      close: vi.fn(() => {
        popup.closed = true;
      }),
    };
    window.open = vi.fn(() => popup) as unknown as typeof window.open;

    const onSuccess = vi.fn();
    expect(openGoogleSignIn(onSuccess)).toBe(true);

    const authUrl = (popup.location.assign as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as string;
    const url = new URL(authUrl);
    expect(url.origin + url.pathname).toBe(
      "https://accounts.google.com/o/oauth2/v2/auth",
    );
    expect(url.searchParams.get("client_id")).toBe("test-client-id");
    expect(url.searchParams.get("response_type")).toBe("id_token");
    expect(url.searchParams.get("redirect_uri")).toBe(
      `${window.location.origin}/auth/callback`,
    );
    const nonce = url.searchParams.get("nonce")!;

    popup.location.hash = `#id_token=${fakeIdToken(nonce)}`;
    vi.advanceTimersByTime(400);

    expect(popup.close).toHaveBeenCalled();
    await vi.waitFor(() => expect(onSuccess).toHaveBeenCalledWith("customer"));
  });

  it("ignores a stale (mismatched nonce) token fragment", () => {
    const popup = {
      closed: false,
      location: { assign: vi.fn(), hash: "" },
      close: vi.fn(() => {
        popup.closed = true;
      }),
    };
    window.open = vi.fn(() => popup) as unknown as typeof window.open;

    const onSuccess = vi.fn();
    openGoogleSignIn(onSuccess);

    popup.location.hash = `#id_token=${fakeIdToken("not-the-nonce")}`;
    vi.advanceTimersByTime(400);

    expect(popup.close).toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it("reports a blocked popup through onUnavailable", () => {
    window.open = vi.fn(() => null) as unknown as typeof window.open;

    const onUnavailable = vi.fn();
    const started = openGoogleSignIn(() => {}, onUnavailable);

    expect(started).toBe(true);
    expect(onUnavailable).toHaveBeenCalledWith(
      expect.objectContaining({ reason: "popup-blocked" }),
    );
  });
});