import type { LocalTrack, RemoteTrack, Room } from "livekit-client";
import type { CallMode } from "./chat-socket";

/**
 * Token + room details returned by /api/calls/token. The API key and secret
 * never leave the server: the browser only ever receives a short-lived,
 * single-room grant.
 */
export type CallTicket = {
  token: string;
  url: string;
  room: string;
};

export type CallConnectionState =
  | "connecting"
  | "connected"
  | "reconnecting"
  | "failed";

/**
 * A media track flattened into something React state can hold. The LiveKit
 * track objects stay inside CallSession; these are plain descriptors with the
 * two DOM calls the UI needs, so no component has to import the SDK.
 */
export type CallTrack = {
  id: string;
  kind: "audio" | "video";
  source: "local" | "remote";
  label: string;
  muted: boolean;
  attach: (element: HTMLMediaElement) => void;
  detach: (element: HTMLMediaElement) => void;
};

export type CallSessionHandlers = {
  onTrack: (track: CallTrack) => void;
  onTrackRemoved: (id: string) => void;
  onTrackMuted: (id: string, muted: boolean) => void;
  onState: (state: CallConnectionState) => void;
  onError: (message: string) => void;
};

/** An error that already carries a message fit to show the user. */
export class CallError extends Error {}

export class CallUnavailableError extends CallError {}

function unavailable() {
  return new CallUnavailableError("Calls are not available right now.");
}

/** Fetches a room grant for one thread. Authorisation happens server-side. */
export async function requestCallTicket(threadId: string): Promise<CallTicket> {
  let response: Response;
  try {
    response = await fetch("/api/calls/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ threadId }),
    });
  } catch {
    throw unavailable();
  }
  if (response.status === 503) throw unavailable();
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new CallError(body?.error ?? "Could not start the call.");
  }
  const body = (await response.json()) as Partial<CallTicket>;
  if (!body.token || !body.url) throw unavailable();
  return { token: body.token, room: body.room ?? "", url: body.url };
}

/**
 * Translates a DOM media error into something a person can act on. The raw
 * names are terse and read like stack traces to anyone outside the codebase.
 */
function mediaErrorMessage(error: unknown): string {
  const name = (error as { name?: string } | null)?.name ?? "";
  switch (name) {
    case "NotAllowedError":
    case "PermissionDeniedError":
    case "SecurityError":
      return "Camera or microphone access is blocked. Allow it in your browser settings to call.";
    case "NotFoundError":
    case "DevicesNotFoundError":
      return "No camera or microphone was found on this device.";
    case "NotReadableError":
    case "TrackStartError":
      return "Your camera or microphone is busy in another app. Close it and try again.";
    default:
      return "Camera or microphone could not be started.";
  }
}

function describe(track: LocalTrack | RemoteTrack) {
  return track.kind === "video" ? "video" : "audio";
}

/**
 * One live connection to a LiveKit room, owned by a single call.
 *
 * The SDK is imported dynamically inside connect() so that a visitor who
 * never calls never downloads it, and so nothing touches browser globals while
 * this module is rendered on the server.
 */
export class CallSession {
  private closed = false;

  private constructor(
    private readonly room: Room,
    private readonly handlers: CallSessionHandlers,
    private readonly peerLabel: string,
  ) {}

  static async connect(options: {
    ticket: CallTicket;
    mode: CallMode;
    peerLabel: string;
    handlers: CallSessionHandlers;
  }): Promise<CallSession> {
    const lk = await import("livekit-client");
    const { ticket, mode, peerLabel, handlers } = options;
    const room = new lk.Room({
      adaptiveStream: true,
      dynacast: true,
      disconnectOnPageLeave: true,
    });
    const session = new CallSession(room, handlers, peerLabel);

    room.on(lk.RoomEvent.TrackSubscribed, (track) => {
      session.publish(track, "remote");
    });
    room.on(lk.RoomEvent.TrackUnsubscribed, (track) => {
      if (track.sid) handlers.onTrackRemoved(track.sid);
    });
    room.on(lk.RoomEvent.TrackMuted, (publication) => {
      handlers.onTrackMuted(publication.trackSid, true);
    });
    room.on(lk.RoomEvent.TrackUnmuted, (publication) => {
      handlers.onTrackMuted(publication.trackSid, false);
    });
    room.on(lk.RoomEvent.LocalTrackPublished, (publication) => {
      session.publish(publication.track, "local");
    });
    room.on(lk.RoomEvent.LocalTrackUnpublished, (publication) => {
      handlers.onTrackRemoved(publication.trackSid);
    });
    room.on(lk.RoomEvent.MediaDevicesError, (error) => {
      handlers.onError(mediaErrorMessage(error));
    });
    room.on(lk.RoomEvent.Reconnecting, () => {
      handlers.onState("reconnecting");
    });
    room.on(lk.RoomEvent.Reconnected, () => {
      handlers.onState("connected");
    });
    room.on(lk.RoomEvent.Disconnected, () => {
      if (session.closed) return;
      session.closed = true;
      handlers.onState("failed");
    });

    try {
      await room.connect(ticket.url, ticket.token, { autoSubscribe: true });
      await room.localParticipant.setMicrophoneEnabled(true);
      if (mode === "video") {
        // A refused camera is not fatal: the call still carries audio, and the
        // local tile falls back to an avatar.
        try {
          await room.localParticipant.setCameraEnabled(true);
        } catch (error) {
          handlers.onError(mediaErrorMessage(error));
        }
      }
    } catch (error) {
      await room.disconnect().catch(() => {});
      session.closed = true;
      throw new CallError(
        error instanceof CallError
          ? error.message
          : "Could not connect to the call. Check your connection and try again.",
      );
    }

    // Adaptive stream and auto-subscribe can miss a track that was already
    // live before we attached listeners, so sweep what is already published.
    for (const participant of [...room.remoteParticipants.values()]) {
      for (const publication of participant.trackPublications.values()) {
        if (publication.track) session.publish(publication.track, "remote");
      }
    }
    for (const publication of room.localParticipant.trackPublications.values()) {
      session.publish(publication.track, "local");
    }

    handlers.onState("connected");
    return session;
  }

  // A track has no sid until it is published, and a publication can outlive its
  // track, so both are optional here even though the events that reach us
  // almost always carry a live one.
  private publish(track: LocalTrack | RemoteTrack | undefined, source: "local" | "remote") {
    if (!track?.sid) return;
    const kind = describe(track);
    this.handlers.onTrack({
      id: track.sid,
      kind,
      source,
      label: source === "local" ? "You" : this.peerLabel,
      muted: track.isMuted,
      attach: (element) => void track.attach(element),
      detach: (element) => void track.detach(element),
    });
  }

  async setMicrophoneEnabled(enabled: boolean) {
    const publication = await this.room.localParticipant.setMicrophoneEnabled(enabled);
    if (publication?.track?.sid) {
      this.handlers.onTrackMuted(publication.track.sid, !enabled);
    }
  }

  async setCameraEnabled(enabled: boolean) {
    const publication = await this.room.localParticipant.setCameraEnabled(enabled);
    if (publication?.track?.sid) {
      this.handlers.onTrackMuted(publication.track.sid, !enabled);
    }
  }

  /** True when the microphone is actually capturing, not merely unmuted. */
  get microphoneEnabled() {
    return Boolean(this.room.localParticipant.isMicrophoneEnabled);
  }

  get cameraEnabled() {
    return Boolean(this.room.localParticipant.isCameraEnabled);
  }

  async disconnect() {
    this.closed = true;
    await this.room.disconnect(true).catch(() => {});
  }
}
