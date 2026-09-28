import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const matchMediaStub = {
  matches: false,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
};

vi.stubGlobal("matchMedia", vi.fn(() => matchMediaStub));

import { About, aboutImages } from "@/components/marketing/about";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("About", () => {
  it("lays the story out with a Read more link and a How it works link", () => {
    render(<About />);

    expect(screen.getByText("About us")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /Connecting markets\. Creating opportunities\./i }),
    ).toBeInTheDocument();

    const readMore = screen.getByRole("link", { name: /Read more/i });
    expect(readMore).toHaveAttribute("href", "/about");

    const how = screen.getByRole("link", { name: /How it works/i });
    expect(how).toHaveAttribute("href", "/how-it-works");
  });

  it("shows every photo and one dot per photo", () => {
    render(<About />);

    const images = screen.getAllByRole("img");
    expect(images).toHaveLength(aboutImages.length);
    for (const image of aboutImages) {
      expect(screen.getByAltText(image.alt)).toBeInTheDocument();
    }

    const dots = screen.getAllByRole("button", { name: /Show photo/i });
    expect(dots).toHaveLength(aboutImages.length);
  });

  it("reveals the live caption in polite aria-live so assistive tech hears it", () => {
    render(<About />);

    const live = screen.getByText(aboutImages[0].alt);
    expect(live).toHaveAttribute("aria-live", "polite");
  });

  it("jumps to a photo when its dot is clicked", async () => {
    const user = userEvent.setup();
    render(<About />);

    const firstDot = screen.getByRole("button", {
      name: new RegExp(`Show photo 1 of ${aboutImages.length}`),
    });
    expect(firstDot).toHaveAttribute("aria-current", "true");

    const lastDot = screen.getByRole("button", {
      name: new RegExp(`Show photo ${aboutImages.length} of ${aboutImages.length}`),
    });
    await user.click(lastDot);
    expect(lastDot).toHaveAttribute("aria-current", "true");
    expect(firstDot).not.toHaveAttribute("aria-current", "true");
  });
});