import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { QuotePanel } from "@/components/portal/quote-panel";

const pendingQuote = {
  id: "QT-2042",
  requestId: "REQ-1047",
  product: "Wireless Headphones",
  supplier: "Shenzhen AmpCore Electronics",
  valueUsd: 12400,
  marginBps: 450,
  status: "PENDING",
  issuedAt: "Sep 23, 2026",
  expiresAt: "Oct 7, 2026",
  requestStatus: "QUOTE_READY",
  quantity: 500,
  budget: 3000000,
} as const;

describe("QuotePanel", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("shows the quoted total and accept/decline actions while pending", () => {
    render(<QuotePanel quote={pendingQuote} />);
    expect(screen.getByText("$12,400")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /accept & continue/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /decline quote/i })).toBeInTheDocument();
  });

  it("persists an accepted decision through the backend", async () => {
    const fetchStub = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          quote: { ...pendingQuote, status: "APPROVED", decidedAt: "Sep 25, 09:41" },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchStub);
    render(<QuotePanel quote={pendingQuote} />);

    await userEvent.click(
      screen.getByRole("button", { name: /accept & continue/i }),
    );
    expect(screen.getByRole("dialog").textContent).toContain("Accept this quote?");
    await userEvent.click(screen.getByRole("button", { name: /accept quote/i }));

    expect(fetchStub).toHaveBeenCalledWith(
      "/api/backend/portal/quotes/REQ-1047/decision",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ decision: "APPROVED", reason: "" }),
      }),
    );
    expect(
      await screen.findByText(/quote accepted on Sep 25, 09:41/i),
    ).toBeInTheDocument();
  });

  it("renders an already approved quote without decision actions", () => {
    render(
      <QuotePanel
        quote={{
          ...pendingQuote,
          status: "APPROVED",
          decidedAt: "Sep 20, 14:02",
        }}
      />,
    );
    expect(screen.getByText("Approved")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /accept & continue/i }),
    ).not.toBeInTheDocument();
  });
});