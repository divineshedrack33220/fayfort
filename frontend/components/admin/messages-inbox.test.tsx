import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { MessagesInbox } from "@/components/admin/messages-inbox";
import type { AdminThread, AdminThreadMessage } from "@/lib/admin";

const PHOTO = { kind: "image", url: "/uploads/spec.png" } as const;

function thread(message: Partial<AdminThreadMessage>): AdminThread {
  return {
    id: "THR-1",
    customer: "David Green",
    email: "demo@example.com",
    subject: "Sourcing brief",
    ref: "REQ-1047",
    unread: 0,
    status: "OPEN",
    lastActive: "Today, 10:00",
    messages: [
      {
        id: "MSG-1",
        from: "customer",
        author: "David Green",
        text: "Can you quote 600 units?",
        at: "Today, 09:00",
        ...message,
      },
    ],
  };
}

/** An attachment-only reply: the wire payload carries no body at all. */
const NO_TEXT = { text: undefined as unknown as string };

const base = {
  activeId: null,
  staffName: "Fayfort",
  onReply: vi.fn(async () => {}),
  wsUrl: undefined,
};

const row = () => screen.getByLabelText("Conversation with David Green");

describe("MessagesInbox conversation previews", () => {
  it("describes an attachment-only reply instead of crashing on a missing body", () => {
    render(
      <MessagesInbox
        {...base}
        initialThreads={[thread({ from: "staff", ...NO_TEXT, attachments: [PHOTO] })]}
      />,
    );

    expect(row().textContent).toContain("You: ");
    expect(row().textContent).toContain("Photo");
  });

  it("prefers real message text over the attachment fallback", () => {
    render(
      <MessagesInbox
        {...base}
        initialThreads={[
          thread({ from: "staff", text: "Quote attached", attachments: [PHOTO] }),
        ]}
      />,
    );

    expect(row().textContent).toContain("You: Quote attached");
  });

  it("renders a message with empty text and no attachments as a blank preview", () => {
    render(<MessagesInbox {...base} initialThreads={[thread({ text: "" })]} />);

    expect(row()).toBeInTheDocument();
    expect(row().textContent).toContain("David Green");
  });
});

describe("MessagesInbox upload progress", () => {
  it("renders a determinate progressbar and a percentage while sending", async () => {
    let sentResolve!: () => void;
    const gate = new Promise<void>((resolve) => {
      sentResolve = resolve;
    });

    // jsdom's XMLHttpRequest exposes `upload` as a getter-only property, so the
    // fake supplies its own event target rather than extending the native one.
    class GatedXHR {
      upload = new EventTarget();
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      onabort: (() => void) | null = null;
      ontimeout: (() => void) | null = null;
      status = 0;
      responseText = "";
      private listeners = new Map<string, Array<(e: unknown) => void>>();
      open() {}
      addEventListener(type: string, fn: (e: unknown) => void) {
        const list = this.listeners.get(type) ?? [];
        list.push(fn);
        this.listeners.set(type, list);
      }
      abort() {}
      private dispatch(event: Event) {
        for (const fn of this.listeners.get(event.type) ?? []) fn(event);
        const handler = (this as unknown as Record<string, (() => void) | null>)[`on${event.type}`];
        handler?.();
      }
      send(body?: Document | XMLHttpRequestBodyInit | null) {
        void body;
        // Fire a 45% upload tick, then hold the response open so the indicator
        // is observable while the component is mid-send.
        setTimeout(() => {
          this.upload.dispatchEvent(
            Object.assign(new Event("progress"), { lengthComputable: true, loaded: 450, total: 1000 }),
          );
        }, 0);
        void gate.then(() => {
          this.status = 200;
          this.responseText = JSON.stringify({
            ok: true,
            url: "https://cdn.example.com/sent.png",
          });
          this.dispatch(new Event("load"));
        });
      }
    }
    vi.stubGlobal("XMLHttpRequest", GatedXHR);

    const user = userEvent.setup();
    render(
      <MessagesInbox
        {...base}
        initialThreads={[thread({})]}
        activeId="THR-1"
        onReply={vi.fn(async () => {})}
      />,
    );
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, new File(["bytes"], "bag.png", { type: "image/png" }));
    await screen.findByRole("button", { name: /^View Image attachment 1/ });
    await user.click(screen.getByRole("button", { name: /Send/ }));

    const bar = await screen.findByRole("progressbar");
    expect(bar).toHaveAttribute("aria-valuenow", "45");
    expect(bar).toHaveAttribute("aria-label", "Sending bag.png");
    expect(screen.getByText("45%")).toBeInTheDocument();

    // The remove control is locked mid-upload so the request cannot be orphaned.
    expect(screen.getByRole("button", { name: "Remove attachment" })).toBeDisabled();

    sentResolve();
    await waitFor(() => expect(screen.queryByRole("progressbar")).not.toBeInTheDocument());

    vi.unstubAllGlobals();
  });
});
