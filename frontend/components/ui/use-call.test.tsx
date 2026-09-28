import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useCall } from "@/components/ui/use-call";
import type { CallMode, CallSignal, CallSignalType, ChatSocket } from "@/lib/chat-socket";

const connect = vi.fn();
const requestCallTicket = vi.fn();

vi.mock("@/lib/call-session", () => ({
  CallSession: { connect: (options: unknown) => connect(options) },
  requestCallTicket: (threadId: string) => requestCallTicket(threadId),
  CallUnavailableError: class extends Error {},
}));

vi.mock("@/components/ui/toast", () => ({ toast: { info: vi.fn(), error: vi.fn() } }));

type SocketStub = {
  socket: ChatSocket;
  inviteCall: ReturnType<typeof vi.fn>;
  acceptCall: ReturnType<typeof vi.fn>;
  declineCall: ReturnType<typeof vi.fn>;
  cancelCall: ReturnType<typeof vi.fn>;
  endCall: ReturnType<typeof vi.fn>;
};

function makeSocket(): SocketStub {
  const stub = {
    inviteCall: vi.fn(),
    acceptCall: vi.fn(),
    declineCall: vi.fn(),
    cancelCall: vi.fn(),
    endCall: vi.fn(),
  };
  return { socket: stub as unknown as ChatSocket, ...stub };
}

function signal(type: CallSignalType, overrides: Partial<CallSignal> = {}): [CallSignalType, CallSignal] {
  return [
    type,
    {
      callId: "call-1",
      threadId: "TH-1",
      mode: "video",
      from: "Ada Okafor",
      role: "staff",
      ...overrides,
    },
  ];
}

/** Resolves the media connect so a call can reach "active" in tests. */
function connectOk() {
  connect.mockResolvedValue({
    setMicrophoneEnabled: vi.fn().mockResolvedValue(undefined),
    setCameraEnabled: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
  });
}

function setup(overrides: { threadId?: string | null } = {}) {
  const stub = makeSocket();
  const view = renderHook(() =>
    useCall({
      threadId: overrides.threadId === undefined ? "TH-1" : overrides.threadId,
      peer: "Ada Okafor",
      getSocket: () => stub.socket,
    }),
  );
  return { ...view, ...stub };
}

beforeEach(() => {
  vi.clearAllMocks();
  requestCallTicket.mockResolvedValue({ token: "jwt", url: "wss://lk", room: "fayfort-call-TH-1" });
  connectOk();
});

