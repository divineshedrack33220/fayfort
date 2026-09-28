import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const issueQuote = vi.fn();
vi.mock("@/app/admin/(console)/quotes/new/actions", () => ({
  issueQuoteToRequest: (input: unknown) => issueQuote(input),
}));

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

import { QuoteBuilder } from "@/components/admin/quote-builder";

const request = {
  requestId: "REQ-1042",
  product: "Industrial label printer",
  customer: "David Green",
  quantity: 250,
  currency: "USD",
  budgetUsd: 40000,
};

function priceInput() {
  return screen.getByLabelText("Customer price") as HTMLInputElement;
}

beforeEach(() => {
  issueQuote.mockReset();
  push.mockReset();
  window.localStorage.clear();
});

describe("QuoteBuilder", () => {
  it("refuses to issue a quote priced below landed cost", async () => {
    render(<QuoteBuilder request={request} />);
    const user = userEvent.setup();

    await user.clear(priceInput());
    await user.type(priceInput(), "1");
    await user.click(screen.getByRole("button", { name: "Send quote" }));

    const summary = await screen.findByRole("alert");
    expect(summary.textContent).toMatch(/below the .* landed cost/);
    expect(priceInput()).toHaveAttribute("aria-invalid", "true");
    expect(issueQuote).not.toHaveBeenCalled();
  });

  it("names every problem in the summary and focuses it", async () => {
    render(<QuoteBuilder request={request} />);
    const user = userEvent.setup();

    await user.clear(screen.getByLabelText("Supplier"));
    await user.click(screen.getByRole("button", { name: "Send quote" }));

    const summary = await screen.findByRole("alert");
    expect(summary).toHaveFocus();
    expect(summary.textContent).toMatch(/Name the supplier/);
    expect(screen.getByLabelText("Supplier")).toHaveAttribute("aria-invalid", "true");
  });

  it("issues the quote when the numbers hold up", async () => {
    issueQuote.mockResolvedValue({ ok: true, quoteId: "Q-7" });
    render(<QuoteBuilder request={request} />);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Send quote" }));

    await waitFor(() => expect(issueQuote).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("alert")).toBeNull();
    expect(push).toHaveBeenCalledWith("/admin/requests/REQ-1042");
  });

  it("offers to restore a draft saved on this device", async () => {
    window.localStorage.setItem(
      "fayfort:quote-draft:REQ-1042",
      JSON.stringify({
        costs: { productCost: 1234 },
        customerPrice: 4321,
        supplier: "Ningbo Printex",
        productImages: [],
      }),
    );
    render(<QuoteBuilder request={request} />);
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Restore draft" }));

    expect(screen.getByLabelText("Supplier")).toHaveValue("Ningbo Printex");
    expect(priceInput()).toHaveValue(4321);
  });

  it("does not offer a restore for a different request", async () => {
    window.localStorage.setItem(
      "fayfort:quote-draft:REQ-9999",
      JSON.stringify({ costs: {}, customerPrice: 1, supplier: "x", productImages: [] }),
    );
    render(<QuoteBuilder request={request} />);
    expect(screen.queryByRole("button", { name: "Restore draft" })).toBeNull();
  });
});
