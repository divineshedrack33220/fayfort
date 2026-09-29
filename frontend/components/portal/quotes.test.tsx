import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Quotes } from "@/components/portal/quotes";
import type { PortalQuote } from "@/lib/quote-client";

const quotes: PortalQuote[] = [
  {
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
  },
  {
    id: "QT-2038",
    requestId: "REQ-1030",
    product: "Sneakers",
    supplier: "Yiwu StepOne Footwear",
    valueUsd: 21800,
    marginBps: 380,
    status: "APPROVED",
    issuedAt: "Sep 12, 2026",
    expiresAt: "Sep 26, 2026",
    decidedAt: "Sep 13, 10:00",
    requestStatus: "CONVERTED",
    quantity: 1000,
    budget: 4000000,
  },
];

describe("Quotes", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("lists quotes with supplier, value and status", async () => {
    render(<Quotes quotes={quotes} />);

    // The action segment shows only quotes waiting on a decision.
    expect(screen.getByText("Wireless Headphones")).toBeInTheDocument();
    expect(screen.getByText("Shenzhen AmpCore Electronics")).toBeInTheDocument();
    expect(screen.getByText("$12,400")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /accept & continue/i })).toBeInTheDocument();
    expect(screen.queryByText("Sneakers")).not.toBeInTheDocument();

    // Decided quotes live under History.
    await userEvent.click(screen.getByRole("button", { name: /history/i }));
    expect(screen.getByText("Sneakers")).toBeInTheDocument();
    expect(screen.getByText("Approved")).toBeInTheDocument();
  });

  it("declines a quote with a reason and confirms the persisted state", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              ok: true,
              quote: {
                ...quotes[0],
                status: "DECLINED",
                decidedAt: "Sep 25, 10:12",
                decisionReason: "Too expensive",
              },
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          ),
        )
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              quotes: [
                {
                  ...quotes[0],
                  status: "DECLINED",
                  decidedAt: "Sep 25, 10:12",
                  decisionReason: "Too expensive",
                },
                quotes[1],
              ],
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          ),
        ),
    );
    render(<Quotes quotes={quotes} />);

    await userEvent.click(screen.getByRole("button", { name: /decline quote/i }));
    const dialog = screen.getByRole("dialog");
    await userEvent.click(within(dialog).getByRole("button", { name: /decline quote/i }));

    expect(await screen.findByText(/declined on Sep 25, 10:12/i)).toBeInTheDocument();
  });
});
