import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { ChatAttachments, attachmentPreviewLabel } from "@/components/ui/chat-attachments";

const IMAGE = "https://res.cloudinary.com/demo/image/upload/handbag.png";
const VIDEO = "https://res.cloudinary.com/demo/video/upload/clip.mp4";

describe("ChatAttachments", () => {
  it("renders nothing without attachments", () => {
    const { container } = render(<ChatAttachments attachments={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("opens an image in the full-screen viewer instead of a new tab", async () => {
    render(<ChatAttachments attachments={[{ url: IMAGE, kind: "image" }]} />);

    const trigger = screen.getByRole("button", { name: "View Image attachment 1" });
    expect(trigger.querySelector("a")).toBeNull();

    await userEvent.click(trigger);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Image attachment 1" })).toHaveAttribute(
      "src",
      IMAGE,
    );
  });

  it("opens a video in the viewer with native controls", async () => {
    render(<ChatAttachments attachments={[{ url: VIDEO, kind: "video" }]} />);

    await userEvent.click(screen.getByRole("button", { name: "View Video attachment 1" }));

    const video = screen.getByLabelText("Video attachment 1", { selector: "video" });
    expect(video).toHaveAttribute("src", VIDEO);
    expect(video).toHaveAttribute("controls");
  });

  it("pages between the attachments of one message", async () => {
    render(
      <ChatAttachments
        attachments={[
          { url: IMAGE, kind: "image" },
          { url: VIDEO, kind: "video" },
        ]}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "View Image attachment 1" }));
    expect(screen.getByText("1 / 2")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText("2 / 2")).toBeInTheDocument();
  });

  it("shows pending object urls so senders can preview before upload", async () => {
    const pending = "blob:http://localhost:3000/pending-1";
    render(<ChatAttachments attachments={[{ url: pending, kind: "image" }]} />);

    await userEvent.click(screen.getByRole("button", { name: "View Image attachment 1" }));
    expect(screen.getByRole("img", { name: "Image attachment 1" })).toHaveAttribute(
      "src",
      pending,
    );
  });
});

describe("attachmentPreviewLabel", () => {
  it("summarises photo, video and mixed attachments", () => {
    expect(attachmentPreviewLabel(undefined)).toBeNull();
    expect(attachmentPreviewLabel([])).toBeNull();
    expect(attachmentPreviewLabel([{ url: IMAGE, kind: "image" }])).toBe("📷 Photo");
    expect(attachmentPreviewLabel([{ url: VIDEO, kind: "video" }])).toBe("🎬 Video");
    expect(
      attachmentPreviewLabel([
        { url: IMAGE, kind: "image" },
        { url: VIDEO, kind: "video" },
      ]),
    ).toBe("📎 Attachments");
  });
});
