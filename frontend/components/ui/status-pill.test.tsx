import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StatusPill } from "@/components/ui/status-pill";

describe("StatusPill", () => {
  it("renders the human label for known request statuses", () => {
    render(<StatusPill status="SUPPLIER_SEARCH" />);
    expect(screen.getByText("Supplier search")).toBeInTheDocument();
  });

  it("maps request statuses to their tone", () => {
    const { container } = render(<StatusPill status="UNDER_REVIEW" />);
    expect(container.firstChild).toHaveClass("bg-brand-50");
  });

  it("renders waiting-for-customer statuses with an attention tone", () => {
    const { container } = render(<StatusPill status="CUSTOMER_APPROVAL" />);
    expect(container.firstChild).toHaveClass("bg-warning-50");
  });

  it("recognizes quote statuses as well", () => {
    render(<StatusPill status="APPROVED" />);
    expect(screen.getByText("Approved")).toBeInTheDocument();
  });

  it("falls back to a neutral pill for unknown statuses", () => {
    const { container } = render(<StatusPill status="MYSTERY_STATE" />);
    expect(screen.getByText("MYSTERY_STATE")).toBeInTheDocument();
    expect(container.firstChild).toHaveClass("bg-sand-100");
  });
});
