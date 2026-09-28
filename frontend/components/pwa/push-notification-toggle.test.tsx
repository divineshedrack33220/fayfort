import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PushNotificationToggle } from "@/components/pwa/push-notification-toggle";
import { ServiceWorkerProvider } from "@/components/pwa/service-worker-provider";

// A real VAPID public key is a 65-byte uncompressed P-256 point, base64url
// encoded (87 characters).
const VAPID_PUBLIC_KEY =
  "BGonSZxDyS3HxK-PYyYD2WzUKZ8P96zu39Sx7ACandltL0WsTWViMdqeJAZBO5VP_zQ8gr9rYwFrO6qSfnCGPvA";

type FakeSubscription = {
  toJSON: () => unknown;
  unsubscribe: () => Promise<boolean>;
};

const pushManager = {
  getSubscription: vi.fn(),
  subscribe: vi.fn(),
};

const registration = {
  pushManager,
  waiting: null,
  addEventListener: vi.fn(),
  update: vi.fn().mockResolvedValue(undefined),
};

const serviceWorkerStub = {
  register: vi.fn().mockResolvedValue(registration),
  ready: Promise.resolve(registration),
  controller: null,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
};

function fakeSubscription(endpoint = "https://push.example/device-1"): FakeSubscription {
  return {
    toJSON: () => ({
      endpoint,
      keys: { p256dh: "p256dh-value", auth: "auth-value" },
    }),
    unsubscribe: vi.fn().mockResolvedValue(true),
  };
}

