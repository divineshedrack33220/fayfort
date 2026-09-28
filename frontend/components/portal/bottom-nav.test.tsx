import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PortalBottomNav } from "@/components/portal/bottom-nav";

const chatUnread = vi.fn(() => 0);

vi.mock("@/components/portal/use-portal-chat", () => ({
  usePortalChatUnread: () => ({ unread: chatUnread() }),
}));

function tab(name: RegExp) {
  return screen.getByRole("link", { name });
}

describe("PortalBottomNav", () => {
  beforeEach(() => {
    chatUnread.mockReturnValue(0);
  });

  it("exposes the five portal destinations with their routes", () => {
    render(<PortalBottomNav active="/overview" hasRequests />);

    expect(tab(/^Home$/i)).toHaveAttribute("href", "/overview");
    expect(tab(/^Requests$/i)).toHaveAttribute("href", "/dashboard");
    expect(tab(/^Quotes$/i)).toHaveAttribute("href", "/quotes");
    expect(tab(/^Chat$/i)).toHaveAttribute("href", "/chat");
    expect(tab(/^Profile$/i)).toHaveAttribute("href", "/profile");
  });

  it("marks only the current section as the active tab", () => {
    render(<PortalBottomNav active="/quotes" hasRequests />);

    expect(tab(/^Quotes$/i)).toHaveAttribute("aria-current", "page");
    expect(tab(/^Requests$/i)).not.toHaveAttribute("aria-current");
    expect(tab(/^Home$/i)).not.toHaveAttribute("aria-current");
  });

  it("keeps a section active on its nested detail routes", () => {
    // Detail pages live under /dashboard, which passes the section as `active`.
    render(<PortalBottomNav active="/dashboard" hasRequests />);

    expect(tab(/^Requests$/i)).toHaveAttribute("aria-current", "page");
  });

  it("promotes New to the first tab when nothing is filed yet", () => {
    render(<PortalBottomNav active="/apply" hasRequests={false} />);

    // /overview redirects to /apply when empty, so Home would dead-end.
    expect(tab(/^New$/i)).toHaveAttribute("href", "/apply");
    expect(tab(/^New$/i)).toHaveAttribute("aria-current", "page");
    expect(screen.queryByRole("link", { name: /^Home$/i })).not.toBeInTheDocument();
    // The rest of the bar is unchanged; only the leading slot swaps.
    expect(tab(/^Quotes$/i)).toHaveAttribute("href", "/quotes");
    expect(tab(/^Profile$/i)).toHaveAttribute("href", "/profile");
  });

  it("always keeps five tabs so the bar does not reflow", () => {
    const { rerender } = render(<PortalBottomNav active="/apply" hasRequests={false} />);
    expect(screen.getAllByRole("link")).toHaveLength(5);

    rerender(<PortalBottomNav active="/overview" hasRequests />);
    expect(screen.getAllByRole("link")).toHaveLength(5);
  });

  it("shows an unread bubble for chat only when a count exists", async () => {
    const { unmount } = render(<PortalBottomNav active="/overview" hasRequests />);
    expect(screen.queryByLabelText(/unread/)).not.toBeInTheDocument();
    unmount();

    chatUnread.mockReturnValue(3);
    render(<PortalBottomNav active="/overview" hasRequests />);

    expect(screen.getByLabelText("3 unread messages")).toBeInTheDocument();
  });

  it("renders a labelled navigation landmark", () => {
    render(<PortalBottomNav active="/overview" hasRequests />);

    const nav = screen.getByRole("navigation", { name: /primary/i });
    expect(nav).toBeInTheDocument();
    expect(nav).toHaveClass("lg:hidden");
  });
});