describe("useCall", () => {
  it("mints a ticket before ringing, then invites the other side", async () => {
    const { result, inviteCall } = setup();

    await act(async () => {
      await result.current.start("video");
    });

    await waitFor(() => expect(result.current.state.phase).toBe("ringing-out"));
    expect(requestCallTicket).toHaveBeenCalledWith("TH-1");
    expect(inviteCall).toHaveBeenCalledWith("TH-1", result.current.state.callId, "video");
    expect(result.current.state.incoming).toBe(false);
  });

  it("does not ring anyone when calls are unconfigured", async () => {
    requestCallTicket.mockRejectedValueOnce(new Error("Calls are not available right now."));
    const { result, inviteCall } = setup();

    await act(async () => {
      await result.current.start("video");
    });

    expect(inviteCall).not.toHaveBeenCalled();
    expect(result.current.state.phase).toBe("idle");
  });

  it("rings back on an incoming invite and accepts into a live call", async () => {
    const { result, acceptCall } = setup();

    act(() => result.current.handleSignal(...signal("call:invite")));

    expect(result.current.state.phase).toBe("ringing-in");
    expect(result.current.state.mode).toBe("video");
    expect(result.current.state.incoming).toBe(true);

    await act(async () => {
      result.current.accept();
    });

    await waitFor(() => expect(result.current.state.phase).toBe("active"));
    expect(acceptCall).toHaveBeenCalledWith("TH-1", "call-1");
    expect(connect).toHaveBeenCalledOnce();
  });

  it("joins the room on accept from the other side", async () => {
    const { result } = setup();

    await act(async () => {
      await result.current.start("audio");
    });
    await waitFor(() => expect(result.current.state.phase).toBe("ringing-out"));

    // The hub echoes the caller's own id, which start() minted.
    await act(async () => {
      result.current.handleSignal(
        ...signal("call:accept", { callId: result.current.state.callId, mode: "audio" }),
      );
    });

    await waitFor(() => expect(result.current.state.phase).toBe("active"));
    // The token was already minted to ring, so it is reused, not re-fetched.
    expect(requestCallTicket).toHaveBeenCalledOnce();
  });

  it("declines without connecting", async () => {
    const { result, declineCall } = setup();

    act(() => result.current.handleSignal(...signal("call:invite")));
    act(() => result.current.decline());

    expect(declineCall).toHaveBeenCalledWith("TH-1", "call-1", "declined");
    expect(result.current.state.phase).toBe("idle");
    expect(connect).not.toHaveBeenCalled();
  });

  it("ignores frames belonging to a different call", async () => {
    const { result } = setup();

    await act(async () => {
      await result.current.start("video");
    });
    await waitFor(() => expect(result.current.state.phase).toBe("ringing-out"));

    act(() =>
      result.current.handleSignal(
        ...signal("call:cancel", { callId: "someone-elses-call", reason: "timeout" }),
      ),
    );

    expect(result.current.state.phase).toBe("ringing-out");
  });

  it("tells the hub the call is over on hang up", async () => {
    const { result, endCall } = setup();

    await act(async () => {
      await result.current.start("video");
    });
    await act(async () => {
      result.current.handleSignal(
        ...signal("call:accept", { callId: result.current.state.callId }),
      );
    });
    await waitFor(() => expect(result.current.state.phase).toBe("active"));

    const callId = result.current.state.callId;
    act(() => result.current.hangUp());

    expect(endCall).toHaveBeenCalledWith("TH-1", callId, "hangup");
    expect(result.current.state.phase).toBe("idle");
  });

  it("cancels the ring instead of ending a call that never connected", async () => {
    const { result, cancelCall, endCall } = setup();

    await act(async () => {
      await result.current.start("video");
    });
    const callId = result.current.state.callId;
    act(() => result.current.hangUp());

    expect(cancelCall).toHaveBeenCalledWith("TH-1", callId, "hangup");
    expect(endCall).not.toHaveBeenCalled();
    expect(result.current.state.phase).toBe("idle");
  });

  it("declines a second ring as busy while already on a call", async () => {
    const { result, declineCall } = setup();

    await act(async () => {
      await result.current.start("video");
    });
    await act(async () => {
      result.current.handleSignal(
        ...signal("call:accept", { callId: result.current.state.callId }),
      );
    });
    await waitFor(() => expect(result.current.state.phase).toBe("active"));

    act(() => result.current.handleSignal(...signal("call:invite", { callId: "call-2" })));

    expect(declineCall).toHaveBeenCalledWith("TH-1", "call-2", "busy");
    expect(result.current.state.phase).toBe("active");
  });

  it("unwinds when the room drops mid-call", async () => {
    const { result } = setup();
    let handlers: { onState?: (state: string) => void } = {};
    connect.mockImplementation((options: { handlers: typeof handlers }) => {
      handlers = options.handlers;
      return Promise.resolve({
        setMicrophoneEnabled: vi.fn().mockResolvedValue(undefined),
        setCameraEnabled: vi.fn().mockResolvedValue(undefined),
        disconnect: vi.fn().mockResolvedValue(undefined),
      });
    });

    await act(async () => {
      await result.current.start("video");
    });
    await act(async () => {
      result.current.handleSignal(
        ...signal("call:accept", { callId: result.current.state.callId }),
      );
    });
    await waitFor(() => expect(result.current.state.phase).toBe("active"));

    act(() => handlers.onState?.("failed"));

    expect(result.current.state.phase).toBe("idle");
  });

  it("does nothing without a conversation", async () => {
    const { result, inviteCall } = setup({ threadId: null });

    await act(async () => {
      await result.current.start("video" as CallMode);
    });

    expect(requestCallTicket).not.toHaveBeenCalled();
    expect(inviteCall).not.toHaveBeenCalled();
  });
});