function stubNotifications(permission: NotificationPermission, granted = permission) {
  vi.stubGlobal(
    "Notification",
    class {
      static permission = permission;
      static requestPermission = vi.fn().mockResolvedValue(granted);
    },
  );
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function renderToggle() {
  return render(
    <ServiceWorkerProvider>
      <PushNotificationToggle />
    </ServiceWorkerProvider>,
  );
}

describe("PushNotificationToggle", () => {
  beforeEach(() => {
    pushManager.getSubscription.mockReset().mockResolvedValue(null);
    pushManager.subscribe.mockReset();
    registration.addEventListener.mockReset();
    serviceWorkerStub.register.mockClear();
    vi.stubGlobal("navigator", {
      ...window.navigator,
      serviceWorker: serviceWorkerStub,
    });
    stubNotifications("default");
    // jsdom has no PushManager, so the toggle would treat the browser as
    // unsupported without it.
    vi.stubGlobal("PushManager", class {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("offers to enable push on a device that is not subscribed yet", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ publicKey: VAPID_PUBLIC_KEY, enabled: true })),
    );

    renderToggle();

    expect(
      await screen.findByRole("button", { name: /enable on this device/i }),
    ).toBeInTheDocument();
  });

  it("subscribes the browser and registers the device with the server", async () => {
    stubNotifications("default", "granted");
    const sub = fakeSubscription();
    pushManager.subscribe.mockResolvedValue(sub);
    const fetchStub = vi.fn(async (url: string) => {
      if (String(url).includes("/push/public-key")) {
        return jsonResponse({ publicKey: VAPID_PUBLIC_KEY, enabled: true });
      }
      if (String(url).includes("/push/subscribe")) {
        return jsonResponse({ ok: true }, 201);
      }
      return jsonResponse({});
    });
    vi.stubGlobal("fetch", fetchStub);

    const user = userEvent.setup();
    renderToggle();

    await user.click(await screen.findByRole("button", { name: /enable on this device/i }));

    await waitFor(() => expect(pushManager.subscribe).toHaveBeenCalled());
    const options = pushManager.subscribe.mock.calls[0][0];
    expect(options.userVisibleOnly).toBe(true);
    expect(options.applicationServerKey).toBeInstanceOf(Uint8Array);
    expect(options.applicationServerKey.length).toBe(65);

    await waitFor(() =>
      expect(fetchStub).toHaveBeenCalledWith(
        "/api/backend/push/subscribe",
        expect.objectContaining({ method: "POST" }),
      ),
    );
    expect(await screen.findByRole("button", { name: /send test/i })).toBeInTheDocument();
  });

  it("re-registers an existing subscription on load so a reset server self-heals", async () => {
    stubNotifications("granted");
    pushManager.getSubscription.mockResolvedValue(fakeSubscription());
    const fetchStub = vi.fn(async (url: string) => {
      if (String(url).includes("/push/public-key")) {
        return jsonResponse({ publicKey: VAPID_PUBLIC_KEY, enabled: true });
      }
      return jsonResponse({ ok: true }, 201);
    });
    vi.stubGlobal("fetch", fetchStub);

    renderToggle();

    await waitFor(() =>
      expect(fetchStub).toHaveBeenCalledWith(
        "/api/backend/push/subscribe",
        expect.objectContaining({ method: "POST" }),
      ),
    );
    // No second browser subscription is created.
    expect(pushManager.subscribe).not.toHaveBeenCalled();
  });

  it("unsubscribes the browser and the server", async () => {
    stubNotifications("granted");
    const sub = fakeSubscription();
    pushManager.getSubscription.mockResolvedValue(sub);
    const fetchStub = vi.fn(async (url: string) => {
      if (String(url).includes("/push/public-key")) {
        return jsonResponse({ publicKey: VAPID_PUBLIC_KEY, enabled: true });
      }
      return jsonResponse({ ok: true });
    });
    vi.stubGlobal("fetch", fetchStub);

    const user = userEvent.setup();
    renderToggle();

    await user.click(await screen.findByRole("button", { name: /turn off/i }));

    await waitFor(() => expect(sub.unsubscribe).toHaveBeenCalled());
    await waitFor(() =>
      expect(fetchStub).toHaveBeenCalledWith(
        "/api/backend/push/unsubscribe",
        expect.objectContaining({ method: "POST" }),
      ),
    );
    expect(
      await screen.findByRole("button", { name: /enable on this device/i }),
    ).toBeInTheDocument();
  });

  it("explains when permission is denied instead of asking again", async () => {
    stubNotifications("default", "denied");
    const fetchStub = vi.fn(async (url: string) => {
      if (String(url).includes("/push/public-key")) {
        return jsonResponse({ publicKey: VAPID_PUBLIC_KEY, enabled: true });
      }
      return jsonResponse({ ok: true }, 201);
    });
    vi.stubGlobal("fetch", fetchStub);

    const user = userEvent.setup();
    renderToggle();

    await user.click(await screen.findByRole("button", { name: /enable on this device/i }));

    expect(await screen.findByText(/blocked in your browser settings/i)).toBeInTheDocument();
    expect(pushManager.subscribe).not.toHaveBeenCalled();
    expect(
      screen.queryByRole("button", { name: /enable on this device/i }),
    ).not.toBeInTheDocument();
  });

  it("reports a failed test send", async () => {
    stubNotifications("granted");
    pushManager.getSubscription.mockResolvedValue(fakeSubscription());
    const fetchStub = vi.fn(async (url: string) => {
      if (String(url).includes("/push/public-key")) {
        return jsonResponse({ publicKey: VAPID_PUBLIC_KEY, enabled: true });
      }
      if (String(url).includes("/push/test")) {
        return jsonResponse({ ok: false, error: "no subscribed devices" }, 400);
      }
      return jsonResponse({ ok: true }, 201);
    });
    vi.stubGlobal("fetch", fetchStub);

    const user = userEvent.setup();
    renderToggle();

    await user.click(await screen.findByRole("button", { name: /send test/i }));

    expect(await screen.findByTestId("push-toggle-message")).toHaveTextContent(
      /not registered for push yet/i,
    );
  });

  it("confirms a successful test send", async () => {
    stubNotifications("granted");
    pushManager.getSubscription.mockResolvedValue(fakeSubscription());
    const fetchStub = vi.fn(async (url: string) => {
      if (String(url).includes("/push/public-key")) {
        return jsonResponse({ publicKey: VAPID_PUBLIC_KEY, enabled: true });
      }
      if (String(url).includes("/push/test")) {
        return jsonResponse({ subscriptions: 1, sent: 1 });
      }
      return jsonResponse({ ok: true }, 201);
    });
    vi.stubGlobal("fetch", fetchStub);

    const user = userEvent.setup();
    renderToggle();

    await user.click(await screen.findByRole("button", { name: /send test/i }));

    expect(await screen.findByTestId("push-toggle-message")).toHaveTextContent(
      /with the app closed/i,
    );
  });
});
