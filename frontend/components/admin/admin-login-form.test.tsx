import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AdminLoginForm } from "@/components/admin/admin-login-form";

const push = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
}));

describe("AdminLoginForm", () => {
  beforeEach(() => {
    push.mockReset();
    refresh.mockReset();
    vi.unstubAllGlobals();
  });

  it("keeps submit disabled until email and password are valid", async () => {
    render(<AdminLoginForm next="/admin" />);
    const button = screen.getByRole("button", { name: /staff console/i });
    expect(button).toBeDisabled();

    await userEvent.type(
      screen.getByPlaceholderText("you@fayfort.com"),
      "admin@fayfort.com",
    );
    await userEvent.type(screen.getByPlaceholderText("••••••••"), "short");
    expect(button).toBeDisabled();

    await userEvent.type(screen.getByPlaceholderText("••••••••"), "enough");
    expect(button).toBeEnabled();
  });

  it("navigates to the redirect target after a successful staff sign-in", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ ok: true, user: { role: "admin" } }),
      }),
    );

    render(<AdminLoginForm next="/admin/requests" />);
    await userEvent.type(
      screen.getByPlaceholderText("you@fayfort.com"),
      "admin@fayfort.com",
    );
    await userEvent.type(
      screen.getByPlaceholderText("••••••••"),
      "admin123",
    );
    await userEvent.click(screen.getByRole("button", { name: /staff console/i }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/admin/requests"));
  });

  it("rejects a customer session without staff access", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ ok: true, user: { role: "customer" } }),
      }),
    );

    render(<AdminLoginForm next="/admin" />);
    await userEvent.type(
      screen.getByPlaceholderText("you@fayfort.com"),
      "ama@example.com",
    );
    await userEvent.type(
      screen.getByPlaceholderText("••••••••"),
      "password123",
    );
    await userEvent.click(screen.getByRole("button", { name: /staff console/i }));

    expect(
      await screen.findByText(/doesn’t have staff access/i),
    ).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it("shows an inline error when the server rejects the request", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ error: "Invalid staff credentials." }),
      }),
    );

    render(<AdminLoginForm next="/admin" />);
    await userEvent.type(
      screen.getByPlaceholderText("you@fayfort.com"),
      "admin@fayfort.com",
    );
    await userEvent.type(
      screen.getByPlaceholderText("••••••••"),
      "wrongpass",
    );
    await userEvent.click(screen.getByRole("button", { name: /staff console/i }));

    expect(await screen.findByText("Invalid staff credentials.")).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });
});