import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

let pathname = "/";
vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
  useRouter: () => ({ replace: vi.fn() }),
}));

import { SiteNav } from "@/components/marketing/site-nav";

afterEach(() => {
  pathname = "/";
});

describe("SiteNav", () => {
  it("exposes every nav link through the mobile disclosure", async () => {
    render(<SiteNav />);
    const toggle = screen.getByRole("button", { name: "Open menu" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");

    const user = userEvent.setup();
    await user.click(toggle);

    expect(toggle).toHaveAttribute("aria-expanded", "true");
    const panel = screen.getByRole("navigation", { name: "Mobile" });
    for (const label of ["My Requests", "About us", "Help"]) {
      // Present in both the desktop row and the mobile panel.
      expect(screen.getAllByRole("link", { name: label })).toHaveLength(2);
    }
    expect(panel).toBeVisible();
  });

  it("closes the panel on Escape", async () => {
    render(<SiteNav />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Open menu" }));
    expect(screen.getByRole("navigation", { name: "Mobile" })).toBeVisible();

    await user.keyboard("{Escape}");
    expect(screen.getByRole("button", { name: "Open menu" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(screen.queryByRole("navigation", { name: "Mobile" })).toBeNull();
  });

  it("marks the current page with aria-current in both rows", async () => {
    pathname = "/dashboard";
    render(<SiteNav />);
    const user = userEvent.setup();

    expect(screen.getByRole("link", { name: "My Requests" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "About us" })).not.toHaveAttribute("aria-current");

    await user.click(screen.getByRole("button", { name: "Open menu" }));
    const [desktop, mobile] = screen.getAllByRole("link", { name: "My Requests" });
    expect(mobile).toHaveAttribute("aria-current", "page");
    expect(desktop).toHaveAttribute("aria-current", "page");
  });
});
