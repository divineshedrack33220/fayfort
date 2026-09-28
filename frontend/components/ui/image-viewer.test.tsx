import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Lightbox, LightboxGallery, type LightboxItem } from "@/components/ui/image-viewer";

const ITEMS: LightboxItem[] = [
  { url: "https://cdn.example.com/one.png", alt: "Front of the handbag" },
  { url: "https://cdn.example.com/two.png", alt: "Side of the handbag" },
  { url: "https://cdn.example.com/clip.mp4", alt: "Packing video", kind: "video" },
];

describe("LightboxGallery", () => {
  it("renders nothing when there are no usable images", () => {
    const { container } = render(<LightboxGallery items={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("drops empty urls rather than rendering broken thumbnails", () => {
    render(<LightboxGallery items={[{ url: "", alt: "missing" }]} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("makes every thumbnail a button labelled for assistive tech", () => {
    render(<LightboxGallery items={ITEMS} label="Reference photos" />);

    expect(screen.getByRole("group", { name: "Reference photos" })).toBeInTheDocument();
    for (const item of ITEMS) {
      expect(screen.getByRole("button", { name: `View ${item.alt}` })).toBeInTheDocument();
    }
  });

  it("opens the viewer on the clicked image", async () => {
    render(<LightboxGallery items={ITEMS} />);

    await userEvent.click(screen.getByRole("button", { name: "View Side of the handbag" }));

    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(screen.getByText("2 / 3")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Side of the handbag" })).toBeInTheDocument();
  });

  it("pages through siblings and wraps around", async () => {
    render(<LightboxGallery items={ITEMS} />);
    await userEvent.click(screen.getByRole("button", { name: "View Front of the handbag" }));

    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText("2 / 3")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText("3 / 3")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText("1 / 3")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Previous" }));
    expect(screen.getByText("3 / 3")).toBeInTheDocument();
  });

  it("offers no paging controls for a single image", async () => {
    render(<LightboxGallery items={[ITEMS[0]]} />);
    await userEvent.click(screen.getByRole("button", { name: "View Front of the handbag" }));

    expect(screen.queryByRole("button", { name: "Next" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Previous" })).not.toBeInTheDocument();
    expect(screen.queryByText(/\/ 1/)).not.toBeInTheDocument();
  });

  it("plays videos in the viewer instead of showing an image", async () => {
    render(<LightboxGallery items={ITEMS} />);
    await userEvent.click(screen.getByRole("button", { name: "View Packing video" }));

    const video = screen.getByLabelText("Packing video", { selector: "video" });
    expect(video).toHaveAttribute("src", "https://cdn.example.com/clip.mp4");
    expect(video).toHaveAttribute("controls");
  });

  it("closes on Escape and returns focus to the thumbnail", async () => {
    render(<LightboxGallery items={ITEMS} />);
    const trigger = screen.getByRole("button", { name: "View Front of the handbag" });
    await userEvent.click(trigger);
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await userEvent.keyboard("{Escape}");

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("always links out to the original file", async () => {
    render(<LightboxGallery items={ITEMS} />);
    await userEvent.click(screen.getByRole("button", { name: "View Front of the handbag" }));

    const link = screen.getByRole("link", { name: "Open in a new tab" });
    expect(link).toHaveAttribute("href", "https://cdn.example.com/one.png");
    expect(link).toHaveAttribute("target", "_blank");
  });
});

describe("Lightbox", () => {
  it("renders nothing without an item", () => {
    const { container } = render(<Lightbox open onOpenChange={() => {}} items={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("hides zoom controls for video but keeps them for images", () => {
    const { rerender } = render(
      <Lightbox open onOpenChange={() => {}} items={[ITEMS[0]]} />,
    );
    expect(screen.getByRole("button", { name: "Zoom in" })).toBeInTheDocument();

    rerender(<Lightbox open onOpenChange={() => {}} items={[ITEMS[2]]} />);
    expect(screen.queryByRole("button", { name: "Zoom in" })).not.toBeInTheDocument();
  });

  it("applies a transform when zoomed in", async () => {
    render(<Lightbox open onOpenChange={() => {}} items={[ITEMS[0]]} />);

    await userEvent.click(screen.getByRole("button", { name: "Zoom in" }));

    const image = screen.getByRole("img", { name: ITEMS[0].alt });
    expect(image.style.transform).toMatch(/scale\((?!1\))/);
  });

  it("lets the caller control the index", async () => {
    const onIndexChange = vi.fn();
    render(
      <Lightbox
        open
        onOpenChange={() => {}}
        items={ITEMS}
        index={0}
        onIndexChange={onIndexChange}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Previous" }));
    expect(onIndexChange).toHaveBeenCalledWith(2);
  });

  it("focuses the media surface, not the close button, so arrows work at once", async () => {
    render(<LightboxGallery items={ITEMS} />);
    await userEvent.click(screen.getByRole("button", { name: "View Front of the handbag" }));

    expect(screen.getByRole("group", { name: ITEMS[0].alt })).toHaveFocus();
  });

  it("navigates with the arrow keys", async () => {
    render(<LightboxGallery items={ITEMS} />);
    await userEvent.click(screen.getByRole("button", { name: "View Front of the handbag" }));

    await userEvent.keyboard("{ArrowRight}");
    expect(screen.getByText("2 / 3")).toBeInTheDocument();

    await userEvent.keyboard("{ArrowLeft}");
    expect(screen.getByText("1 / 3")).toBeInTheDocument();
  });

  it("shows the caption above and below the media", () => {
    render(
      <Lightbox
        open
        onOpenChange={() => {}}
        items={[ITEMS[0]]}
        caption="Leather Handbags"
      />,
    );

    expect(screen.getAllByText("Leather Handbags")).toHaveLength(2);
  });
});
