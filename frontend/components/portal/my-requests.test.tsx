import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { MyRequests } from "@/components/portal/my-requests";
import type { PortalRequestRow } from "@/lib/data/portal";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh: vi.fn() }),
  usePathname: () => "/dashboard",
}));

const REQUESTS: PortalRequestRow[] = [
  {
    id: "REQ-1047",
    product: "Wireless Headphones",
    quantity: 500,
    budget: 3_000_000,
    status: "UNDER_REVIEW",
    date: "Sep 22, 2026",
    timeline: [],
  },
  {
    id: "REQ-1036",
    product: "Handbags",
    quantity: 300,
    budget: 2_000_000,
    status: "QUOTE_READY",
    date: "Sep 18, 2026",
    timeline: [],
  },
  {
    id: "REQ-1030",
    product: "Sneakers",
    quantity: 600,
    budget: 4_000_000,
    status: "SUBMITTED",
    date: "Sep 15, 2026",
    timeline: [],
  },
];

describe("MyRequests", () => {
  it("renders all sample requests by default", () => {
    render(<MyRequests requests={REQUESTS} />);
    expect(screen.getByText("Wireless Headphones")).toBeInTheDocument();
    expect(screen.getByText("Sneakers")).toBeInTheDocument();
    expect(screen.getByText("REQ-1047")).toBeInTheDocument();
  });

  it("filters the list when a status tab is selected", async () => {
    render(<MyRequests requests={REQUESTS} />);
    await userEvent.click(screen.getByRole("tab", { name: /quoted/i }));

    expect(screen.getByText("Handbags")).toBeInTheDocument();
    expect(screen.queryByText("Wireless Headphones")).not.toBeInTheDocument();
  });

  it("links each card to its request detail page", () => {
    render(<MyRequests requests={REQUESTS} />);
    const link = screen.getByRole("link", { name: /REQ-1047/ });
    expect(link).toHaveAttribute("href", "/dashboard/REQ-1047");
  });
});