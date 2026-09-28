"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  CallSession,
  requestCallTicket,
  type CallTicket,
  type CallTrack,
} from "@/lib/call-session";
import type { CallMode, CallSignal, CallSignalType, ChatSocket } from "@/lib/chat-socket";

export type CallPhase = "idle" | "connecting" | "ringing-out" | "ringing-in" | "active";

export type CallState = {
  phase: CallPhase;
  mode: CallMode;
  callId: string;
  /** True while the other side is being rung, false while we are ringing them. */
  incoming: boolean;
  micOn: boolean;
  cameraOn: boolean;
  /** Seconds since the call connected. */
  elapsed: number;
  tracks: CallTrack[];
};

const IDLE: CallState = {
  phase: "idle",
  mode: "video",
  callId: "",
  incoming: false,
  micOn: true,
  cameraOn: true,
  elapsed: 0,
  tracks: [],
};

/**
 * Drives one call at a time for a conversation.
 *
 * LiveKit only carries media; who is allowed to call whom, and the ringing
 * lifecycle around it, come from the chat WebSocket hub. The token is fetched
 * and published *after* the other side accepts, so a ringing call never holds
 * the microphone or camera.
 */
export function useCall(options: {
  threadId: string | null | undefined;
  peer: string;
  getSocket: () => ChatSocket | null;
}) {
  const { threadId, peer, getSocket } = options;
  const [state, setState] = useState<CallState>(IDLE);

  // Everything the socket handlers touch lives in refs: they are wired into a
  // ChatSocket built inside an effect, so they must never capture stale state.
  const threadRef = useRef<string | null>(null);
  const peerRef = useRef(peer);
  const stateRef = useRef<CallState>(IDLE);
  const sessionRef = useRef<CallSession | null>(null);
  const ticketRef = useRef<CallTicket | null>(null);
  const startedAtRef = useRef(0);
  // Bumped on every start and teardown so an in-flight token fetch or connect
  // can tell it has been superseded and unwind instead of reviving a dead call.
  const attemptRef = useRef(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    threadRef.current = threadId ?? null;
    peerRef.current = peer;
  }, [threadId, peer]);

  const patch = useCallback((next: Partial<CallState>) => {
    const merged = { ...stateRef.current, ...next };
    stateRef.current = merged;
    if (mountedRef.current) setState(merged);
  }, []);

  /** Releases the LiveKit room without touching rendered state. */
  const clearSession = useCallback(() => {
    attemptRef.current += 1;
    const session = sessionRef.current;
    sessionRef.current = null;
    ticketRef.current = null;
    startedAtRef.current = 0;
    void session?.disconnect();
  }, []);

  const teardown = useCallback(() => {
    clearSession();
    patch({ ...IDLE, mode: stateRef.current.mode });
  }, [clearSession, patch]);

  const join = useCallback(
    async (attempt: number, callId: string, mode: CallMode) => {
      const thread = threadRef.current;
      if (!thread) return;
      try {
        const ticket = ticketRef.current ?? (await requestCallTicket(thread));
        ticketRef.current = ticket;
        if (attemptRef.current !== attempt) return;
        const session = await CallSession.connect({
          ticket,
          mode,
          peerLabel: peerRef.current,
          handlers: {
            onTrack: (track) =>
              patch({
                tracks: stateRef.current.tracks.some((held) => held.id === track.id)
                  ? stateRef.current.tracks
                  : [...stateRef.current.tracks, track],
              }),
            onTrackRemoved: (id) =>
              patch({ tracks: stateRef.current.tracks.filter((held) => held.id !== id) }),
            onTrackMuted: (id, muted) =>
              patch({
                tracks: stateRef.current.tracks.map((held) =>
                  held.id === id ? { ...held, muted } : held,
                ),
              }),
            onState: (connection) => {
              if (connection !== "failed") return;
              // While still connecting, the rejected room.connect() carries the
              // real reason (bad token, blocked media) and join() reports it.
              if (stateRef.current.phase === "connecting") return;
              teardown();
              toast.info("Call ended.");
            },
            onError: (message) => toast.error(message),
          },
        });
        if (attemptRef.current !== attempt) {
          void session.disconnect();
          return;
        }
        sessionRef.current = session;
        startedAtRef.current = Date.now();
        patch({
          phase: "active",
          micOn: true,
          cameraOn: mode === "video",
          elapsed: 0,
        });
      } catch (error) {
        if (attemptRef.current !== attempt) return;
        teardown();
        toast.error(error instanceof Error ? error.message : "The call could not start.");
        // Never leave the other side ringing or waiting in an empty room.
        getSocket()?.cancelCall(thread, callId, "error");
      }
    },
    [getSocket, patch, teardown],
  );

  const start = useCallback(
    async (mode: CallMode) => {
      const thread = threadRef.current;
      if (!thread || stateRef.current.phase !== "idle") return;
      const callId = crypto.randomUUID();
      const attempt = ++attemptRef.current;
      patch({
        phase: "connecting",
        mode,
        callId,
        incoming: false,
        micOn: true,
        cameraOn: mode === "video",
        elapsed: 0,
        tracks: [],
      });
      let ticket: CallTicket;
      try {
        // Before ringing: an unconfigured project should fail quietly here
        // rather than ring the customer and then break.
        ticket = await requestCallTicket(thread);
      } catch (error) {
        if (attemptRef.current !== attempt) return;
        teardown();
        toast.error(error instanceof Error ? error.message : "Calls are not available.");
        return;
      }
      if (attemptRef.current !== attempt) return;
      ticketRef.current = ticket;
      getSocket()?.inviteCall(thread, callId, mode);
      patch({ phase: "ringing-out" });
    },
    [getSocket, patch, teardown],
  );

  const accept = useCallback(() => {
    const thread = threadRef.current;
    const callId = stateRef.current.callId;
    if (!thread || stateRef.current.phase !== "ringing-in") return;
    const attempt = ++attemptRef.current;
    patch({ phase: "connecting", incoming: true });
    getSocket()?.acceptCall(thread, callId);
    void join(attempt, callId, stateRef.current.mode);
  }, [getSocket, join, patch]);

  const decline = useCallback(() => {
    const thread = threadRef.current;
    const callId = stateRef.current.callId;
    if (!thread || !callId) return;
    getSocket()?.declineCall(thread, callId, "declined");
    teardown();
  }, [getSocket, teardown]);

  const hangUp = useCallback(() => {
    const thread = threadRef.current;
    const { callId, phase } = stateRef.current;
    if (!thread || !callId) return;
    const socket = getSocket();
    if (phase === "active") socket?.endCall(thread, callId, "hangup");
    else if (phase === "ringing-out" || phase === "ringing-in") {
      socket?.cancelCall(thread, callId, "hangup");
    }
    teardown();
  }, [getSocket, teardown]);

  const toggleMic = useCallback(() => {
    const session = sessionRef.current;
    if (!session) return;
    const next = !stateRef.current.micOn;
    patch({ micOn: next });
    void session.setMicrophoneEnabled(next).catch(() => {
      patch({ micOn: !next });
      toast.error("That microphone is unavailable.");
    });
  }, [patch]);

  const toggleCamera = useCallback(() => {
    const session = sessionRef.current;
    if (!session) return;
    const next = !stateRef.current.cameraOn;
    patch({ cameraOn: next });
    void session.setCameraEnabled(next).catch(() => {
      patch({ cameraOn: !next });
      toast.error("That camera is unavailable.");
    });
  }, [patch]);

  /** Socket entry point. Stable, so it can be wired once when the socket opens. */
  const handleSignal = useCallback(
    (type: CallSignalType, signal: CallSignal) => {
      if (signal.threadId !== threadRef.current) return;
      if (type === "call:invite") {
        if (stateRef.current.phase === "active") {
          // Already on a call: tell them we are busy rather than ignoring it.
          getSocket()?.declineCall(signal.threadId, signal.callId, "busy");
          return;
        }
        clearSession();
        patch({
          phase: "ringing-in",
          mode: signal.mode,
          callId: signal.callId,
          incoming: true,
          micOn: true,
          cameraOn: signal.mode === "video",
          elapsed: 0,
          tracks: [],
        });
        return;
      }
      // Every other frame belongs to a specific call: a late or duplicate one
      // for a call we already finished must not disturb the current state.
      if (signal.callId !== stateRef.current.callId) return;
      if (type === "call:accept") {
        if (stateRef.current.phase !== "ringing-out") return;
        const attempt = ++attemptRef.current;
        patch({ phase: "connecting" });
        void join(attempt, signal.callId, stateRef.current.mode);
      } else if (type === "call:decline") {
        teardown();
        toast.info(`${peerRef.current} declined the call.`);
      } else if (type === "call:cancel") {
        teardown();
        if (signal.reason === "timeout") toast.info("No answer.");
        else if (signal.reason === "superseded") toast.info("Call replaced by another call.");
        // Their side failed to connect while ours was waiting: without this the
        // caller would sit in an empty room with no explanation.
        else if (signal.reason === "error") toast.info("The other side could not connect.");
      } else if (type === "call:end") {
        teardown();
      }
    },
    [clearSession, getSocket, join, patch, teardown],
  );

  // Ending the call when the conversation changes keeps a customer from
  // following a thread switch into someone else's room.
  useEffect(() => {
    if (stateRef.current.phase !== "idle") teardown();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only on thread change
  }, [threadId]);

  useEffect(() => {
    if (state.phase !== "active") return;
    const timer = window.setInterval(() => {
      patch({ elapsed: Math.floor((Date.now() - startedAtRef.current) / 1000) });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [state.phase, patch]);

  useEffect(() => {
    // Set on mount rather than only at init: React (and StrictMode's double
    // mount in development) runs the cleanup between them, and a ref that is
    // only initialised once would stay false and freeze every update after.
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      attemptRef.current += 1;
      void sessionRef.current?.disconnect();
      sessionRef.current = null;
    };
  }, []);

  return { state, start, accept, decline, hangUp, toggleMic, toggleCamera, handleSignal };
}
