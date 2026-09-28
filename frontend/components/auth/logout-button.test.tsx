import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LogoutButton } from "@/components/auth/logout-button";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn() }),
}));

describe("LogoutButton", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    push.mockReset();
  });

  it("shows a confirmation before logging out", async () => {
    const user = userEvent.setup();
    render(<LogoutButton />);

    await user.click(screen.getByRole("button", { name: /log out/i }));
    expect(screen.getByText("Log out of Fayfort?")).toBeInTheDocument();
  });

  it("does not log out when cancelled", async () => {
    const fetchStub = vi.fn();
    vi.stubGlobal("fetch", fetchStub);

    const user = userEvent.setup();
    render(<LogoutButton />);

    await user.click(screen.getByRole("button", { name: /log out/i }));
    await user.click(screen.getByRole("button", { name: /^cancel$/i }));

    expect(fetchStub).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });

  it("logs out and navigates home after confirm", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 303 })),
    );

    const user = userEvent.setup();
    render(<LogoutButton />);

    await user.click(screen.getByRole("button", { name: /log out/i }));
    const confirmButtons = screen.getAllByRole("button", { name: /^log out$/i });
    await user.click(confirmButtons[confirmButtons.length - 1]);

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith("/api/backend/auth/logout", {
        method: "POST",
        credentials: "same-origin",
      }),
    );
    await waitFor(() => expect(push).toHaveBeenCalledWith("/"));
  });
});