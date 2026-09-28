export type ChatRole = "customer" | "staff";

/** Audio or video. The hub rejects anything else. */
export type CallMode = "audio" | "video";

export type CallSignalType =
  | "call:invite"
  | "call:accept"
  | "call:decline"
  | "call:cancel"
  | "call:end";

/**
 * A call frame as the hub relays it. `from`/`role` are stamped server-side from
 * the authenticated socket, so they describe the *other* party by the time a
 * page sees them and cannot be spoofed from the browser.
 */
export type CallSignal = {
  callId: string;
  threadId: string;
  mode: CallMode;
  from: string;
  role: ChatRole;
  /** Why a call ended: "timeout" | "superseded" | "left" | "busy" | "declined". */
  reason?: string;
};

export type ChatHandlers = {
  onTyping: (threadId: string, from: string, role: ChatRole) => void;
  onStopped: (threadId: string) => void;
  onMessage: (threadId: string) => void;
  /** Fired when the thread list may have changed (e.g. a brand-new thread). */
  onThreads?: () => void;
  /** Any call frame for a thread this client is subscribed to. */
  onCall?: (type: CallSignalType, signal: CallSignal) => void;
};

/** Debounce window for forwarding keystrokes — at most one frame per 400ms. */
const TYPING_DEBOUNCE_MS = 400;

/** Backoff cap so a missing backend doesn't hammer the network. */
const MAX_RECONNECT_MS = 5000;

type WsEnvelope = {
  type: string;
  threadId?: string;
  from?: string;
  role?: string;
  callId?: string;
  mode?: string;
  reason?: string;
};

/**
 * Turns a backend base URL into the WebSocket endpoint. The browser connects
 * straight to the Go service because Next's /api/backend proxy can't relay
 * upgrades (WebSockets won't survive a route-handler response).
 */
export function wsEndpoint(backendUrl: string): string {
  return `${backendUrl.replace(/^http/, "ws").replace(/\/+$/, "")}/api/ws`;
}

/**
 * A tiny reconnecting WebSocket client for chat events (typing indicators +
 * "a new message landed"). The Go hub is stateless: clients `subscribe` to a
 * thread and receive `typing`/`stopped`/`message` frames. Missed events are
 * safe to skip because messages are always refetched from the backend when a
 * `message` frame arrives.
 *
 * The browser authenticates with a fresh one-time token fetched over the HTTP
 * proxy (the session cookie alone can't cross a localhost -> 127.0.0.1 gap),
 * which is renewed on every reconnect.
 */
export class ChatSocket {
  private conn: WebSocket | null = null;
  private manualClose = false;
  private ref = 0;
  private attempts = 0;
  private lastTypingAt = 0;

  constructor(
    private readonly endpoint: string,
    private readonly handlers: ChatHandlers,
    private readonly subscribed = new Set<string>(),
  ) {}

  open() {
    this.manualClose = false;
    void this.connect();
  }

  close() {
    this.manualClose = true;
    this.ref += 1;
    this.subscribed.clear();
    this.conn?.close();
    this.conn = null;
  }

  subscribe(threadId: string) {
    this.subscribed.add(threadId);
    this.send({ type: "subscribe", threadId });
  }

  unsubscribe(threadId: string) {
    this.subscribed.delete(threadId);
    this.send({ type: "unsubscribe", threadId });
  }

  /** Forward "the user is typing" for a thread, throttled. */
  notifyTyping(threadId: string) {
    const now = Date.now();
    if (now - this.lastTypingAt < TYPING_DEBOUNCE_MS) return;
    this.lastTypingAt = now;
    this.send({ type: "typing", threadId });
  }

  /**
   * Ring the other side of a thread. The call id is minted by the caller and
   * capped at 64 characters by the hub; it ties the invite to the accept,
   * decline, cancel and end frames that follow.
   */
  inviteCall(threadId: string, callId: string, mode: CallMode) {
    this.send({ type: "call:invite", threadId, callId, mode });
  }

