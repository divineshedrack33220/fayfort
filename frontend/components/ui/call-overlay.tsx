"use client";

import { useEffect, useRef } from "react";
import { Mic, MicOff, Phone, PhoneOff, Video, VideoOff } from "lucide-react";
import type { CallTrack } from "@/lib/call-session";
import type { CallMode } from "@/lib/chat-socket";
import type { CallState } from "@/components/ui/use-call";
import { cn } from "@/lib/utils";

const AVATAR_TINTS = [
  "bg-brand-100 text-brand-800",
  "bg-accent-100 text-accent-700",
  "bg-success-100 text-success-700",
  "bg-sand-200 text-sand-800",
] as const;

function initialsOf(name: string) {
  const parts = name.split(" ").filter(Boolean);
  return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase() || "?";
}

function tintFor(name: string) {
  const sum = [...name].reduce((total, letter) => total + letter.charCodeAt(0), 0);
  return AVATAR_TINTS[sum % AVATAR_TINTS.length];
}

function formatElapsed(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes}:${rest.toString().padStart(2, "0")}`;
}

function firstName(name: string) {
  return name.split(" ")[0] || name;
}

/**
 * Attaches a LiveKit track to a media element. Detaching on unmount matters:
 * LiveKit keeps its own reference to the element and would otherwise keep
 * decoding frames for a tile that is gone.
 */
function TrackTile({ track, className }: { track: CallTrack; className?: string }) {
  const ref = useRef<HTMLVideoElement | null>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    track.attach(element);
    return () => track.detach(element);
  }, [track]);
  return (
    <video
      ref={ref}
      // Audio always rides its own element below, so every video stays muted:
      // local video must never feed back, remote video has nothing to say.
      muted
      autoPlay
      playsInline
      aria-hidden
      className={cn("size-full object-cover", className)}
    />
  );
}

function AudioHost({ track }: { track: CallTrack }) {
  const ref = useRef<HTMLAudioElement | null>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    track.attach(element);
    return () => track.detach(element);
  }, [track]);
  return <audio ref={ref} autoPlay />;
}

function Avatar({ name, className }: { name: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "font-display flex shrink-0 items-center justify-center rounded-full font-semibold",
        tintFor(name),
        className ?? "size-12 text-base",
      )}
    >
      {initialsOf(name)}
    </span>
  );
}

const headerAction =
  "text-sand-500 hover:bg-brand-50 hover:text-brand-700 flex size-10 shrink-0 items-center justify-center rounded-full border border-sand-200 bg-white shadow-sm transition-colors disabled:pointer-events-none disabled:opacity-45 sm:size-9";

/** The audio and video actions for a chat header. */
export function CallStartButtons({
  peer,
  onStart,
  disabled = false,
  className,
}: {
  peer: string;
  onStart: (mode: CallMode) => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex shrink-0 items-center gap-1.5", className)}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onStart("audio")}
        title={`Call ${peer} with audio`}
        aria-label={`Start an audio call with ${peer}`}
        className={headerAction}
      >
        <Phone aria-hidden className="size-4" />
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onStart("video")}
        title={`Call ${peer} with video`}
        aria-label={`Start a video call with ${peer}`}
        className={headerAction}
      >
        <Video aria-hidden className="size-4" />
      </button>
    </div>
  );
}

function RingerButton({
  intent,
  children,
  onClick,
  label,
}: {
  intent: "accept" | "decline";
  children: React.ReactNode;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cn(
        "flex size-11 items-center justify-center rounded-full shadow-sm transition-colors",
        intent === "accept"
          ? "bg-success-600 hover:bg-success-700 text-white"
          : "bg-danger-50 text-danger-700 hover:bg-danger-100 border border-danger-200",
      )}
    >
      {children}
    </button>
  );
}

/**
 * Ringing state: one small card, bottom right, so the conversation underneath
 * stays readable. Deliberately not a modal — a call you did not ask for should
 * not take the page away from you.
 */
function CallRinger({
  state,
  peer,
  onAccept,
  onDecline,
  onCancel,
}: {
  state: CallState;
  peer: string;
  onAccept: () => void;
  onDecline: () => void;
  onCancel: () => void;
}) {
  const incoming = state.incoming;
  const settling = state.phase === "connecting";
  return (
    <div
      role={incoming ? "alert" : "status"}
      aria-live={incoming ? "assertive" : "polite"}
      className={cn(
        "animate-in fade-in slide-in-from-bottom-2 fixed right-4 z-50 w-[min(19rem,calc(100vw-2rem))]",
        // Clears the portal's bottom navigation on small screens.
        "bottom-24 sm:bottom-6",
      )}
    >
      <div
        aria-label={incoming ? `Incoming call from ${peer}` : `Calling ${peer}`}
        className="flex items-center gap-3 rounded-2xl border border-sand-200 bg-white p-3 shadow-lg"
      >
        <span className="relative shrink-0">
          <Avatar name={peer} />
          {/* Opacity only: a scaling halo would push past the card's padding
              and read as clipped. */}
          <span
            aria-hidden
            className="border-brand-400/70 absolute inset-0 animate-pulse rounded-full border-2"
          />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-sand-900">
            {incoming ? `${firstName(peer)} is calling` : `Calling ${firstName(peer)}`}
          </p>
          <p className="truncate text-xs text-sand-500">
            {settling
              ? incoming
                ? "Connecting…"
                : "Starting call…"
              : incoming
                ? state.mode === "video"
                  ? "Incoming video call"
                  : "Incoming audio call"
                : state.mode === "video"
                  ? "Video call · ringing"
                  : "Audio call · ringing"}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {incoming ? (
            <>
              <RingerButton intent="decline" onClick={onDecline} label={`Decline call from ${peer}`}>
                <PhoneOff aria-hidden className="size-4" />
              </RingerButton>
              <RingerButton intent="accept" onClick={onAccept} label={`Accept call from ${peer}`}>
                <Phone aria-hidden className="size-4" />
              </RingerButton>
            </>
          ) : (
            <RingerButton intent="decline" onClick={onCancel} label="Cancel the call">
              <PhoneOff aria-hidden className="size-4" />
            </RingerButton>
          )}
        </div>
      </div>
    </div>
  );
}

function ControlButton({
  label,
  onClick,
  danger = false,
  off = false,
  children,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
  off?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={cn(
        "flex size-12 items-center justify-center rounded-full shadow-sm transition-colors",
        danger
          ? "bg-danger-600 hover:bg-danger-700 text-white"
          : off
            ? "bg-white/15 text-white hover:bg-white/25"
            : "bg-white text-sand-900 hover:bg-sand-100",
      )}
    >
      {children}
    </button>
  );
}

/**
 * Connected call. Takes over the viewport: once the call is live the chat
 * underneath cannot be used, so a full-bleed window is the least cramped
 * option and keeps the local camera preview visible.
 */
function CallWindow({
  state,
  peer,
  onHangUp,
  onToggleMic,
  onToggleCamera,
}: {
  state: CallState;
  peer: string;
  onHangUp: () => void;
  onToggleMic: () => void;
  onToggleCamera: () => void;
}) {
  const remoteVideo = state.tracks.find((track) => track.kind === "video" && track.source === "remote");
  const localVideo = state.tracks.find((track) => track.kind === "video" && track.source === "local");
  const remoteAudio = state.tracks.filter((track) => track.kind === "audio" && track.source === "remote");
  const connecting = state.phase === "connecting";
  const localLive = localVideo ? !localVideo.muted : false;

  useEffect(() => {
    if (connecting) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onHangUp();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [connecting, onHangUp]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Call with ${peer}`}
      className="fixed inset-0 z-50 flex items-stretch justify-center bg-sand-950/85 p-0 backdrop-blur-sm sm:items-center sm:p-6"
    >
      {remoteAudio.map((track) => (
        <AudioHost key={track.id} track={track} />
      ))}
      <div className="relative flex aspect-[9/16] w-full max-w-5xl flex-col overflow-hidden bg-sand-950 sm:aspect-video sm:rounded-2xl">
        {remoteVideo && !remoteVideo.muted ? (
          <TrackTile track={remoteVideo} className="absolute inset-0" />
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-sand-900">
            <span className="relative">
              <Avatar name={peer} className="size-24 text-2xl" />
              <span
                aria-hidden
                className="absolute -inset-2 animate-pulse rounded-full border-2 border-white/25"
              />
            </span>
            <p className="font-display text-base text-white/90">
              {connecting ? `Connecting to ${firstName(peer)}…` : `${firstName(peer)} is on the call`}
            </p>
          </div>
        )}

        <div className="absolute inset-x-0 top-0 flex items-center justify-between gap-3 bg-gradient-to-b from-black/55 to-transparent p-3 sm:p-4">
          <div className="min-w-0">
            <p className="truncate font-display text-sm font-semibold text-white sm:text-base">
              {peer}
            </p>
            <p className="font-mono text-xs text-white/70">
              {connecting ? "connecting…" : formatElapsed(state.elapsed)}
            </p>
          </div>
          <span className="shrink-0 rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-semibold tracking-wide text-white uppercase">
            {state.mode === "video" ? "Video" : "Audio"}
          </span>
        </div>

        {localVideo && localLive ? (
          <div className="absolute top-16 right-3 aspect-3/4 w-24 overflow-hidden rounded-xl bg-sand-800 shadow-lg ring-1 ring-white/15 sm:top-20 sm:w-32">
            <TrackTile track={localVideo} />
          </div>
        ) : null}

        <div className="mt-auto flex items-center justify-center gap-3 bg-gradient-to-t from-black/70 to-transparent p-4 sm:gap-4 sm:p-5">
          <ControlButton
            label={state.micOn ? "Mute microphone" : "Unmute microphone"}
            onClick={onToggleMic}
            off={!state.micOn}
          >
            {state.micOn ? (
              <Mic aria-hidden className="size-5" />
            ) : (
              <MicOff aria-hidden className="size-5" />
            )}
          </ControlButton>
          {state.mode === "video" ? (
            <ControlButton
              label={state.cameraOn ? "Turn camera off" : "Turn camera on"}
              onClick={onToggleCamera}
              off={!state.cameraOn || !localLive}
            >
              {state.cameraOn && localLive ? (
                <Video aria-hidden className="size-5" />
              ) : (
                <VideoOff aria-hidden className="size-5" />
              )}
            </ControlButton>
          ) : null}
          <ControlButton label="End call" onClick={onHangUp} danger>
            <PhoneOff aria-hidden className="size-5" />
          </ControlButton>
        </div>
      </div>
    </div>
  );
}

/**
 * Everything a call needs on screen, for either side of the conversation.
 * Renders nothing while idle, so it is safe to mount permanently.
 */
export function CallLayer({
  state,
  peer,
  onAccept,
  onDecline,
  onHangUp,
  onCancel,
  onToggleMic,
  onToggleCamera,
}: {
  state: CallState;
  peer: string;
  onAccept: () => void;
  onDecline: () => void;
  onHangUp: () => void;
  onCancel: () => void;
  onToggleMic: () => void;
  onToggleCamera: () => void;
}) {
  if (state.phase === "idle") return null;
  if (state.phase === "active" || (state.phase === "connecting" && state.incoming)) {
    return (
      <CallWindow
        state={state}
        peer={peer}
        onHangUp={onHangUp}
        onToggleMic={onToggleMic}
        onToggleCamera={onToggleCamera}
      />
    );
  }
  return (
    <CallRinger
      state={state}
      peer={peer}
      onAccept={onAccept}
      onDecline={onDecline}
      onCancel={onCancel}
    />
  );
}