  acceptCall(threadId: string, callId: string) {
    this.send({ type: "call:accept", threadId, callId });
  }

  declineCall(threadId: string, callId: string, reason?: string) {
    this.send({ type: "call:decline", threadId, callId, reason });
  }

  /** Withdraw a ring that hasn't been answered yet. */
  cancelCall(threadId: string, callId: string, reason?: string) {
    this.send({ type: "call:cancel", threadId, callId, reason });
  }

  /** Hang up a call that is already connected. */
  endCall(threadId: string, callId: string, reason?: string) {
    this.send({ type: "call:end", threadId, callId, reason });
  }

  private async connect() {
    if (this.manualClose) return;
    const ref = ++this.ref;
    this.attempts += 1;

    // Mint a one-time socket token through the normal HTTP proxy.
    let url = this.endpoint;
    try {
      const res = await fetch("/api/backend/ws-token", { method: "POST" });
      if (!res.ok) throw new Error("no socket token");
      const body = (await res.json()) as { token?: string };
      if (!body.token) throw new Error("missing socket token");
      url = `${this.endpoint}?token=${encodeURIComponent(body.token)}`;
    } catch {
      if (ref === this.ref) this.scheduleReconnect(ref);
      return;
    }
    if (ref !== this.ref) return; // closed while fetching the token

    let socket: WebSocket;
    try {
      socket = new WebSocket(url);
    } catch {
      this.scheduleReconnect(ref);
      return;
    }
    this.conn = socket;

    socket.onopen = () => {
      if (ref !== this.ref) return;
      this.attempts = 0;
      for (const threadId of this.subscribed) {
        socket.send(JSON.stringify({ type: "subscribe", threadId }));
      }
    };

    socket.onmessage = (event) => {
      if (ref !== this.ref) return;
      const msg = parseFrame(event.data);
      if (!msg) return;
      if (msg.type === "typing" && msg.threadId && msg.from) {
        this.handlers.onTyping(msg.threadId, msg.from, msg.role === "staff" ? "staff" : "customer");
      } else if (msg.type === "stopped" && msg.threadId) {
        this.handlers.onStopped(msg.threadId);
      } else if (msg.type === "message" && msg.threadId) {
        this.handlers.onMessage(msg.threadId);
      } else if (msg.type === "threads") {
        this.handlers.onThreads?.();
      } else if (msg.type.startsWith("call:") && msg.threadId && msg.callId) {
        this.handlers.onCall?.(msg.type as CallSignalType, {
          callId: msg.callId,
          threadId: msg.threadId,
          mode: msg.mode === "audio" ? "audio" : "video",
          from: msg.from ?? "Unknown",
          role: msg.role === "staff" ? "staff" : "customer",
          reason: msg.reason || undefined,
        });
      }
    };

    socket.onclose = () => {
      if (ref !== this.ref) return;
      this.conn = null;
      for (const threadId of this.subscribed) this.handlers.onStopped(threadId);
      if (!this.manualClose) this.scheduleReconnect(ref);
    };

    socket.onerror = () => {
      // onclose always follows; nothing to do here.
    };
  }

  private scheduleReconnect(ref: number) {
    const delay = Math.min(500 * 2 ** Math.min(this.attempts - 1, 4), MAX_RECONNECT_MS);
    setTimeout(() => {
      if (ref === this.ref && !this.manualClose) void this.connect();
    }, delay);
  }

  private send(payload: WsEnvelope) {
    if (this.conn?.readyState === WebSocket.OPEN) {
      this.conn.send(JSON.stringify(payload));
    }
  }
}

function parseFrame(data: unknown): WsEnvelope | null {
  if (typeof data !== "string") return null;
  try {
    const parsed = JSON.parse(data) as WsEnvelope;
    return parsed && typeof parsed.type === "string" ? parsed : null;
  } catch {
    return null;
  }
}